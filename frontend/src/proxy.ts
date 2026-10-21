import createMiddleware from 'next-intl/middleware';

import type { NextRequest, NextResponse } from 'next/server';

import { routing } from './i18n/routing';
import { adminProxy } from './lib/api/admin-proxy';

/**
 * Next 16 proxy (formerly middleware):
 *  - /admin/**  → the admin session (src/lib/api/admin-proxy.ts): refreshes an expired access token
 *                 once, sends page loads without a session to /admin/login. The admin lives outside
 *                 the locale tree (RU only), so next-intl never sees it.
 *  - everything else → next-intl locale routing: "/" is served as ru (internal rewrite
 *                 to /ru), "/en/..." as en.
 */
const intlProxy = createMiddleware(routing);

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return adminProxy(request);
  return intlProxy(request);
}

export const config = {
  // Run on everything EXCEPT:
  //  - /api…, /admin/api… (route handlers: POST /api/leads, the admin media API — they check access
  //    themselves; uploads must not be buffered by the proxy, see proxyClientMaxBodySize)
  //  - /media…   (media files: proxied to the backend, src/app/media/[...key] route handler)
  //  - /brand…   (static brand assets in public/brand)
  //  - /_next…, /_vercel…
  //  - any path containing a dot (files: favicon.ico, robots.txt, sitemap.xml, *.svg …)
  // Such a path that is no file or route (/index.html, /brandbook) gets the localized 404 through
  // next.config's afterFiles rewrite (src/i18n/locale-fallback.ts), not through next-intl.
  matcher: ['/((?!api|admin/api|media/|brand|_next|_vercel|.*\\..*).*)'],
};
