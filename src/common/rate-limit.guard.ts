import { HttpException, HttpStatus, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Simple in-memory rate limit per client IP (plus an optional extra key, e.g. the login email).
 * Stops bots from flooding the lead form with spam leads and from guessing admin passwords.
 * Fine for a single backend instance; use Redis if the API ever runs on several servers.
 *
 *   @UseGuards(new RateLimitGuard('leads', [{ limit: 5, windowMs: 60_000 }, { limit: 30, windowMs: 86_400_000 }]))
 */
export type Rule = { limit: number; windowMs: number };

const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 10 * 60_000) return;
  lastSweep = now;
  for (const [k, hits] of buckets) if (!hits.length || now - hits[hits.length - 1] > 86_400_000) buckets.delete(k);
}

export function clientIp(req: Request) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly name: string,
    private readonly rules: Rule[],
    private readonly extraKey?: (req: Request) => string | undefined,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const now = Date.now();
    sweep(now);
    const extra = this.extraKey?.(req);
    const key = `${this.name}:${clientIp(req)}${extra ? `:${extra.toLowerCase()}` : ''}`;
    const longest = Math.max(...this.rules.map((r) => r.windowMs));
    const hits = (buckets.get(key) ?? []).filter((t) => now - t < longest);
    for (const r of this.rules) {
      if (hits.filter((t) => now - t < r.windowMs).length >= r.limit) {
        buckets.set(key, hits);
        throw new HttpException('Too many requests. Please wait a little and try again, or call / WhatsApp us.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    hits.push(now);
    buckets.set(key, hits);
    return true;
  }
}
