import createMiddleware from 'next-intl/middleware';

import type { NextRequest, NextResponse } from 'next/server';

import { routing } from './i18n/routing';
import { adminProxyGate } from './lib/admin/proxy-gate';

/**
 * Next 16 proxy (formerly middleware):
 *  - /admin/**  → optimistic password gate (src/lib/admin/proxy-gate.ts); the admin lives
 *                 outside the locale tree (RU only), so next-intl never sees it.
 *  - everything else → next-intl locale routing: "/" is served as ru (internal rewrite
 *                 to /ru), "/en/..." as en.
 */
const intlProxy = createMiddleware(routing);

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return adminProxyGate(request);
  return intlProxy(request);
}

export const config = {
  // Run on everything EXCEPT:
  //  - /api…, /admin/api… (route handlers: POST /api/leads, the admin media API — they check access themselves)
  //  - /media…   (uploads + seed media from S3, src/app/media/[...key] route handler)
  //  - /brand…   (static brand assets in public/brand)
  //  - /_next…, /_vercel…
  //  - any path containing a dot (files: favicon.ico, robots.txt, sitemap.xml, *.svg …)
  // Such a path that is no file or route (/index.html, /brandbook) gets the localized 404 through
  // next.config's afterFiles rewrite (src/i18n/locale-fallback.ts), not through next-intl.
  matcher: ['/((?!api|admin/api|media/|brand|_next|_vercel|.*\\..*).*)'],
};
