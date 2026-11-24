import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Post,
  Req,
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
/** By extension too: some browsers/OSes send videos as "application/octet-stream" or "video/x-m4v". */
const EXT_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
};
const mimeOf = (file: { originalname: string; mimetype: string }) =>
  ALLOWED.includes(file.mimetype) ? file.mimetype : EXT_MIME[extname(file.originalname).toLowerCase()];

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
      fileFilter: (req, file, cb) => {
        if (mimeOf(file)) return cb(null, true);
        // remember why, so the admin sees a clear message instead of "no file"
        (req as { rejected?: string }).rejected = `${file.originalname} (${file.mimetype || 'unknown type'})`;
        cb(null, false);
      },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File, @Req() req?: { rejected?: string }) {
    if (!file) {
      throw new BadRequestException(
        req?.rejected
          ? `File type not supported: ${req.rejected}. Use PNG, JPG, WebP, GIF, SVG, PDF, or MP4 / WebM / MOV video.`
          : `Upload an image, PDF or video up to ${MAX_MB} MB`,
      );
    }
    return this.content.create('media', {
      name: file.originalname,
      file: file.filename,
      url: `/uploads/${file.filename}`, // relative — the admin and website add the API address
      alt: '',
      size: file.size,
      mime: mimeOf(file) ?? file.mimetype,
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
