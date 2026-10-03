import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { User } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { MAX_UPLOAD_BYTES, UploadsService, sniffImage } from './uploads.service';

const user = { id: 4, phone: '09120000000' } as User;

let root: string;

function makeService(overrides: { recent?: number } = {}) {
  const prisma = {
    media: { count: jest.fn(), create: jest.fn() },
  };
  prisma.media.count.mockResolvedValue(overrides.recent ?? 0);
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
});
