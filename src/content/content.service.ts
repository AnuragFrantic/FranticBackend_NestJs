import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Schema, isValidObjectId } from 'mongoose';
import type { Connection, Model } from 'mongoose';

/**
 * Every content type the admin panel edits. Each one is a MongoDB collection.
 * To add a new content type: add its name here — that's it.
 */
export const RESOURCES = [
  'servicePages',
  'services',
  'caseStudies',
  'testimonials',
  'blogs',
  'faqs',
  'clients',
  'hireRoles',
  'industries',
  'technologies',
  'leads',
  'forms',
  'seo',
  'redirects',
  'media',
] as const;
export type Resource = (typeof RESOURCES)[number];

/** Single documents stored in the "settings" collection */
export const SETTINGS = ['home', 'site'] as const;

type Doc = Record<string, unknown>;

/**
 * One simple service for all content. Documents are flexible (no fixed schema),
 * so the admin panel decides the fields. createdAt/updatedAt are added automatically.
 */
@Injectable()
export class ContentService {
  constructor(@InjectConnection() private readonly db: Connection) {}

  model(resource: string): Model<Doc> {
    if (!(RESOURCES as readonly string[]).includes(resource) && resource !== 'settings') {
      throw new NotFoundException(`Unknown content type "${resource}"`);
    }
    return (
      (this.db.models[resource] as Model<Doc>) ??
      this.db.model<Doc>(resource, new Schema({}, { strict: false, timestamps: true, versionKey: false }), resource)
    );
  }

  private checkId(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid id');
  }

  /** remove fields the browser must not overwrite */
  private clean(data: Doc) {
    const { _id, createdAt, updatedAt, ...rest } = data ?? {};
    void _id; void createdAt; void updatedAt;
    return rest;
  }

  list(resource: string, filter: Doc = {}, sort: Record<string, 1 | -1> = { createdAt: -1 }) {
    return this.model(resource).find(filter).sort(sort).lean();
  }

  async get(resource: string, id: string) {
    this.checkId(id);
    const doc = await this.model(resource).findById(id).lean();
    if (!doc) throw new NotFoundException('Not found');
    return doc;
  }

  findOne(resource: string, filter: Doc) {
    return this.model(resource).findOne(filter).lean();
  }

  async create(resource: string, data: Doc) {
    const doc = await this.model(resource).create(this.clean(data));
    return doc.toObject();
  }

  async update(resource: string, id: string, data: Doc) {
    this.checkId(id);
    const doc = await this.model(resource).findByIdAndUpdate(id, { $set: this.clean(data) }, { new: true }).lean();
    if (!doc) throw new NotFoundException('Not found');
    return doc;
  }

  async remove(resource: string, id: string) {
    this.checkId(id);
    await this.model(resource).findByIdAndDelete(id);
    return { ok: true };
  }

  count(resource: string) {
    return this.model(resource).countDocuments();
  }

  /* ---------- settings (one document per name) ---------- */

  async getSetting(name: string) {
    const doc = await this.model('settings').findOne({ key: name }).lean();
    return (doc?.value as Doc) ?? {};
  }

  async saveSetting(name: string, value: Doc) {
    await this.model('settings').updateOne({ key: name }, { $set: { key: name, value } }, { upsert: true });
    return value;
  }
}
