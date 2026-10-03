import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { UploadsService } from './uploads.service';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Store one image (multipart field `file`) and return its media id + url.
   * No `storage` option = multer's default memory storage; the buffer is
   * validated (magic bytes + size) and written to disk by UploadsService.
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
