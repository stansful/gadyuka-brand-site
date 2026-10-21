import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guards what the frontend may import (runtime imports — `import type` is erased):
 * - display only: no module of src/ (server or client) imports a package of the backend's job —
 *   database, media storage and processing, validation schemas, tokens, env loading. Data, rules and
 *   validation live in the backend (../backend); the frontend calls it through src/lib/api;
 * - client bundles: no module reachable from a 'use client' file imports the ICU runtime (the
 *   server components format site templates, src/components/site/message-template.tsx; the
 *   client helpers are hand-written, src/components/site/labels.ts).
 */
const BACKEND_ONLY = [
  'zod',
  '@prisma/client',
  '@prisma/adapter-pg',
  'prisma',
  'pg',
  'sharp',
  '@aws-sdk/client-s3',
  'file-type',
  'jose',
  'dotenv',
  '@nestjs/common',
];
const FORBIDDEN = ['intl-messageformat', '@formatjs/icu-messageformat-parser'];

const SRC = path.resolve(import.meta.dirname, '../src');
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

/** True when the module starts with the `directive` ('use client' / 'use server'). */
function hasDirective(source: string, directive: string): boolean {
  return new RegExp(`^\\s*(?:\\/\\/[^\\n]*\\n|\\/\\*[\\s\\S]*?\\*\\/\\s*)*['"]${directive}['"]`).test(source);
}

/** Comments removed (good enough for finding import statements). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** `{ type A, type B }` (no default / namespace import) is erased like `import type`. */
function isTypeOnlyClause(clause: string): boolean {
  const trimmed = clause.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  const names = trimmed
    .slice(1, -1)
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);
  return names.length > 0 && names.every(name => name.startsWith('type '));
}

/** Specifiers of the runtime imports / re-exports / dynamic imports of a module. */
function runtimeImports(source: string): string[] {
  const code = stripComments(source);
  const out: string[] = [];
  for (const match of code.matchAll(/\b(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    const [, , typeKeyword, clause = '', specifier = ''] = match;
    if (typeKeyword || isTypeOnlyClause(clause)) continue;
    out.push(specifier);
  }
  for (const match of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(match[1] ?? '');
  for (const match of code.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) out.push(match[1] ?? '');
  return out;
}

/** A project file for a relative / "@/" specifier, else null (a package or a non-code file). */
function resolveLocal(specifier: string, from: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(from), specifier);
  else return null;
  if (/\.(ts|tsx)$/.test(base) && existsSync(base)) return base;
  for (const extension of EXTENSIONS) {
    if (existsSync(base + extension)) return base + extension;
  }
  return null;
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

/** Forbidden packages reachable from `entry`, each with the import chain that reaches it. */
function forbiddenReach(entry: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>([entry]);
  const queue: Array<{ file: string; chain: string[] }> = [{ file: entry, chain: [entry] }];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    for (const specifier of runtimeImports(readFileSync(next.file, 'utf8'))) {
      const local = resolveLocal(specifier, next.file);
      if (local) {
        // A Server Action module reaches the client as references only, never as code.
        if (!seen.has(local) && !hasDirective(readFileSync(local, 'utf8'), 'use server')) {
          seen.add(local);
          queue.push({ file: local, chain: [...next.chain, local] });
        }
      } else if (FORBIDDEN.includes(packageName(specifier))) {
        found.push([...next.chain.map(file => path.relative(SRC, file)), specifier].join(' → '));
      }
    }
  }
  return found;
}

describe('display only', () => {
  const files = sourceFiles(SRC);

  it('imports no package of the backend anywhere in src/', () => {
    const offenders = files.flatMap(file =>
      runtimeImports(readFileSync(file, 'utf8'))
        .filter(specifier => BACKEND_ONLY.includes(packageName(specifier)))
        .map(specifier => `${path.relative(SRC, file)} → ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it('declares none of them as a dependency', () => {
    const manifest: unknown = JSON.parse(readFileSync(path.join(SRC, '../package.json'), 'utf8'));
    const dependencies = ['dependencies', 'devDependencies'].flatMap(field =>
      Object.keys((Reflect.get(manifest as object, field) as Record<string, string> | undefined) ?? {}),
    );
    expect(dependencies.filter(name => BACKEND_ONLY.includes(name) || name.startsWith('@aws-sdk/'))).toEqual([]);
  });

  it('would notice such an import', () => {
    expect(runtimeImports("import { z } from 'zod';\nimport type { X } from 'pg';").map(packageName)).toEqual(['zod']);
  });
});

describe('client bundles', () => {
  const entries = sourceFiles(SRC).filter(file => hasDirective(readFileSync(file, 'utf8'), 'use client'));

  it('finds the client components', () => {
    expect(entries.length).toBeGreaterThan(20);
    expect(entries.map(file => path.relative(SRC, file))).toContain('components/site/LeadForm.tsx');
  });

  it(`never import ${FORBIDDEN.join(', ')}`, () => {
    expect(entries.flatMap(forbiddenReach)).toEqual([]);
  });

  it('would notice a client module that reaches the ICU runtime', () => {
    // The checker itself: the server-side template renderer does import it.
    expect(forbiddenReach(path.join(SRC, 'components/site/message-template.tsx')).length).toBeGreaterThan(0);
  });
});
