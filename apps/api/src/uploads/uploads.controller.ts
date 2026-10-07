import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { MAX_UPLOAD_BYTES, MAX_VOICE_BYTES, UploadsService } from './uploads.service';

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

  /**
   * Store one voice note for the city wall chat (Phase 10): 5 MB cap,
   * magic-byte sniffing (WebM/OGG/M4A/MP3/WAV), random storage key, no
   * re-encoding — the bytes are already compressed and must stay playable.
   */
  @Post('uploads/voice')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_VOICE_BYTES, files: 1 },
    }),
  )
  uploadVoice(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایل صوتی الزامی است');
    return this.uploads.saveVoice(user, file);
  }
}
