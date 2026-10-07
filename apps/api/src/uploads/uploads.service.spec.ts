import { mkdtempSync, rmSync } from 'node:fs';
import { utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import sharp from 'sharp';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageDriver } from './storage/storage.types';
import { LocalStorageDriver } from './storage/local-storage.driver';
import {
  MAX_BYTES_PER_USER,
  MAX_UPLOAD_BYTES,
  MAX_VOICE_BYTES,
  UploadsService,
  sniffAudio,
  sniffImage,
  thumbKeyFor,
  thumbUrlFor,
} from './uploads.service';

const user = { id: 4, phone: '09120000000' } as User;

// sharp encode/decode is CPU-bound — never let a loaded machine flake a test
jest.setTimeout(60_000);

const roots: string[] = [];

interface PrismaMock {
  media: {
    count: jest.Mock;
    create: jest.Mock;
    aggregate: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  ad: { findMany: jest.Mock };
  wallPost: { findMany: jest.Mock };
}

function makeService(
  opts: {
    recent?: number;
    used?: number;
    trash?: unknown[];
    unclaimed?: unknown[];
    attached?: unknown[];
    mediaRows?: { storageKey: string; mimeType?: string }[];
    aliveAds?: { id: number }[];
    alivePosts?: { id: number }[];
  } = {},
): { service: UploadsService; prisma: PrismaMock; storage: LocalStorageDriver; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'shahrjo-up-'));
  roots.push(root);
  const storage = new LocalStorageDriver(root, '');

  const prisma: PrismaMock = {
    media: {
      count: jest.fn().mockResolvedValue(opts.recent ?? 0),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 55, url: (data.url as string) ?? '' }),
      ),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { sizeBytes: opts.used ?? 0 }, _count: { id: 0 } }),
      // dispatch on the WHERE shape instead of call order — robust against
      // future reordering of the sweep steps
      findMany: jest.fn(({ where }: { where?: Record<string, unknown> }) => {
        if (!where) return Promise.resolve(opts.mediaRows ?? []); // step 4: referenced keys
        if ((where.deletedAt as { lt?: Date } | undefined)?.lt) {
          return Promise.resolve(opts.trash ?? []); // step 1
        }
        if (where.entityId === null) return Promise.resolve(opts.unclaimed ?? []); // step 2
        if (where.entityId && typeof where.entityId === 'object') {
          return Promise.resolve(opts.attached ?? []); // step 3
        }
        return Promise.resolve([]);
      }),
      delete: jest.fn().mockResolvedValue({ id: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ad: { findMany: jest.fn().mockResolvedValue(opts.aliveAds ?? []) },
    wallPost: { findMany: jest.fn().mockResolvedValue(opts.alivePosts ?? []) },
  };

  const service = new UploadsService(
    prisma as unknown as PrismaService,
    {} as ConfigService,
    storage,
  );
  return { service, prisma, storage, root };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop() as string, { recursive: true, force: true });
});

/** A real, decodable photo-like JPEG (flat gradient — compresses well). */
async function jpeg(width = 2000, height = 1500): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);

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

