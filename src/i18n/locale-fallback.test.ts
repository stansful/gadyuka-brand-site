import { readdirSync } from 'node:fs';
import path from 'node:path';

import {
  getRewrittenUrl,
  unstable_doesMiddlewareMatch,
  unstable_getResponseFromNextConfig,
} from 'next/experimental/testing/server';
import { describe, expect, it, vi } from 'vitest';

import nextConfig from '../../next.config';

// Only the proxy's matcher is under test, not next-intl's middleware.
vi.mock('next-intl/middleware', () => ({ default: () => () => undefined }));
const { config: proxyConfig } = await import('@/proxy');

const ORIGIN = 'https://gadyuka.test';

/** Where next.config's rewrites send `path` (null: not rewritten). Filesystem routes are not modelled. */
async function rewriteOf(path: string): Promise<string | null> {
  const response = await unstable_getResponseFromNextConfig({ url: `${ORIGIN}${path}`, nextConfig });
  const target = getRewrittenUrl(response);
  return target === null ? null : target.slice(ORIGIN.length);
}

describe('stray paths get the localized 404', () => {
  it('the proxy (next-intl) never sees paths with a dot or the skipped prefixes', () => {
    const proxied = (path: string): boolean => unstable_doesMiddlewareMatch({ config: proxyConfig, url: path });
    expect(proxied('/foo')).toBe(true);
    expect(proxied('/index.html')).toBe(false);
    expect(proxied('/price.pdf')).toBe(false);
    expect(proxied('/brandbook')).toBe(false);
  });

  it('puts them under the default locale, where [locale]/[...rest] renders not-found.tsx', async () => {
    await expect(rewriteOf('/index.html')).resolves.toBe('/ru/index.html');
    await expect(rewriteOf('/price.pdf?from=mail')).resolves.toBe('/ru/price.pdf?from=mail');
    await expect(rewriteOf('/catalog.php')).resolves.toBe('/ru/catalog.php');
    await expect(rewriteOf('/old/page.html')).resolves.toBe('/ru/old/page.html');
    await expect(rewriteOf('/brandbook')).resolves.toBe('/ru/brandbook');
    // A kept segment counts only as a whole segment.
    await expect(rewriteOf('/en.json')).resolves.toBe('/ru/en.json');
    await expect(rewriteOf('/admin.php')).resolves.toBe('/ru/admin.php');
  });

  it('leaves locale paths, the admin, media and Next.js internals alone', async () => {
    for (const path of [
      '/',
      '/ru',
      '/en',
      '/en/price.pdf',
      '/ru/catalog/x',
      '/admin/x.php',
      '/media/a.jpg',
      '/_next/x.js',
    ]) {
      await expect(rewriteOf(path), path).resolves.toBeNull();
    }
  });

  it('never shadows a dynamic route outside [locale] (afterFiles runs before the dynamic routes)', async () => {
    const app = path.resolve(import.meta.dirname, '../app');
    const hasDynamicSegment = (dir: string): boolean =>
      readdirSync(dir, { withFileTypes: true }).some(
        entry => entry.isDirectory() && (entry.name.startsWith('[') || hasDynamicSegment(path.join(dir, entry.name))),
      );
    const folders = readdirSync(app, { withFileTypes: true }).filter(
      entry => entry.isDirectory() && !entry.name.startsWith('[') && !entry.name.startsWith('('),
    );
    const dynamic = folders.filter(entry => hasDynamicSegment(path.join(app, entry.name))).map(entry => entry.name);
    expect(dynamic).toEqual(expect.arrayContaining(['admin', 'media']));
    for (const folder of dynamic) await expect(rewriteOf(`/${folder}/x.json`), folder).resolves.toBeNull();
  });
});
