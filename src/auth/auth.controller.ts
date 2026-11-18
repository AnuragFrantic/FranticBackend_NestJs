import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { AuthGuard, type AuthedRequest } from './auth.guard.js';
import { RateLimitGuard } from '../common/rate-limit.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /** POST /auth/login  { email, password } -> { accessToken, user } */
  @Post('login')
  @HttpCode(200)
  // stops password guessing: 10 tries per 15 minutes per IP + email, 50 per hour per IP
  @UseGuards(
    new RateLimitGuard('login', [{ limit: 10, windowMs: 15 * 60_000 }], (req) => String((req.body as { email?: string })?.email ?? '')),
    new RateLimitGuard('login-ip', [{ limit: 50, windowMs: 60 * 60_000 }]),
  )
  async login(@Body() body: { email?: string; password?: string }) {
    const user = body.email ? await this.users.findByEmail(body.email) : null;
    const ok = user && user.isActive && (await bcrypt.compare(body.password ?? '', user.passwordHash));
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = await this.jwt.signAsync({ sub: String(user._id), email: user.email, role: user.role });
    return { accessToken, user: this.users.toPublic(user.toObject()) };
  }

  /** GET /auth/me -> the logged-in user's token data */
  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    return req.user;
  }
}
