import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { User } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { MAX_BYTES_PER_USER, MAX_UPLOAD_BYTES, UploadsService, sniffImage } from './uploads.service';

const user = { id: 4, phone: '09120000000' } as User;

let root: string;

function makeService(overrides: { recent?: number; used?: number } = {}) {
  const prisma = {
    media: {
      count: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    ad: { findMany: jest.fn() },
  };
  prisma.media.count.mockResolvedValue(overrides.recent ?? 0);
  prisma.media.aggregate.mockResolvedValue({ _sum: { sizeBytes: overrides.used ?? 0 }, _count: { id: 0 } });
  prisma.media.findMany.mockResolvedValue([]);
  prisma.media.delete.mockResolvedValue({ id: 1 });
  prisma.ad.findMany.mockResolvedValue([]);
  prisma.media.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 55, url: (data.url as string) ?? '' }),
  );
  const config = {
    get: jest.fn((key: string) => (key === 'STORAGE_LOCAL_DIR' ? root : '')),
  };
  const service = new UploadsService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );
  return { service, prisma };
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'shahrjo-uploads-'));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

async function statOrNull(path: string): Promise<unknown> {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

/** Write a fixture file under the storage root (creating parent dirs). */
async function writeAt(rel: string): Promise<string> {
  const full = join(root, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, png);
  return full;
}

describe('sniffImage — magic bytes, never the client mimetype', () => {
  it('accepts jpg/png/webp/gif by signature', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(sniffImage(png)).toEqual({ mime: 'image/png', ext: 'png' });
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
    expect(sniffImage(webp)).toEqual({ mime: 'image/webp', ext: 'webp' });
    expect(sniffImage(Buffer.from('GIF89a....'))).toEqual({ mime: 'image/gif', ext: 'gif' });
  });

  it('rejects everything else (svg, html, plain text)', () => {
    expect(sniffImage(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from('<html><body>hi</body></html>'))).toBeNull();
    expect(sniffImage(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

describe('UploadsService.save', () => {
  it('stores a valid image under a random key and records Media metadata', async () => {
    const { service, prisma } = makeService();

    const result = await service.save(user, { buffer: png, size: png.length });

    expect(result.url).toMatch(/^\/api\/v1\/files\/ads\/\d{4}\/\d{2}\/[0-9a-f]{24}\.png$/);
    const data = prisma.media.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      mimeType: 'image/png',
      sizeBytes: png.length,
      ownerUserId: 4,
      entityType: 'AD',
      entityId: null,
    });
    expect(data.storageKey).toMatch(/^ads\/\d{4}\/\d{2}\/[0-9a-f]{24}\.png$/);
  });

  it('400s without a file and 415s on non-image content', async () => {
    const { service } = makeService();
    await expect(service.save(user, undefined)).rejects.toMatchObject({ status: 400 });
    await expect(service.save(user, { buffer: Buffer.from('not an image'), size: 12 })).rejects.toMatchObject({ status: 415 });
  });

  it('413s above the size cap even if multer was bypassed', async () => {
    const { service } = makeService();
    const big = Buffer.concat([png, Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0)]);
    await expect(service.save(user, { buffer: big, size: big.length })).rejects.toMatchObject({ status: 413 });
  });

  it('429s after the per-user hourly upload cap', async () => {
    const { service } = makeService({ recent: 30 });
    await expect(service.save(user, { buffer: png, size: png.length })).rejects.toMatchObject({ status: 429 });
  });

  it('413s when the owner has exhausted the total storage quota', async () => {
    const { service, prisma } = makeService({ used: MAX_BYTES_PER_USER });
    await expect(service.save(user, { buffer: png, size: png.length })).rejects.toMatchObject({ status: 413 });
    // nothing written to disk and no row created
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it('counts existing usage so a user exactly at the quota cannot add more', async () => {
    const { service } = makeService({ used: MAX_BYTES_PER_USER - png.length });
    // at the boundary the upload still fits
    await expect(service.save(user, { buffer: png, size: png.length })).resolves.toMatchObject({ id: 55 });
  });
});

describe('UploadsService.sweep (Phase 9 — disk-fill protection)', () => {
  it('deletes unclaimed uploads past 48h: file gone, row gone, bytes freed', async () => {
    const { service, prisma } = makeService();
    const key = 'ads/2026/10/ghost.png';
    await writeAt(key); // physical file exists under root
    // (1) trash → empty, (2) unclaimed → one row, (3) attached → empty, (4) referenced → empty
    prisma.media.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1, storageKey: key, sizeBytes: png.length }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.sweep();

    expect(prisma.media.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual({ removedFiles: 1, freedBytes: png.length });
    await expect(statOrNull(join(root, key))).resolves.toBeNull();
  });

  it('unlinks orphan files no Media row references, but keeps referenced ones', async () => {
    const { service, prisma } = makeService();
    const orphan = await writeAt('ads/2026/10/orphan.png');
    const kept = await writeAt('ads/2026/10/kept.png');
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    await utimes(orphan, threeDaysAgo, threeDaysAgo);
    await utimes(kept, threeDaysAgo, threeDaysAgo);
    // nothing soft-deleted/unclaimed/attached; only `kept.png` is referenced
    prisma.media.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ storageKey: 'ads/2026/10/kept.png' }]);

    const result = await service.sweep();

    expect(result.removedFiles).toBe(1);
    expect(result.freedBytes).toBe(png.length);
    await expect(statOrNull(orphan)).resolves.toBeNull();
    await expect(statOrNull(kept)).resolves.not.toBeNull();
  });

  it('keeps fresh files (possible in-flight uploads) untouched', async () => {
    const { service, prisma } = makeService();
    const fresh = await writeAt('ads/2026/10/fresh.png'); // mtime = now → younger than the 48h guard
    // nothing to purge; the leftover kept.png from the previous test is referenced
    prisma.media.findMany
      .mockResolvedValueOnce([]) // trash
      .mockResolvedValueOnce([]) // unclaimed
      .mockResolvedValueOnce([]) // attached
      .mockResolvedValueOnce([{ storageKey: 'ads/2026/10/kept.png' }]); // referenced keys

    const result = await service.sweep();

    expect(result.removedFiles).toBe(0);
    await expect(statOrNull(fresh)).resolves.not.toBeNull();
  });

  it('reports usage with both quotas for the admin panel', async () => {
    const { service } = makeService({ used: 1234 });
    const overview = await service.overview();
    expect(overview).toEqual({
      usedBytes: 1234,
      fileCount: 0,
      perUserQuotaBytes: MAX_BYTES_PER_USER,
      perFileQuotaBytes: MAX_UPLOAD_BYTES,
    });
  });
});
