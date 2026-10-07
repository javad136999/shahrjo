import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { MAX_UPLOAD_BYTES, UploadsService } from './uploads.service';

@Controller()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Store one image (multipart field `file`) and return its media id + url
   * plus a `thumbUrl` for lists. No `storage` option = multer's default
   * memory storage; multer caps the stream at MAX_UPLOAD_BYTES (10 MB) and
   * UploadsService re-checks size + magic bytes before processing with sharp
   * (WebP ≤1600px + ≤400px thumbnail — the original bytes are never stored).
   */
  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  upload(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایل تصویر الزامی است');
    return this.uploads.save(user, file);
  }
}
