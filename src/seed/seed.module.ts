import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { UsersModule } from '../users/users.module.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [ContentModule, UsersModule],
  providers: [SeedService],
})
export class SeedModule {}
