import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type TokenPayload = { sub: string; email: string; role: string };
export type AuthedRequest = Request & { user: TokenPayload };

/** Lets a request through only with a valid "Authorization: Bearer <token>" header */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Please log in');
    try {
      req.user = await this.jwt.verifyAsync<TokenPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Session expired, please log in again');
    }
  }
}
