import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { getMongoUri } from './database/mongo-uri.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ContentModule } from './content/content.module.js';
import { PublicModule } from './public/public.module.js';
import { SeedModule } from './seed/seed.module.js';
import { MediaModule } from './media/media.module.js';
import { MailModule } from './mail/mail.module.js';

@Module({
  imports: [
    // reads .env into process.env
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      useFactory: async () => ({ uri: await getMongoUri() }),
    }),

    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as '7d' },
    }),

    AuthModule, // POST /auth/login
    UsersModule, // /admin/users
    MailModule, // nodemailer — lead emails + PDF (SMTP settings in .env)
    MediaModule, // /admin/media/upload — images saved in Backend/uploads
    ContentModule, // /admin/:resource and /admin/settings/:name
    PublicModule, // /public/* — read by the website, no login
    SeedModule, // fills an empty database with the homepage content
  ],
})
export class AppModule {}
