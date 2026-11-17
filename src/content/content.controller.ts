import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { ContentService, SETTINGS } from './content.service.js';

/**
 * Admin API used by the AdminPanel (login required).
 *
 *   GET    /admin/settings/:name     home | site
 *   PUT    /admin/settings/:name
 *   GET    /admin/:resource          e.g. /admin/servicePages
 *   GET    /admin/:resource/:id
 *   POST   /admin/:resource
 *   PATCH  /admin/:resource/:id
 *   DELETE /admin/:resource/:id
 */
@Controller('admin')
@UseGuards(AuthGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  // settings routes come first so "settings" isn't treated as a resource
  @Get('settings/:name')
  getSetting(@Param('name') name: string) {
    this.checkSetting(name);
    return this.content.getSetting(this.settingKey(name));
  }

  @Put('settings/:name')
  saveSetting(@Param('name') name: string, @Body() body: Record<string, unknown>) {
    this.checkSetting(name);
    return this.content.saveSetting(this.settingKey(name), body);
  }

  @Get(':resource')
  list(@Param('resource') resource: string) {
    return this.content.list(resource);
  }

  @Get(':resource/:id')
  get(@Param('resource') resource: string, @Param('id') id: string) {
    return this.content.get(resource, id);
  }

  @Post(':resource')
  create(@Param('resource') resource: string, @Body() body: Record<string, unknown>) {
    return this.content.create(resource, body);
  }

  @Patch(':resource/:id')
  update(@Param('resource') resource: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.content.update(resource, id, body);
  }

  @Delete(':resource/:id')
  remove(@Param('resource') resource: string, @Param('id') id: string) {
    return this.content.remove(resource, id);
  }

  // The admin calls the site settings "settings"; they are stored under "site".
  private settingKey(name: string) {
    return name === 'settings' ? 'site' : name;
  }

  private checkSetting(name: string) {
    if (!(SETTINGS as readonly string[]).includes(this.settingKey(name))) {
      throw new NotFoundException(`Unknown setting "${name}"`);
    }
  }
}
