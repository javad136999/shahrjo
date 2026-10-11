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

/**
 * Encoding profile: how big/quality-heavy the stored variants may be. Business
 * photos (logo, cover, menu products) are never shown bigger than a card, so
 * they get their own hard-compressed profile — that is what keeps the disk
 * from filling up with months of owner uploads.
 */
export interface ImageProfile {
  /** Longest edge of the stored (display) copy. */
  fullEdge: number;
  /** Longest edge of the list thumbnail. */
  thumbEdge: number;
  /** WebP quality for both copies. */
  quality: number;
}

/** Full-size profile: ads, avatars, news covers (detail pages zoom a lot). */
export const DISPLAY_PROFILE: ImageProfile = {
  fullEdge: MAX_EDGE,
  thumbEdge: THUMB_EDGE,
  quality: WEBP_QUALITY,
};

/**
 * Business profile: ≤1000px/q72 display copy + ≤320px thumbnail. Menu rows,
 * showcase cards and map pins render these at a few dozen pixels, so the
 * aggressive profile is invisible to users and ~3× smaller on disk.
 */
export const BUSINESS_PROFILE: ImageProfile = { fullEdge: 1000, thumbEdge: 320, quality: 72 };

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
 * showcase, avatars, products). `profile` picks the stored sizes/quality
 * ({@link DISPLAY_PROFILE} by default, {@link BUSINESS_PROFILE} for owner
 * business/menu photos):
 *
 *  - strict input checks (dimensions/pixels) BEFORE the heavy decode,
 *  - EXIF orientation applied, all metadata/EXIF dropped,
 *  - longest edge capped by the profile (details) and by its thumbnail edge,
 *    aspect ratio kept, small images never enlarged,
 *  - WebP at the profile's quality for both variants.
 *
 * The original bytes are never written to storage — only these two variants.
 */
export async function processImage(
  input: Buffer,
  profile: ImageProfile = DISPLAY_PROFILE,
): Promise<ProcessedImageSet> {
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
      .webp({ quality: profile.quality, effort: 4 })
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => ({ data, ...info }));

  const [full, thumb] = await Promise.all([
    encode(pipeline(), profile.fullEdge),
    encode(pipeline(), profile.thumbEdge),
  ]);

  return {
    full: { data: full.data, width: full.width, height: full.height },
    thumb: { data: thumb.data, width: thumb.width, height: thumb.height },
    bytes: full.data.length + thumb.data.length,
  };
}
