import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Every root layout (a layout.tsx that renders its own <html>: the site's [locale] and the admin) has
 * an error boundary of its own next to it. Without one an error under it — typically the backend not
 * answering — ends in Next's built-in English page («This page couldn't load»), unbranded and with
 * HTTP 200 once the response is streaming. Error boundaries are Client Components.
 */

const APP = path.resolve(import.meta.dirname, '../src/app');

function layoutFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return layoutFiles(full);
    return name === 'layout.tsx' ? [full] : [];
  });
}

const rootLayouts = layoutFiles(APP).filter(file => /<html[\s>]/.test(readFileSync(file, 'utf8')));

function errorBoundaryOf(layout: string): string {
  const file = path.join(path.dirname(layout), 'error.tsx');
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

describe('error boundaries of the root layouts', () => {
  it('finds the root layouts (the site and the admin)', () => {
    expect(rootLayouts.map(file => path.relative(APP, path.dirname(file))).sort()).toEqual(['[locale]', 'admin']);
  });

  it.each(rootLayouts.map(file => [path.relative(APP, file), file]))('%s has a client error.tsx', (_name, layout) => {
    const boundary = errorBoundaryOf(layout);
    expect(boundary, 'error.tsx next to the root layout').not.toBe('');
    expect(boundary).toMatch(/^\s*(?:\/\*[\s\S]*?\*\/\s*)?['"]use client['"]/);
    expect(boundary).toMatch(/export default function/);
  });
});
