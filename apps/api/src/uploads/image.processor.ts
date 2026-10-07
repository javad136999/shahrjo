import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';
import type { Metadata, OutputInfo, Sharp } from 'sharp';

/** Hard cap for an *incoming* image (multer rejects earlier; defense in depth). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** Longest edge of the stored (display) image. Never upscales. */
export const MAX_EDGE = 1600;
/** Longest edge of the list thumbnail. */
export const THUMB_EDGE = 400;
/** WebP quality — visually lossless enough while shrinking files hard. */
export const WEBP_QUALITY = 82;
/** Decode guard: a decompression bomb must not eat CPU/RAM. */
export const MAX_INPUT_PIXELS = 40_000_000; // 40 MP
/** Absolute dimension cap (either side). */
export const MAX_DIMENSION = 12_000;

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImageSet {
  /** ≤1600px display copy (detail pages) */
  full: ProcessedImage;
  /** ≤400px list thumbnail */
  thumb: ProcessedImage;
  /** full + thumb bytes, for quota accounting */
  bytes: number;
}

/**
 * JPEG/PNG/WebP → WebP pipeline shared by every upload (ads, businesses,
 * showcase, avatars, products):
 *
 *  - strict input checks (dimensions/pixels) BEFORE the heavy decode,
 *  - EXIF orientation applied, all metadata/EXIF dropped,
 *  - longest edge capped at 1600px (details) and 400px (thumbnails),
 *    aspect ratio kept, small images never enlarged,
 *  - quality 82 WebP for both variants.
 *
 * The original bytes are never written to storage — only these two variants.
 */
export async function processImage(input: Buffer): Promise<ProcessedImageSet> {
  if (input.length === 0) throw new BadRequestException('فایل تصویر خالی است');

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new UnsupportedMediaTypeException('فایل تصویر قابل پردازش نیست یا خراب است');
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new UnsupportedMediaTypeException('فایل تصویر قابل پردازش نیست یا خراب است');
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_INPUT_PIXELS) {
    throw new PayloadTooLargeException('ابعاد تصویر بیش از حد مجاز است (حداکثر ۴۰ مگاپیکسل)');
  }

  // A fresh pipeline per variant; `rotate()` applies EXIF orientation and,
  // without withMetadata(), sharp strips EXIF/GPS/ICC junk from the output.
  const pipeline = (): Sharp => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();

  const encode = (p: Sharp, edge: number): Promise<OutputInfo & { data: Buffer }> =>
    p
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => ({ data, ...info }));

  const [full, thumb] = await Promise.all([encode(pipeline(), MAX_EDGE), encode(pipeline(), THUMB_EDGE)]);

  return {
    full: { data: full.data, width: full.width, height: full.height },
    thumb: { data: thumb.data, width: thumb.width, height: thumb.height },
    bytes: full.data.length + thumb.data.length,
  };
}
