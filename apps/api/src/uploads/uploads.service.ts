import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleInit, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_INPUT_BYTES, processImage } from './image.processor';
import { STORAGE_DRIVER, type StorageDriver } from './storage/storage.types';

/** Hard cap per incoming image (multer rejects earlier; this is defense in depth). */
export const MAX_UPLOAD_BYTES = MAX_INPUT_BYTES; // 10 MB
/** Hard cap per incoming voice note (browser recordings are well under this). */
export const MAX_VOICE_BYTES = 5 * 1024 * 1024; // 5 MB
/** Per-user hourly cap so the disk cannot be filled by one account. */
const MAX_UPLOADS_PER_HOUR = 30;
/** Total bytes one account may keep on disk (~100 MB) — the disk-fill guard. */
export const MAX_BYTES_PER_USER = 100 * 1024 * 1024;
/** Uploads never attached to an ad are orphaned after 48h and get swept. */
const UNCLAIMED_MAX_AGE_MS = 48 * 3_600_000;
/** Soft-deleted media keeps its file 7 days (undo window) before hard delete. */
const TRASH_MAX_AGE_MS = 7 * 86_400_000;
/** Files younger than this are never touched by the orphan walk. */
const FILE_MIN_AGE_MS = 48 * 3_600_000;
/** How often the automatic sweep runs. */
export const SWEEP_INTERVAL_MS = 6 * 3_600_000;
/** Max thumbnails (re)generated per sweep — keeps CPU bounded on legacy data. */
const THUMBS_PER_SWEEP = 100;

export interface StoredImage {
  id: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

/** A stored voice note has no thumbnail — only the playable file. */
export interface StoredVoice {
  id: number;
  url: string;
}

/** Admin-facing storage usage (Phase 9). */
export interface SweepResult {
  removedFiles: number;
  freedBytes: number;
  thumbsCreated: number;
}

export interface StorageOverview {
  usedBytes: number;
  fileCount: number;
  perUserQuotaBytes: number;
  perFileQuotaBytes: number;
}

interface Sniffed {
  mime: string;
  ext: string;
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;

/**
 * Thumb key of a stored object: `media/2026/10/ab.webp` →
 * `media/2026/10/ab.thumb.webp` (legacy `x.jpg` → `x.thumb.webp`).
 * The frontend derives the very same rule from a URL — no schema coupling.
 */
export function thumbKeyFor(storageKey: string): string {
  return `${storageKey.replace(IMAGE_EXT_RE, '')}.thumb.webp`;
}

/** URL counterpart of {@link thumbKeyFor}; `null` for empty/non-image URLs. */
export function thumbUrlFor(url: string | null | undefined): string | null {
  if (!url) return null;
  return IMAGE_EXT_RE.test(url) ? url.replace(IMAGE_EXT_RE, '.thumb.webp') : null;
}

/**
 * Magic-byte sniffing — the client-declared mimetype is never trusted.
 * SVG and anything else executable are rejected by construction.
 */
/**
 * Audio counterpart of {@link sniffImage} — accepts exactly what browsers
 * record/upload (WebM/Opus, OGG, MP4/M4A, MP3, WAV). Everything else —
 * including files with a forged `.mp3` name — is rejected by construction.
 */
export function sniffAudio(buf: Buffer): Sniffed | null {
  // Matroska/WebM (MediaRecorder in Chrome/Firefox/Edge)
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mime: 'audio/webm', ext: 'webm' };
  }
  if (buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  // RIFF/WAVE (uncompressed mic dumps)
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WAVE') {
    return { mime: 'audio/wav', ext: 'wav' };
  }
  // ISO-BMFF `….ftyp` (MediaRecorder in Safari → audio/mp4)
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') return { mime: 'audio/mp4', ext: 'm4a' };
  // MP3: ID3 tag or a raw frame sync (0xFFEx)
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { mime: 'audio/mpeg', ext: 'mp3' };
  return null;
}

