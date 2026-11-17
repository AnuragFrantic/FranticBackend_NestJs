import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { MediaController } from './media.controller.js';

@Module({
  imports: [ContentModule],
  controllers: [MediaController],
})
export class MediaModule {}