describe('sniffAudio — voice notes judged by magic bytes (Phase 10)', () => {
  it('accepts exactly what browsers record or upload', () => {
    // MediaRecorder in Chrome/Firefox (Matroska/WebM)
    expect(sniffAudio(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]))).toEqual({
      mime: 'audio/webm',
      ext: 'webm',
    });
    expect(sniffAudio(Buffer.from('OggS....'))).toEqual({ mime: 'audio/ogg', ext: 'ogg' });
    expect(
      sniffAudio(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt')])),
    ).toEqual({ mime: 'audio/wav', ext: 'wav' });
    // MediaRecorder in Safari (ISO-BMFF audio/mp4)
    expect(sniffAudio(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A ')]))).toEqual({
      mime: 'audio/mp4',
      ext: 'm4a',
    });
    // MP3 with an ID3 tag and with a raw frame sync
    expect(sniffAudio(Buffer.from('ID3\u0004'))).toEqual({ mime: 'audio/mpeg', ext: 'mp3' });
    expect(sniffAudio(Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toEqual({
      mime: 'audio/mpeg',
      ext: 'mp3',
    });
  });

  it('rejects images, markup and empty buffers (forged .mp3 names)', () => {
    expect(sniffAudio(png)).toBeNull();
    expect(sniffAudio(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeNull();
    expect(sniffAudio(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(sniffAudio(Buffer.alloc(0))).toBeNull();
  });
});

describe('UploadsService.saveVoice — wall voice notes (Phase 10)', () => {
  it('stores the bytes untouched under a random voice/ key with an unclaimed WALL row', async () => {
    const { service, prisma, storage } = makeService();
    const input = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 7)]);

    const result = await service.saveVoice(user, { buffer: input, size: input.length });

    const files = await storage.list();
    expect(files).toHaveLength(1);
    expect(files[0].key).toMatch(/^voice\/\d{4}\/\d{2}\/[0-9a-f]{24}\.webm$/);
    const stored = await storage.get(files[0].key);
    expect(stored?.equals(input)).toBe(true); // audio is never re-encoded

    expect(prisma.media.create.mock.calls[0][0].data).toMatchObject({
      mimeType: 'audio/webm',
      ownerUserId: 4,
      entityType: 'WALL',
      entityId: null, // claimed by the wall post right after it exists
      sizeBytes: input.length,
    });
    expect(result).toEqual({ id: 55, url: `/api/v1/files/${files[0].key}` });
  });

  it('400s empty input, 415s non-audio and 413s above the 5MB cap', async () => {
    const { service, storage } = makeService();
    await expect(service.saveVoice(user, undefined)).rejects.toMatchObject({ status: 400 });
    await expect(
      service.saveVoice(user, { buffer: png, size: png.length }),
    ).rejects.toMatchObject({ status: 415 });
    const big = Buffer.alloc(MAX_VOICE_BYTES + 1, 0);
    big.set([0x1a, 0x45, 0xdf, 0xa3]); // looks like a webm, still too big
    await expect(service.saveVoice(user, { buffer: big, size: big.length })).rejects.toMatchObject({
      status: 413,
    });
    expect(await storage.list()).toHaveLength(0);
  });

  it('429s after the per-user hourly upload cap', async () => {
    const { service } = makeService({ recent: 30 });
    const input = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
    await expect(service.saveVoice(user, { buffer: input, size: input.length })).rejects.toMatchObject({
      status: 429,
    });
  });

  it('removes the file when the DB row fails (no orphans)', async () => {
    const { service, prisma, storage } = makeService();
    prisma.media.create.mockRejectedValueOnce(new Error('db down'));
    const input = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]);
    await expect(service.saveVoice(user, { buffer: input, size: input.length })).rejects.toThrow(
      'db down',
    );
    expect(await storage.list()).toHaveLength(0);
  });
});

describe('thumb key/url derivation (frontend lists ↔ storage)', () => {
  it('derives the thumbnail key for new and legacy images', () => {
    expect(thumbKeyFor('media/2026/10/ab.webp')).toBe('media/2026/10/ab.thumb.webp');
    expect(thumbKeyFor('ads/2026/10/x.png')).toBe('ads/2026/10/x.thumb.webp');
    expect(thumbKeyFor('businesses/2026/01/y.jpg')).toBe('businesses/2026/01/y.thumb.webp');
  });

  it('derives the thumbnail URL and returns null for non-images', () => {
    expect(thumbUrlFor('/api/v1/files/media/2026/10/a.webp')).toBe(
      '/api/v1/files/media/2026/10/a.thumb.webp',
    );
    expect(thumbUrlFor('/api/v1/files/ads/x.png')).toBe('/api/v1/files/ads/x.thumb.webp');
    expect(thumbUrlFor('/api/v1/files/no-extension')).toBeNull();
    expect(thumbUrlFor(null)).toBeNull();
  });
});

