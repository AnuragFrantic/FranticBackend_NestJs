import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { PublicController } from './public.controller.js';

@Module({
  imports: [ContentModule],
  controllers: [PublicController],
})
export class PublicModule {}
