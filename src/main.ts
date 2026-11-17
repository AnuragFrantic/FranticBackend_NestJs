import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { UPLOAD_DIR } from './media/media.controller.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // JSON bodies (service pages can be large). Images are uploaded as files, not JSON.
  app.useBodyParser('json', { limit: '2mb' });

  // Uploaded images are plain files in Backend/uploads, served at /uploads/<file>
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads/', maxAge: '30d' });

  // Allow the AdminPanel and Website to call this API
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`Frantic API running on http://localhost:${port}`);
}
await bootstrap();
