import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { createStorageDriver } from './storage/storage.factory';
import { STORAGE_DRIVER } from './storage/storage.types';

/**
 * Storage abstraction (Phase 5/9): image uploads for ads, businesses,
 * showcase, avatars and products. The driver (Docker volume today, Arvan
 * Object Storage later) is resolved once here — services only see the
 * `StorageDriver` interface.
 */
@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createStorageDriver(config),
    },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
