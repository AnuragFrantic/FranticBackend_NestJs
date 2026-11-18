import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Ip, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { ContentService } from '../content/content.service.js';
import { LeadMailer } from '../mail/lead-mailer.service.js';
import { buildLeadSource } from './lead-source.js';

const published = { status: 'published' };
const byOrder = { order: 1 } as const;

/**
 * Public API read by the Website (no login).
 *
 *   GET  /public/home                    everything the homepage needs
 *   GET  /public/service-pages           published service pages (for sitemap + build)
 *   GET  /public/service-pages/:slug     one service page
 *   GET  /public/blogs                   published blog posts
 *   GET  /public/blogs/:slug             one blog post
 *   GET  /public/forms/:key              a form's fields (from Form Builder)
 *   GET  /public/redirects               301/302 redirects
 *   POST /public/leads                   website form submissions (saved + emailed to sales and the client)
 */
@Controller('public')
export class PublicController {
  constructor(
    private readonly content: ContentService,
    private readonly leadMailer: LeadMailer,
  ) {}

  @Get('home')
  async home() {
    const [home, site, services, caseStudies, testimonials, clients, industries, hireRoles, faqs, blogs, seo, technologies] =
      await Promise.all([
        this.content.getSetting('home'),
        this.content.getSetting('site'),
        this.content.list('services', published, byOrder),
        this.content.list('caseStudies', published, byOrder),
        this.content.list('testimonials', {}, byOrder),
        this.content.list('clients', {}, byOrder),
        this.content.list('industries', {}, byOrder),
        this.content.list('hireRoles', {}, byOrder),
        this.content.list('faqs', { page: 'home' }, byOrder),
        this.content.list('blogs', published, { publishedAt: -1 }),
        this.content.findOne('seo', { path: '/' }),
        this.content.list('technologies', {}, byOrder), // common "Technologies" section
      ]);
    return { home, site, services, caseStudies, testimonials, clients, industries, hireRoles, faqs, blogs, seo, technologies };
  }

  @Get('service-pages')
  servicePages() {
    return this.content.list('servicePages', published, { createdAt: 1 });
  }

  @Get('service-pages/:slug')
  async servicePage(@Param('slug') slug: string) {
    const page = await this.content.findOne('servicePages', { slug, ...published });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  /** published blog posts, newest first (listing page) */
  @Get('blogs')
  blogs() {
    return this.content.list('blogs', published, { publishedAt: -1 });
  }

  /** one published blog post (article page) */
  @Get('blogs/:slug')
  async blog(@Param('slug') slug: string) {
    const post = await this.content.findOne('blogs', { slug, ...published });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  /** a Form Builder form (fields shown on the website) */
  @Get('forms/:key')
  async form(@Param('key') key: string) {
    const form = await this.content.findOne('forms', { key, status: 'published' });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  @Get('redirects')
  redirects() {
    return this.content.list('redirects');
  }

  @Post('leads')
  @HttpCode(201)
  // spam protection: max 5 leads a minute and 30 a day from one IP
  @UseGuards(new RateLimitGuard('leads', [{ limit: 5, windowMs: 60_000 }, { limit: 30, windowMs: 86_400_000 }]))
  async createLead(
    @Body() body: Record<string, unknown>,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-forwarded-for') forwardedFor?: string,
  ) {
    // simple spam trap: real visitors never fill the hidden "website" field
    if (body.website) return { ok: true };

    const text = (k: string, max = 500) => String(body[k] ?? '').trim().slice(0, max);
    const lead = {
      formKey: text('formKey', 60) || 'get-quote',
      name: text('name', 120),
      email: text('email', 160),
      phone: text('phone', 40),
      company: text('company', 160),
      service: text('service', 160),
      budget: text('budget', 60),
      message: text('message', 3000),
      // page, form, referrer, UTM, ad click IDs, IPv4/IPv6, device… (see lead-source.ts)
      source: buildLeadSource(body, { ip, userAgent, forwardedFor }),
      status: 'new',
      notes: [],
    };
    if (!lead.name || !lead.phone || !/^\S+@\S+\.\S+$/.test(lead.email)) {
      throw new BadRequestException('Please enter your name, a valid email and phone number');
    }
    const saved = await this.content.create('leads', lead);
    // emails go out in the background, so the visitor doesn't wait for the mail server
    void this.leadMailer.leadReceived({ ...lead, _id: saved._id, createdAt: saved.createdAt as Date });
    return { ok: true };
  }
}