describe('UploadsService.save — processing pipeline', () => {
  it('stores a processed WebP + thumbnail under a random key and records metadata', async () => {
    const { service, prisma, storage } = makeService();
    const input = await jpeg();

    const result = await service.save(user, { buffer: input, size: input.length });

    // exactly two objects: display copy + thumbnail, both WebP under media/
    const files = await storage.list();
    expect(files).toHaveLength(2);
    const keys = files.map((f) => f.key).sort();
    expect(keys[0]).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f]{24}\.thumb\.webp$/);
    expect(keys[1]).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f]{24}\.webp$/);

    // the user's original JPEG bytes are nowhere on disk
    for (const f of files) {
      const stored = await storage.get(f.key);
      expect(stored?.equals(input)).toBe(false);
    }

    const data = prisma.media.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      mimeType: 'image/webp',
      ownerUserId: 4,
      entityType: 'AD',
      entityId: null,
      width: 1600, // resized down from 2000
      height: 1200,
    });
    expect(data.sizeBytes).toBe(files.reduce((sum, f) => sum + f.size, 0));
    expect(String(data.storageKey)).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f]{24}\.webp$/);

    // response carries both variants so lists can pick the small one
    expect(result.url).toBe(`/api/v1/files/${data.storageKey}`);
    expect(result.thumbUrl).toBe(thumbUrlFor(result.url));
    expect(result.thumbUrl).toContain('.thumb.webp');
    expect(result.id).toBe(55);
  });

  it('400s without a file, 415s on non-image content and on GIF', async () => {
    const { service } = makeService();
    await expect(service.save(user, undefined)).rejects.toMatchObject({ status: 400 });
    await expect(
      service.save(user, { buffer: Buffer.from('not an image'), size: 12 }),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      service.save(user, { buffer: Buffer.from('GIF89a....'), size: 9 }),
    ).rejects.toMatchObject({ status: 415 });
  });

  it('413s above the 10MB input cap even if multer was bypassed', async () => {
    const { service, storage } = makeService();
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0);
    big.set([0xff, 0xd8, 0xff]); // pretend it is a jpeg header
    await expect(service.save(user, { buffer: big, size: big.length })).rejects.toMatchObject({
      status: 413,
    });
    expect(await storage.list()).toHaveLength(0);
  });

  it('429s after the per-user hourly upload cap', async () => {
    const { service } = makeService({ recent: 30 });
    const input = await jpeg(64, 64);
    await expect(service.save(user, { buffer: input, size: input.length })).rejects.toMatchObject({
      status: 429,
    });
  });

  it('413s when the owner has exhausted the storage quota — before any disk write', async () => {
    const { service, prisma, storage } = makeService({ used: MAX_BYTES_PER_USER });
    const input = await jpeg(64, 64);
    await expect(service.save(user, { buffer: input, size: input.length })).rejects.toMatchObject({
      status: 413,
    });
    expect(prisma.media.create).not.toHaveBeenCalled();
    expect(await storage.list()).toHaveLength(0);
  });

  it('rejects at the quota boundary (existing usage + input = cap + 1 byte)', async () => {
    const input = await jpeg(64, 64);
    const { service, storage } = makeService({ used: MAX_BYTES_PER_USER - input.length + 1 });
    await expect(service.save(user, { buffer: input, size: input.length })).rejects.toMatchObject({
      status: 413,
    });
    expect(await storage.list()).toHaveLength(0); // rejected before decode/write
  });

  it('allows uploads while quota headroom remains', async () => {
    const input = await jpeg(64, 64);
    const { service } = makeService({ used: MAX_BYTES_PER_USER - 10 * 1024 * 1024 });
    await expect(service.save(user, { buffer: input, size: input.length })).resolves.toMatchObject({
      id: 55,
    });
  });

  it('removes already-written files when the DB row fails (no orphans)', async () => {
    const { service, prisma, storage } = makeService();
    prisma.media.create.mockRejectedValueOnce(new Error('db down'));
    const input = await jpeg(64, 64);

    await expect(service.save(user, { buffer: input, size: input.length })).rejects.toThrow('db down');
    expect(await storage.list()).toHaveLength(0); // both variants cleaned up
  });

  it('removes the first variant when writing the thumbnail fails (no temp leftovers)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'shahrjo-flaky-'));
    roots.push(root);
    const base = new LocalStorageDriver(root, '');
    const flaky: StorageDriver = {
      name: 'flaky',
      put: (key, data, options) =>
        key.includes('.thumb.')
          ? Promise.reject(new Error('disk full'))
          : base.put(key, data, options),
      get: (key) => base.get(key),
      delete: (key) => base.delete(key),
      exists: (key) => base.exists(key),
      list: (prefix) => base.list(prefix),
      url: (key) => base.url(key),
    };
    const prisma: PrismaMock = {
      media: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: 0 }, _count: { id: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      ad: { findMany: jest.fn() },
      wallPost: { findMany: jest.fn() },
    };
    const service = new UploadsService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      flaky,
    );

    const input = await jpeg(64, 64);
    await expect(service.save(user, { buffer: input, size: input.length })).rejects.toMatchObject({
      status: 502,
    });
    expect(await base.list()).toHaveLength(0);
    expect(prisma.media.create).not.toHaveBeenCalled();
  });
});

describe('UploadsService.purgeEntity — files follow their entity', () => {
  it('deletes both variants and the Media rows for an entity', async () => {
    const { service, prisma, storage } = makeService();
    const key = 'media/2026/10/abcdefabcdefabcdefabcdef.webp';
    await storage.put(key, Buffer.from('full'));
    await storage.put(thumbKeyFor(key), Buffer.from('thumb'));
    prisma.media.findMany.mockResolvedValue([{ id: 9, storageKey: key }]);
    prisma.media.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.purgeEntity('AD', 5);

    expect(result).toEqual({ removed: 1 });
    expect(await storage.list()).toHaveLength(0);
    expect(prisma.media.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [9] } } });
  });

  it('is a no-op when the entity has no media', async () => {
    const { service, prisma } = makeService();
    const result = await service.purgeEntity('AD', 404);
    expect(result).toEqual({ removed: 0 });
    expect(prisma.media.deleteMany).not.toHaveBeenCalled();
  });
});

