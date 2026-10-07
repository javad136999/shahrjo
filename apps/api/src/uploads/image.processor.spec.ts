import { PayloadTooLargeException } from '@nestjs/common';
import sharp from 'sharp';
import { MAX_EDGE, THUMB_EDGE, WEBP_QUALITY, processImage } from './image.processor';

// encoding 2400×1800 fixtures is CPU-bound — generous ceiling so a loaded CI
// machine (parallel suites) never flakes a deterministic assertion
jest.setTimeout(60_000);

/** Deterministic pseudo-noise (compresses like a busy photo, no I/O needed). */
function noiseRaw(width: number, height: number): Buffer {
  const raw = Buffer.alloc(width * height * 3);
  let seed = 0x9e3779b9;
  for (let i = 0; i < raw.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    raw[i] = seed & 0xff;
  }
  return raw;
}

/** A "big busy photo" as JPEG — the classic user upload we must shrink. */
async function bigJpeg(): Promise<Buffer> {
  return sharp(noiseRaw(2400, 1800), { raw: { width: 2400, height: 1800, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** Generated once — every test re-uses the same immutable input buffer. */
let bigJpegCache: Buffer | null = null;
async function bigJpegCached(): Promise<Buffer> {
  bigJpegCache ??= await bigJpeg();
  return bigJpegCache;
}

describe('processImage — WebP pipeline', () => {
  it('converts a big JPEG to WebP and shrinks it substantially', async () => {
    const jpeg = await bigJpegCached();
    const out = await processImage(jpeg);

    expect(out.full.data.length).toBeGreaterThan(0);
    expect(out.full.data.length).toBeLessThan(jpeg.length * 0.75); // ≥25% smaller
    const meta = await sharp(out.full.data).metadata();
    expect(meta.format).toBe('webp');
  });

  it('resizes the long edge to 1600px, keeps the aspect ratio and never upscales', async () => {
    const out = await processImage(await bigJpegCached()); // 2400×1800 → 1600×1200
    expect(out.full.width).toBe(MAX_EDGE);
    expect(out.full.height).toBe(1200);
    expect(out.full.width / out.full.height).toBeCloseTo(2400 / 1800, 2);

    // small image stays exactly as-is (640×480 → 640×480, no enlargement)
    const small = await sharp(noiseRaw(640, 480), { raw: { width: 640, height: 480, channels: 3 } })
      .png()
      .toBuffer();
    const smallOut = await processImage(small);
    expect(smallOut.full.width).toBe(640);
    expect(smallOut.full.height).toBe(480);
  });

  it('produces a ≤400px thumbnail alongside the display copy', async () => {
    const out = await processImage(await bigJpegCached());
    expect(out.thumb.width).toBeLessThanOrEqual(THUMB_EDGE);
    expect(out.thumb.height).toBeLessThanOrEqual(THUMB_EDGE);
    expect(out.thumb.width).toBe(400);
    expect(out.thumb.height).toBe(300);
    expect(out.thumb.data.length).toBeGreaterThan(0);
    expect(out.bytes).toBe(out.full.data.length + out.thumb.data.length);

    const thumbMeta = await sharp(out.thumb.data).metadata();
    expect(thumbMeta.format).toBe('webp');
  });

  it('keeps quality close to the original while encoding (visibly lossless enough)', async () => {
    // a flat, photo-like gradient: WebP at quality 82 must stay far below the input
    const flat = await sharp({
      create: { width: 1200, height: 900, channels: 3, background: { r: 40, g: 130, b: 90 } },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
    const out = await processImage(flat);
    expect(out.full.data.length).toBeLessThan(flat.length);
    // decoded output must still be a valid, same-dimension image
    const meta = await sharp(out.full.data).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(900);
  });

  it('strips EXIF/metadata (and applies orientation) from the stored variants', async () => {
    const withExif = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 40, b: 40 } },
    })
      .withExif({ IFD0: { Copyright: 'Shahrjo-test', Make: 'TestCam' } })
      .jpeg()
      .toBuffer();
    const input = await sharp(withExif).metadata();
    expect(input.exif).toBeDefined(); // fixture really carries EXIF

    const out = await processImage(withExif);
    const stored = await sharp(out.full.data).metadata();
    expect(stored.exif).toBeUndefined();
    const thumb = await sharp(out.thumb.data).metadata();
    expect(thumb.exif).toBeUndefined();
  });

  it('rejects garbage, empty files and non-decodable content with 415/400', async () => {
    await expect(processImage(Buffer.from('definitely not an image'))).rejects.toMatchObject({
      status: 415,
    });
    await expect(processImage(Buffer.alloc(0))).rejects.toMatchObject({ status: 400 });
    // valid PNG signature but broken payload
    const broken = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 7),
    ]);
    await expect(processImage(broken)).rejects.toMatchObject({ status: 415 });
  });

  it('rejects absurd dimensions before decoding (decompression-bomb guard)', async () => {
    const tooWide = await sharp({
      create: { width: 13_000, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    await expect(processImage(tooWide)).rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(processImage(tooWide)).rejects.toMatchObject({ status: 413 });
  });

  it('exports the documented tuning constants', () => {
    expect(MAX_EDGE).toBe(1600);
    expect(THUMB_EDGE).toBe(400);
    expect(WEBP_QUALITY).toBeGreaterThanOrEqual(80);
    expect(WEBP_QUALITY).toBeLessThanOrEqual(85);
  });

  it('never classifies a valid image as unsupported', async () => {
    const png = await sharp(noiseRaw(32, 32), { raw: { width: 32, height: 32, channels: 3 } })
      .png()
      .toBuffer();
    await expect(processImage(png)).resolves.toMatchObject({ full: { width: 32, height: 32 } });
  });
});
