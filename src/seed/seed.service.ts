import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContentService, RESOURCES } from '../content/content.service.js';
import { UPLOAD_DIR } from '../media/media.controller.js';
import { UsersService } from '../users/users.service.js';

/**
 * On start-up:
 *  1. if there are no users, create the first admin (ADMIN_EMAIL / ADMIN_PASSWORD)
 *  2. if there is no content yet, load seed/seed-data.json (the current homepage content);
 *     otherwise only add service pages from seed-data.json whose slug doesn't exist yet
 * Existing data is never overwritten.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    private readonly content: ContentService,
    private readonly users: UsersService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAdmin();
    await this.seedContent();
  }

  private async seedAdmin() {
    if ((await this.users.count()) > 0) return;
    const email = process.env.ADMIN_EMAIL || 'admin@franticpro.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    if (!process.env.ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD not set — using the default. Change it before going live!');
    await this.users.createFirstAdmin(email, password);
    console.log(`Created first admin user: ${email}`);
  }

  /** Starter images (project screens, tech & client logos) live in seed/images and are copied to uploads/ */
  private copySeedImages() {
    const from = join(process.cwd(), 'seed', 'images');
    if (!existsSync(from)) return;
    for (const file of readdirSync(from)) {
      const to = join(UPLOAD_DIR, file);
      if (!existsSync(to)) copyFileSync(join(from, file), to);
    }
  }

  private async seedContent() {
    this.copySeedImages();
    const file = join(process.cwd(), 'seed', 'seed-data.json');
    const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;

    // Database already has content: only add service pages that don't exist yet (matched by slug),
    // so new pages shipped in seed-data.json appear without touching anything edited in the admin.
    if ((await this.content.count('servicePages')) > 0) {
      let added = 0;
      for (const page of (data.servicePages as Record<string, unknown>[]) ?? []) {
        if (await this.content.findOne('servicePages', { slug: page.slug })) continue;
        await this.content.create('servicePages', page);
        added++;
      }
      if (added) console.log(`Added ${added} new service page(s) from seed-data.json`);
      return;
    }

    for (const resource of RESOURCES) {
      if (resource === 'leads') continue; // never seed sample leads
      const list = (data[resource] as Record<string, unknown>[]) ?? [];
      for (const doc of list) await this.content.create(resource, doc);
    }
    const settings = (data.settings ?? {}) as Record<string, Record<string, unknown>>;
    for (const [name, value] of Object.entries(settings)) await this.content.saveSetting(name, value);

    console.log('Seeded the database with the homepage content');
  }
}
