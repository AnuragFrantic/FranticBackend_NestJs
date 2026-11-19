import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { UPLOAD_DIR } from './media/media.controller.js';
import dns from 'node:dns';
import fs from 'node:fs';

if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(','));
}

// Refuse to start in production with the example secrets — anyone could log into the admin panel
// and change the website (spam links, redirects), which gets the site penalised by Google and ads disapproved.
function checkProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  const jwt = process.env.JWT_SECRET ?? '';
  if (jwt.length < 32 || /change-me|dev-only/i.test(jwt)) problems.push('JWT_SECRET must be a long random string (32+ characters)');
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123') problems.push('ADMIN_PASSWORD must not be the default');
  if (!process.env.MONGODB_URI) problems.push('MONGODB_URI is required (otherwise leads live only in memory and are lost on restart)');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) console.warn('WARNING: SMTP_USER / SMTP_PASS empty — lead emails will NOT be sent.');
  if (problems.length) {
    console.error('Refusing to start:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
}

// Optional HTTPS directly in Node (no Nginx). Set both paths in .env, e.g. Let's Encrypt:
//   SSL_KEY_PATH=/etc/letsencrypt/live/frush.franticpro.com/privkey.pem
//   SSL_CERT_PATH=/etc/letsencrypt/live/frush.franticpro.com/fullchain.pem
// Leave them empty for plain HTTP (local dev, or behind Nginx which handles HTTPS).
// After certbot renews the certificate, restart the app so it loads the new files.
function httpsOptions() {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;
  if (!keyPath || !certPath) return undefined;
  return {
    key: fs.readFileSync(keyPath, 'utf-8'),
    cert: fs.readFileSync(certPath, 'utf-8'),
  };
}

async function bootstrap() {
  checkProductionSecrets();
  const ssl = httpsOptions();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, ssl ? { httpsOptions: ssl } : {});

  // Behind a proxy / load balancer (Nginx, Render, Cloudflare…) the real visitor IP is in X-Forwarded-For.
  // Needed for lead IPs and the rate limits. TRUST_PROXY=1 (default) trusts one proxy hop; 0 turns it off.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.disable('x-powered-by');

  // Basic security headers for every API response
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // the website shows /uploads images
    next();
  });

  // JSON bodies (service pages can be large). Images are uploaded as files, not JSON.
  app.useBodyParser('json', { limit: '2mb' });

  // Uploaded images are plain files in Backend/uploads, served at /uploads/<file>
  // The sandbox CSP stops scripts hidden inside an uploaded SVG from running if someone opens the file directly.
  app.useStaticAssets(UPLOAD_DIR, {
    prefix: '/uploads/',
    maxAge: '30d',
    setHeaders: (res) => {
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  // Allow the AdminPanel and Website to call this API
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`Frantic API running on ${ssl ? 'https' : 'http'}://localhost:${port}`);
}
await bootstrap();
