import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { UsersService } from './users.service.js';

// Admin users. Only Super Admin / Admin can manage users.
@Controller('admin/users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  private onlyAdmins(req: AuthedRequest) {
    if (!['super_admin', 'admin'].includes(req.user.role)) {
      throw new ForbiddenException('Only admins can manage users');
    }
  }

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: Record<string, never>) {
    this.onlyAdmins(req);
    return this.users.create(body);
  }

  @Patch(':id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: Record<string, never>) {
    this.onlyAdmins(req);
    return this.users.update(id, body);
  }

  @Delete(':id')
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    this.onlyAdmins(req);
    if (req.user.sub === id) throw new ForbiddenException('You cannot delete yourself');
    await this.users.remove(id);
    return { ok: true };
  }
}