export function sniffImage(buf: Buffer): Sniffed | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(png)) return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === 'GIF8') return { mime: 'image/gif', ext: 'gif' };
  return null;
}

/**
 * Image upload (Phase 5, hardened for production storage).
 *
 * Pipeline: sniff → rate/quota guards → sharp (WebP ≤1600px + thumb ≤400px,
 * quality 82, EXIF stripped) → `StorageDriver` (Docker volume today, Arvan
 * Object Storage later) → Media row. The user's original bytes are never
 * written anywhere; a failed step removes whatever it already wrote.
 *
 * Only metadata lives in PostgreSQL — never the file itself.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {
    // config stays in the signature for the storage factory wiring; the
    // driver itself already resolved STORAGE_LOCAL_DIR / PUBLIC_BASE_URL.
    void config;
  }

  async save(
    user: User,
    file: { buffer?: Buffer; size?: number } | undefined,
    // What will claim this row: an ad (default) or a business logo/cover.
    entity: 'ad' | 'business' = 'ad',
  ): Promise<StoredImage> {
    const buffer = file?.buffer;
    if (!buffer || buffer.length === 0) throw new BadRequestException('فایل تصویر الزامی است');
    if ((file?.size ?? buffer.length) > MAX_UPLOAD_BYTES || buffer.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException('حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد');
    }

    const kind = sniffImage(buffer);
    if (!kind) throw new UnsupportedMediaTypeException('فرمت فایل پشتیبانی نمی‌شود (JPG، PNG یا WebP)');
    if (kind.mime === 'image/gif') {
      throw new UnsupportedMediaTypeException('فرمت GIF پشتیبانی نمی‌شود (JPG، PNG یا WebP بفرستید)');
    }

    const hourAgo = new Date(Date.now() - 3_600_000);
    const recent = await this.prisma.media.count({
      where: { ownerUserId: user.id, createdAt: { gte: hourAgo } },
    });
    if (recent >= MAX_UPLOADS_PER_HOUR) {
      throw new HttpException('سقف آپلود تصویر در ساعت پر شده است؛ کمی بعد دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Quota BEFORE the CPU-heavy decode (cheap guard, input is an upper bound
    // for what we are about to store), then again on the real bytes below.
    const used = await this.prisma.media.aggregate({
      where: { ownerUserId: user.id, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    const usedBytes = used._sum.sizeBytes ?? 0;
    if (usedBytes + buffer.length > MAX_BYTES_PER_USER) {
      throw new PayloadTooLargeException(
        'سقف ذخیره‌سازی تصویر شما تکمیل است (۱۰۰ مگابایت)؛ ابتدا تصاویر آگهی‌های قدیمی را حذف کنید',
      );
    }

    // --- process: WebP display copy + list thumbnail (original is discarded) ---
    const processed = await processImage(buffer);
    if (usedBytes + processed.bytes > MAX_BYTES_PER_USER) {
      throw new PayloadTooLargeException(
        'سقف ذخیره‌سازی تصویر شما تکمیل است (۱۰۰ مگابایت)؛ ابتدا تصاویر آگهی‌های قدیمی را حذف کنید',
      );
    }

    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `media/${now.getUTCFullYear()}/${month}`;
    const storageKey = `${prefix}/${randomBytes(12).toString('hex')}.webp`;
    const thumbKey = thumbKeyFor(storageKey);
    const url = this.storage.url(storageKey);

    // Write both variants; anything already written is removed on failure so
    // a half-finished upload never leaves a temp/orphan file behind.
    const written: string[] = [];
    try {
      await this.storage.put(storageKey, processed.full.data);
      written.push(storageKey);
      await this.storage.put(thumbKey, processed.thumb.data);
      written.push(thumbKey);
    } catch {
      await Promise.all(written.map((key) => this.storage.delete(key).catch(() => undefined)));
      throw new HttpException('ذخیره تصویر ممکن نشد؛ کمی بعد دوباره تلاش کنید', HttpStatus.BAD_GATEWAY);
    }

    try {
      const media = await this.prisma.media.create({
        data: {
          storageKey,
          url,
          mimeType: 'image/webp',
          sizeBytes: processed.bytes,
          width: processed.full.width,
          height: processed.full.height,
          ownerUserId: user.id,
          entityType: entity === 'business' ? 'BUSINESS' : 'AD',
          entityId: null, // claimed by POST /ads (AD) or POST /businesses (BUSINESS)
        },
        select: { id: true, url: true },
      });
      return {
        id: media.id,
        url: media.url,
        thumbUrl: thumbUrlFor(media.url) ?? media.url,
        width: processed.full.width,
        height: processed.full.height,
      };
    } catch (err) {
      // no row ⇒ no reference ⇒ drop both files (no orphans)
      await Promise.all(written.map((key) => this.storage.delete(key).catch(() => undefined)));
      throw err;
    }
  }

  /**
   * Store one voice note (Phase 10 chat room). The bytes are kept as-is —
   * audio is already compressed and must stay playable — but the path is
   * identical to images: sniff → rate/quota guards → random storage key →
   * Media row (`WALL`, unclaimed until the post exists) → rollback on error.
   */
  async saveVoice(user: User, file: { buffer?: Buffer; size?: number } | undefined): Promise<StoredVoice> {
    const buffer = file?.buffer;
    if (!buffer || buffer.length === 0) throw new BadRequestException('فایل صوتی الزامی است');
    if ((file?.size ?? buffer.length) > MAX_VOICE_BYTES || buffer.length > MAX_VOICE_BYTES) {
      throw new PayloadTooLargeException('حجم ویس نباید بیشتر از ۵ مگابایت باشد');
    }

    const kind = sniffAudio(buffer);
    if (!kind) throw new UnsupportedMediaTypeException('فرمت صوتی پشتیبانی نمی‌شود (WebM، OGG، M4A، MP3 یا WAV بفرستید)');

    const hourAgo = new Date(Date.now() - 3_600_000);
    const recent = await this.prisma.media.count({
      where: { ownerUserId: user.id, createdAt: { gte: hourAgo } },
    });
    if (recent >= MAX_UPLOADS_PER_HOUR) {
      throw new HttpException('سقف آپلود در ساعت پر شده است؛ کمی بعد دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }

    const used = await this.prisma.media.aggregate({
      where: { ownerUserId: user.id, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    if ((used._sum.sizeBytes ?? 0) + buffer.length > MAX_BYTES_PER_USER) {
      throw new PayloadTooLargeException('سقف ذخیره‌سازی شما تکمیل است (۱۰۰ مگابایت)؛ ابتدا فایل‌های قدیمی را حذف کنید');
    }

    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storageKey = `voice/${now.getUTCFullYear()}/${month}/${randomBytes(12).toString('hex')}.${kind.ext}`;
    const url = this.storage.url(storageKey);

    try {
      await this.storage.put(storageKey, buffer);
    } catch {
      throw new HttpException('ذخیره ویس ممکن نشد؛ کمی بعد دوباره تلاش کنید', HttpStatus.BAD_GATEWAY);
    }

    try {
      const media = await this.prisma.media.create({
        data: {
          storageKey,
          url,
          mimeType: kind.mime,
          sizeBytes: buffer.length,
          ownerUserId: user.id,
          entityType: 'WALL',
          entityId: null, // claimed by the wall post (voiceMediaId) right after it exists
        },
        select: { id: true, url: true },
      });
      return { id: media.id, url: media.url };
    } catch (err) {
      // no row ⇒ no reference ⇒ drop the file (no orphans)
      await this.storage.delete(storageKey).catch(() => undefined);
      throw err;
    }
  }

  // ---------- deletion (files follow their entity) ----------

  /**
   * Removes every file + Media row belonging to one entity (ad, wall post, …).
   * Called at delete time so storage frees up immediately instead of waiting
   * for the sweep.
   */
  async purgeEntity(entityType: string, entityId: string | number): Promise<{ removed: number }> {
    const rows = await this.prisma.media.findMany({
      where: { entityType, entityId: String(entityId) },
      select: { id: true, storageKey: true },
    });
    if (rows.length === 0) return { removed: 0 };

    for (const row of rows) {
      await this.storage.delete(row.storageKey).catch(() => undefined);
      await this.storage.delete(thumbKeyFor(row.storageKey)).catch(() => undefined);
    }
    await this.prisma.media.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    return { removed: rows.length };
  }

  // ---------- disk protection (Phase 9) ----------

  /** First automatic sweep runs shortly after boot, then every SWEEP_INTERVAL. */
  onModuleInit(): void {
    const first = setTimeout(() => void this.sweepSafely(), 10 * 60_000);
    const interval = setInterval(() => void this.sweepSafely(), SWEEP_INTERVAL_MS);
    first.unref?.();
    interval.unref?.();
  }

  private async sweepSafely(): Promise<void> {
    try {
      const result = await this.sweep();
      if (result.removedFiles > 0 || result.thumbsCreated > 0) {
        this.logger.log(
          `storage sweep: removed ${result.removedFiles} file(s), freed ${result.freedBytes} bytes, ` +
            `created ${result.thumbsCreated} thumbnail(s)`,
        );
      }
    } catch (err) {
      this.logger.warn(`storage sweep failed: ${String(err)}`);
    }
  }

  /**
   * Disk-protection sweep: (1) hard-delete soft-deleted media past retention,
   * (2) drop uploads never claimed by an entity, (3) drop media whose entity
   * is gone, (4) unlink orphan files that no Media row references (thumbnails
   * are considered too), (5) backfill missing thumbnails for legacy images.
   * Idempotent — safe to run on an interval and on demand from the admin panel.
   */
  async sweep(): Promise<SweepResult> {
    let removedFiles = 0;
    let freedBytes = 0;
    let thumbsCreated = 0;

    const remove = async (row: { storageKey: string; sizeBytes?: number }): Promise<void> => {
      for (const key of [row.storageKey, thumbKeyFor(row.storageKey)]) {
        if (!(await this.storage.exists(key).catch(() => false))) continue;
        await this.storage.delete(key).catch(() => undefined);
        removedFiles += 1;
        if (key === row.storageKey) freedBytes += row.sizeBytes ?? 0;
      }
    };

    // (1) soft-deleted rows past the 7-day undo window
    const trash = await this.prisma.media.findMany({
      where: { deletedAt: { not: null, lt: new Date(Date.now() - TRASH_MAX_AGE_MS) } },
      select: { id: true, storageKey: true, sizeBytes: true },
    });
    for (const row of trash) {
      await remove(row);
      await this.prisma.media.delete({ where: { id: row.id } });
    }

    // (2) uploads that were never attached to an entity (abandoned submissions)
    const unclaimed = await this.prisma.media.findMany({
      where: {
        entityId: null,
        deletedAt: null,
        createdAt: { lt: new Date(Date.now() - UNCLAIMED_MAX_AGE_MS) },
        // wall uploads are claimed after the post row exists — keep the grace period
        entityType: { in: ['AD', 'WALL', 'BUSINESS', 'NEWS', 'USER', 'BANNER'] },
      },
      select: { id: true, storageKey: true, sizeBytes: true },
    });
    for (const row of unclaimed) {
      await remove(row);
      await this.prisma.media.delete({ where: { id: row.id } });
    }

    // (3) media whose ad/wall post was deleted (joins cascade, media does not)
    const attached = await this.prisma.media.findMany({
      where: { entityType: { in: ['AD', 'WALL'] }, entityId: { not: null }, deletedAt: null },
      select: { id: true, storageKey: true, sizeBytes: true, entityType: true, entityId: true },
    });
    const adIds = [
      ...new Set(
        attached
          .filter((r) => r.entityType === 'AD')
          .map((r) => Number(r.entityId))
          .filter((n) => Number.isInteger(n)),
      ),
    ];
    const wallIds = [
      ...new Set(
        attached
          .filter((r) => r.entityType === 'WALL')
          .map((r) => Number(r.entityId))
          .filter((n) => Number.isInteger(n)),
      ),
    ];
    const [aliveAds, alivePosts] = await Promise.all([
      adIds.length
        ? this.prisma.ad.findMany({
            where: { id: { in: adIds }, status: { not: 'DELETED' } },
            select: { id: true },
          })
        : Promise.resolve([]),
      wallIds.length
        ? this.prisma.wallPost.findMany({ where: { id: { in: wallIds } }, select: { id: true } })
        : Promise.resolve([]),
    ]);
    const aliveAdSet = new Set(aliveAds.map((a) => a.id));
    const alivePostSet = new Set(alivePosts.map((p) => p.id));
    const isAlive = (row: { entityType: string; entityId: string | null }) => {
      const eid = Number(row.entityId);
      if (row.entityType === 'AD') return aliveAdSet.has(eid);
      return alivePostSet.has(eid); // WALL
    };
    for (const row of attached) {
      if (!isAlive(row)) {
        await remove(row);
        await this.prisma.media.delete({ where: { id: row.id } });
      }
    }

    // (4) files on disk no Media row references (crashes, manual copies, …).
    // Thumbnails belong to their main file and are referenced implicitly.
    const mediaRows = await this.prisma.media.findMany({ select: { storageKey: true, mimeType: true } });
    const referenced = new Set<string>();
    for (const row of mediaRows) {
      referenced.add(row.storageKey);
      referenced.add(thumbKeyFor(row.storageKey));
    }
    const cutoff = Date.now() - FILE_MIN_AGE_MS;
    for (const obj of await this.storage.list()) {
      if (referenced.has(obj.key)) continue;
      if (obj.mtimeMs > cutoff) continue; // may be an in-flight upload
      await this.storage.delete(obj.key).catch(() => undefined);
      removedFiles += 1;
      freedBytes += obj.size;
    }

    // (5) legacy images uploaded before the pipeline: create their thumbnail
    // (voice notes and other audio never get one — sharp cannot decode them)
    const imageRows = mediaRows.filter((row) => row.mimeType?.startsWith('image/'));
    for (const row of imageRows.slice(0, THUMBS_PER_SWEEP)) {
      const thumbKey = thumbKeyFor(row.storageKey);
      if (thumbKey === row.storageKey) continue;
      if (await this.storage.exists(thumbKey).catch(() => true)) continue;
      try {
        const original = await this.storage.get(row.storageKey);
        if (!original) continue;
        const { thumb } = await processImage(original);
        await this.storage.put(thumbKey, thumb.data, { overwrite: true });
        thumbsCreated += 1;
      } catch (err) {
        this.logger.warn(`thumbnail backfill failed for ${row.storageKey}: ${String(err)}`);
      }
    }

    return { removedFiles, freedBytes, thumbsCreated };
  }

  /** Usage numbers for the admin storage panel. */
  async overview(): Promise<StorageOverview> {
    const agg = await this.prisma.media.aggregate({
      where: { deletedAt: null },
      _sum: { sizeBytes: true },
      _count: { id: true },
    });
    return {
      usedBytes: agg._sum.sizeBytes ?? 0,
      fileCount: agg._count.id,
      perUserQuotaBytes: MAX_BYTES_PER_USER,
      perFileQuotaBytes: MAX_UPLOAD_BYTES,
    };
  }
}
