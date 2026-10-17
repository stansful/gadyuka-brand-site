import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * /robots.txt — the admin (/admin…) and the API (/api/…) are never crawled.
 * (Local/dev origins are additionally marked noindex via page metadata.)
 * `host` is the Yandex main-mirror hint.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
