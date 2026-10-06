import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, OnModuleInit, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

/** Hard cap per image (multer rejects earlier; this is defense in depth). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
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

export interface StoredImage {
  id: number;
  url: string;
}

/** Admin-facing storage usage (Phase 9). */
export interface SweepResult {
  removedFiles: number;
  freedBytes: number;
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

/**
 * Magic-byte sniffing — the client-declared mimetype is never trusted.
 * SVG and anything else executable are rejected by construction.
 */
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
 * Image upload (Phase 5). Files land on the VPS filesystem under
 * `STORAGE_LOCAL_DIR` with a random content key (never user-controlled names),
 * a Media row is created for ownership/audit, and only a URL is stored in DB —
 * binary data never enters PostgreSQL.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly root: string;
  private readonly publicBase: string;
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.root = resolve(config.get<string>('STORAGE_LOCAL_DIR') ?? './uploads');
    this.publicBase = (config.get<string>('STORAGE_PUBLIC_BASE_URL') ?? '').trim().replace(/\/+$/, '');
  }

  async save(user: User, file: { buffer?: Buffer; size?: number } | undefined): Promise<StoredImage> {
    const buffer = file?.buffer;
    if (!buffer || buffer.length === 0) throw new BadRequestException('فایل تصویر الزامی است');
    if ((file?.size ?? buffer.length) > MAX_UPLOAD_BYTES || buffer.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException('حجم تصویر نباید بیشتر از ۵ مگابایت باشد');
    }

    const kind = sniffImage(buffer);
    if (!kind) throw new UnsupportedMediaTypeException('فرمت فایل پشتیبانی نمی‌شود (JPG، PNG، WebP یا GIF)');

    const hourAgo = new Date(Date.now() - 3_600_000);
    const recent = await this.prisma.media.count({
      where: { ownerUserId: user.id, createdAt: { gte: hourAgo } },
    });
    if (recent >= MAX_UPLOADS_PER_HOUR) {
      throw new HttpException('سقف آپلود تصویر در ساعت پر شده است؛ کمی بعد دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Total-per-user quota: the hourly rate limit alone cannot stop a slow
    // drip from filling the VPS disk over days.
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

    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storageKey = `ads/${now.getUTCFullYear()}/${month}/${randomBytes(12).toString('hex')}.${kind.ext}`;
    await mkdir(dirname(join(this.root, storageKey)), { recursive: true });
    // 'wx': never overwrite an existing object, even on a (practically impossible) collision
    await writeFile(join(this.root, storageKey), buffer, { flag: 'wx' });

    // Relative URL by default: the same origin serves /api/v1/files/* through
    // the reverse proxy, so the record stays valid on any domain.
    const url = this.publicBase ? `${this.publicBase}/${storageKey}` : `/api/v1/files/${storageKey}`;

    const media = await this.prisma.media.create({
      data: {
        storageKey,
        url,
        mimeType: kind.mime,
        sizeBytes: buffer.length,
        ownerUserId: user.id,
        entityType: 'AD',
        entityId: null, // attached to an ad (and claimed) on POST /ads
      },
      select: { id: true, url: true },
    });
    return { id: media.id, url: media.url };
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
      if (result.removedFiles > 0) {
        this.logger.log(`storage sweep: removed ${result.removedFiles} file(s), freed ${result.freedBytes} bytes`);
      }
    } catch (err) {
      this.logger.warn(`storage sweep failed: ${String(err)}`);
    }
  }

  /**
   * Disk-protection sweep: (1) hard-delete soft-deleted media past retention,
   * (2) drop uploads never claimed by an ad, (3) drop media whose ad is gone,
   * (4) unlink orphan files on disk that no Media row references anymore.
   * Idempotent — safe to run on an interval and on demand from the admin panel.
   */
  async sweep(): Promise<SweepResult> {
    let removedFiles = 0;
    let freedBytes = 0;

    const remove = async (key: string, size: number): Promise<void> => {
      try {
        await unlink(join(this.root, key));
        removedFiles += 1;
        freedBytes += size;
      } catch {
        // file already gone — the row delete below still cleans the DB
      }
    };

    // (1) soft-deleted rows past the 7-day undo window
    const trash = await this.prisma.media.findMany({
      where: { deletedAt: { not: null, lt: new Date(Date.now() - TRASH_MAX_AGE_MS) } },
      select: { id: true, storageKey: true, sizeBytes: true },
    });
    for (const row of trash) {
      await remove(row.storageKey, row.sizeBytes);
      await this.prisma.media.delete({ where: { id: row.id } });
    }

    // (2) uploads that were never attached to a post/ad (abandoned submissions)
    const unclaimed = await this.prisma.media.findMany({
      where: {
        entityType: { in: ['AD', 'WALL'] },
        entityId: null,
        deletedAt: null,
        createdAt: { lt: new Date(Date.now() - UNCLAIMED_MAX_AGE_MS) },
      },
      select: { id: true, storageKey: true, sizeBytes: true },
    });
    for (const row of unclaimed) {
      await remove(row.storageKey, row.sizeBytes);
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
        await remove(row.storageKey, row.sizeBytes);
        await this.prisma.media.delete({ where: { id: row.id } });
      }
    }

    // (4) files on disk no Media row references (crashes, manual copies, …)
    const referenced = new Set(
      (await this.prisma.media.findMany({ select: { storageKey: true } })).map((r) => r.storageKey),
    );
    const files = await this.walk(this.root);
    const cutoff = Date.now() - FILE_MIN_AGE_MS;
    for (const rel of files) {
      if (referenced.has(rel)) continue;
      const full = join(this.root, rel);
      try {
        const info = await stat(full);
        if (info.mtimeMs > cutoff) continue; // may be an in-flight upload
        await unlink(full);
        removedFiles += 1;
        freedBytes += info.size;
      } catch {
        // vanished or unreadable — ignore
      }
    }

    return { removedFiles, freedBytes };
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

  /** All files under root as posix-relative storage keys. */
  private async walk(dir: string, prefix = ''): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const keys: string[] = [];
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) keys.push(...(await this.walk(join(dir, entry.name), rel)));
      else if (entry.isFile()) keys.push(rel);
    }
    return keys;
  }
}
