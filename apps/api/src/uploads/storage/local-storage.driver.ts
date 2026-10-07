import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import type { PutOptions, StorageDriver, StoredObjectInfo } from './storage.types';

/**
 * Local driver: objects live under `STORAGE_LOCAL_DIR` (the shahrjo_uploads
 * Docker volume today). Every path is resolved against the root and must stay
 * inside it — a key containing `../` can never escape the volume.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly root: string;
  private readonly publicBase: string;

  constructor(root: string, publicBase = '') {
    this.root = resolve(root);
    this.publicBase = publicBase.trim().replace(/\/+$/, '');
  }

  /** Resolve a key to an absolute path inside the volume (or throw). */
  private safePath(key: string): string {
    if (!key || key.includes('\0')) throw new Error('invalid storage key');
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`storage key escapes the volume: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer, options: PutOptions = {}): Promise<number> {
    const full = this.safePath(key);
    await mkdir(join(full, '..'), { recursive: true });
    // 'wx': never silently overwrite an existing object (content-addressed keys)
    await writeFile(full, data, { flag: options.overwrite ? 'w' : 'wx' });
    return data.length;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.safePath(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.safePath(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.safePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix = ''): Promise<StoredObjectInfo[]> {
    const base = prefix ? this.safePath(prefix) : this.root;
    const out: StoredObjectInfo[] = [];

    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // directory does not exist yet — nothing to list
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.isFile()) {
          const info = await stat(full).catch(() => null);
          if (!info) continue;
          out.push({
            key: full.slice(this.root.length + 1).split(sep).join('/'),
            size: info.size,
            mtimeMs: info.mtimeMs,
          });
        }
      }
    };

    await walk(base);
    return out;
  }

  url(key: string): string {
    return this.publicBase ? `${this.publicBase}/${key}` : `/api/v1/files/${key}`;
  }
}

/** Random content key — the client's filename is never part of the path. */
export function randomStorageKey(prefix: string, ext: string): string {
  return `${prefix}/${randomBytes(12).toString('hex')}.${ext}`;
}