describe('UploadsService.sweep — disk-fill protection', () => {
  it('hard-deletes unclaimed uploads past 48h: files gone, row gone, bytes freed', async () => {
    const key = 'media/2026/10/0badc0ffeebadc0ffeebadc0ffe.webp';
    const { service, prisma, storage } = makeService({
      unclaimed: [{ id: 1, storageKey: key, sizeBytes: 2048 }],
    });
    await storage.put(key, Buffer.alloc(2048, 1));
    await storage.put(thumbKeyFor(key), Buffer.alloc(100, 2));

    const result = await service.sweep();

    expect(result).toEqual({ removedFiles: 2, freedBytes: 2048, thumbsCreated: 0 });
    expect(prisma.media.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(await storage.list()).toHaveLength(0);
  });

  it('unlinks orphan files no Media row references but keeps referenced ones (incl. thumbs)', async () => {
    const keptKey = 'media/2026/10/keepkeepkeepkeepkeepkeep.webp';
    const { service, storage } = makeService({ mediaRows: [{ storageKey: keptKey }] });
    await storage.put(keptKey, Buffer.from('kept-full'));
    await storage.put(thumbKeyFor(keptKey), Buffer.from('kept-thumb'));
    const orphan = 'media/2026/10/orphanorphanorphanorphan.webp';
    await storage.put(orphan, Buffer.alloc(500, 3));
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    await utimes(join(roots[roots.length - 1], orphan), threeDaysAgo, threeDaysAgo);

    const result = await service.sweep();

    expect(result.removedFiles).toBe(1);
    expect(result.freedBytes).toBe(500);
    expect(await storage.exists(orphan)).toBe(false);
    expect(await storage.exists(keptKey)).toBe(true);
    expect(await storage.exists(thumbKeyFor(keptKey))).toBe(true);
  });

  it('keeps fresh files (possible in-flight uploads) untouched', async () => {
    const fresh = 'media/2026/10/inflightinflightinflig.webp';
    const { service, storage } = makeService();
    await storage.put(fresh, Buffer.alloc(10, 9)); // mtime = now → inside the 48h guard

    const result = await service.sweep();

    expect(result.removedFiles).toBe(0);
    expect(await storage.exists(fresh)).toBe(true);
  });

  it('purges media whose ad no longer exists, and keeps media of live ads', async () => {
    // (a) ad 5 was deleted → its media must go
    const deadKey = 'media/2026/10/deaddeaddeaddeaddeaddead.webp';
    const dead = makeService({
      attached: [{ id: 2, storageKey: deadKey, sizeBytes: 111, entityType: 'AD', entityId: '5' }],
      aliveAds: [],
    });
    await dead.storage.put(deadKey, Buffer.from('x'));
    const first = await dead.service.sweep();
    expect(first.removedFiles).toBe(1);
    expect(dead.prisma.media.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(await dead.storage.exists(deadKey)).toBe(false);

    // (b) ad 7 still exists → media stays
    const aliveKey = 'media/2026/10/alivealivealivealivealive.webp';
    const alive = makeService({
      attached: [{ id: 3, storageKey: aliveKey, sizeBytes: 222, entityType: 'AD', entityId: '7' }],
      aliveAds: [{ id: 7 }],
    });
    await alive.storage.put(aliveKey, Buffer.from('y'));
    const second = await alive.service.sweep();
    expect(second.removedFiles).toBe(0);
    expect(await alive.storage.exists(aliveKey)).toBe(true);
  });

  it('backfills missing thumbnails for legacy images', async () => {
    const legacy = 'legacy/2026/08/old-photo.jpg';
    const { service, storage } = makeService({
      mediaRows: [{ storageKey: legacy, mimeType: 'image/jpeg' }],
    });
    await storage.put(legacy, await jpeg(640, 480)); // a real, processable image

    const result = await service.sweep();

    expect(result.thumbsCreated).toBe(1);
    expect(await storage.exists(thumbKeyFor(legacy))).toBe(true);
    expect(await storage.exists(legacy)).toBe(true); // original kept (it is referenced)
  });

  it('never tries to thumbnail audio (voice notes stay untouched)', async () => {
    const voice = 'voice/2026/10/abcdefabcdefabcdefabcdef.webm';
    const { service, storage } = makeService({
      mediaRows: [{ storageKey: voice, mimeType: 'audio/webm' }],
    });
    await storage.put(voice, Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));

    const result = await service.sweep();

    expect(result.thumbsCreated).toBe(0);
    expect(await storage.exists(voice)).toBe(true);
    expect(await storage.exists(`${voice}.thumb.webp`)).toBe(false);
  });

  it('reports usage with both quotas for the admin panel', async () => {
    const { service } = makeService({ used: 1234 });
    // aggregate mock returns _count.id = 0; override for a richer figure
    const overview = await service.overview();
    expect(overview).toEqual({
      usedBytes: 1234,
      fileCount: 0,
      perUserQuotaBytes: MAX_BYTES_PER_USER,
      perFileQuotaBytes: MAX_UPLOAD_BYTES,
    });
  });
});
