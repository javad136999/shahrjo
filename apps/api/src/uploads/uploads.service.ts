import { BadRequestException, HttpException, HttpStatus, Injectable, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

/** Hard cap per image (multer rejects earlier; this is defense in depth). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Per-user hourly cap so the disk cannot be filled by one account. */
const MAX_UPLOADS_PER_HOUR = 30;

export interface StoredImage {
  id: number;
  url: string;
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
export class UploadsService {
  private readonly root: string;
  private readonly publicBase: string;

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
}
