import type { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { adminProxyGate } from "./lib/admin/proxy-gate";

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
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminProxyGate(request);
  return intlProxy(request);
}

export const config = {
  // Run on everything EXCEPT:
  //  - /api…, /admin/api… (route handlers: POST /api/leads, the admin media API — they check access themselves)
  //  - /uploads… (user/seed media, served by Caddy or src/app/uploads route)
  //  - /brand…   (static brand assets in public/brand)
  //  - /_next…, /_vercel…
  //  - any path containing a dot (files: favicon.ico, robots.txt, sitemap.xml, *.svg …)
  matcher: ["/((?!api|admin/api|uploads|brand|_next|_vercel|.*\\..*).*)"],
};
