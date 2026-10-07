import { ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from './local-storage.driver';
import type { StorageDriver } from './storage.types';

/**
 * Picks the storage backend from `STORAGE_DRIVER`. Only `local` (the Docker
 * volume) ships today; enabling an object storage later means implementing
 * one more `StorageDriver` and adding its case here — no other code changes.
 * Unknown/unimplemented values fail fast instead of silently falling back.
 */
export function createStorageDriver(config: ConfigService): StorageDriver {
  const driver = (config.get<string>('STORAGE_DRIVER') ?? 'local').toLowerCase();

  switch (driver) {
    case 'local':
      return new LocalStorageDriver(
        config.get<string>('STORAGE_LOCAL_DIR') ?? './uploads',
        config.get<string>('STORAGE_PUBLIC_BASE_URL') ?? '',
      );
    case 's3':
    case 'arvan':
      throw new Error(
        `STORAGE_DRIVER="${driver}" is not implemented yet — only "local" ships today. ` +
          'Implement an S3-compatible StorageDriver and switch it on here.',
      );
    default:
      throw new Error(`Unknown STORAGE_DRIVER "${driver}" (expected local)`);
  }
}
