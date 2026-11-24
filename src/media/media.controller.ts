import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AuthGuard } from '../auth/auth.guard.js';
import { ContentService } from '../content/content.service.js';

/** Files are saved in the Backend/uploads folder and served at /uploads/<file> */
export const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];
const MAX_MB = 80;

/**
 *   POST   /admin/media/upload   (multipart, field "file")  -> media document
 *   DELETE /admin/media/:id      deletes the document and its file
 */
@Controller('admin/media')
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private readonly content: ContentService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        // unique, safe file name: <random>.<ext>
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: MAX_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException(`Upload an image, PDF or video up to ${MAX_MB} MB`);
    return this.content.create('media', {
      name: file.originalname,
      file: file.filename,
      url: `/uploads/${file.filename}`, // relative — the admin and website add the API address
      alt: '',
      size: file.size,
      mime: file.mimetype,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const doc = (await this.content.get('media', id)) as { file?: string };
    if (doc.file) {
      const path = join(UPLOAD_DIR, doc.file);
      if (path.startsWith(UPLOAD_DIR) && existsSync(path)) unlinkSync(path);
    }
    return this.content.remove('media', id);
  }
}
