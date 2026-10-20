import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { flattenMessages, isMessageKey, type MessageTree } from '@/i18n/messages';
import { CONTENT_SECTIONS, IMAGE_KEYS } from '@/lib/content/registry';

import adminRu from '../../../messages/admin/ru.json';

/**
 * Regression guard of the admin copy extraction (messages/admin/ru.json, namespace "admin"):
 * 1. no Cyrillic in string literals, templates or JSX text of the admin code (comments and
 *    tests do not count; slug.ts holds the transliteration table — data, not copy);
 * 2. every key the admin code reads exists: t('…') / t.rich / t.has … on a translator from
 *    useTranslations / getTranslations / getAdminTranslations (or a parameter typed
 *    AdminTranslator<'admin.…'>), errorKey('…') of the zod schemas and adminPageMetadata('…');
 *    a template key (t(`types.${type}`)) must at least name an existing branch; and every
 *    {argument} / <tag> of the message is passed (TypeScript cannot check it: the JSON values
 *    are typed as plain strings);
 * 3. the messages themselves are valid ICU and the site-text labels match the site's keys.
 */

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SCANNED_DIRS = ['src/app/admin', 'src/components/admin', 'src/lib/admin'];
/** Admin-facing copy outside the admin folders (the texts editor metadata, upload errors, zod). */
const SCANNED_FILES = ['src/lib/content/registry.ts', 'src/lib/media.ts', 'src/lib/i18n-text.ts'];
const EXCLUDED = new Set(['src/lib/admin/slug.ts']);
const CYRILLIC = /[Ѐ-ӿ]/;

function sourceFiles(relative: string): string[] {
  return readdirSync(path.join(ROOT, relative), { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

const files = [...SCANNED_DIRS.flatMap(sourceFiles), ...SCANNED_FILES]
  .filter(file => !EXCLUDED.has(file))
  .map(file => {
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return { file, source: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind) };
  });

const ADMIN_TREE: MessageTree = adminRu;
const LEAVES: Readonly<Record<string, string>> = flattenMessages(ADMIN_TREE);
const BRANCHES: ReadonlySet<string> = new Set(
  Object.keys(LEAVES).flatMap(key => {
    const parts = key.split('.');
    return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join('.'));
  }),
);

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

// ── 1. no Cyrillic copy in code ──────────────────────────────────────────────────

function cyrillicLiterals(source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const text =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
        ? node.text
        : null;
    if (text !== null && CYRILLIC.test(text)) found.push(`${lineOf(source, node)}: ${text.trim().slice(0, 80)}`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// ── 2. message keys used by the code ─────────────────────────────────────────────

const TRANSLATOR_FACTORIES = new Set(['useTranslations', 'getTranslations', 'getAdminTranslations']);
const TRANSLATOR_METHODS = new Set(['rich', 'markup', 'raw', 'has']);

/** How a key is formatted, and the names of the values passed with it. */
type KeyCall = { method: 'plain' | 'rich' | 'unchecked'; values: ReadonlySet<string> | 'dynamic' | 'none' };

type KeyUse = { file: string; line: number; key: string; kind: 'leaf' | 'branch' | 'namespace'; call?: KeyCall };

/** Property names of an object literal of ICU values ('dynamic' for anything else). */
function valueNames(node: ts.Expression | undefined): KeyCall['values'] {
  if (!node) return 'none';
  if (!ts.isObjectLiteralExpression(node)) return 'dynamic';
  const names = new Set<string>();
  for (const property of node.properties) {
    if ((ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && property.name) {
      if (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) return 'dynamic';
      names.add(property.name.text);
    } else if (ts.isMethodDeclaration(property) && ts.isIdentifier(property.name)) {
      names.add(property.name.text);
    } else {
      return 'dynamic';
    }
  }
  return names;
}

/** The namespace literal of useTranslations('admin.x') / getTranslations({ namespace: 'admin.x' }) … */
function factoryNamespace(node: ts.Expression): string | null {
  let call: ts.Expression = node;
  while (ts.isAwaitExpression(call) || ts.isParenthesizedExpression(call)) call = call.expression;
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null;
  if (!TRANSLATOR_FACTORIES.has(call.expression.text)) return null;
  const [argument] = call.arguments;
  if (argument && ts.isStringLiteral(argument)) return argument.text;
  if (argument && ts.isObjectLiteralExpression(argument)) {
    for (const property of argument.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === 'namespace' &&
        ts.isStringLiteral(property.initializer)
      ) {
        return property.initializer.text;
      }
    }
  }
  return null;
}

/** 'admin.x' of AdminTranslator<'admin.x'> (directly or through a local type alias). */
function translatorTypeNamespace(type: ts.TypeNode | undefined, aliases: ReadonlyMap<string, string>): string | null {
  if (!type || !ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName)) return null;
  if (type.typeName.text === 'AdminTranslator') {
    const [argument] = type.typeArguments ?? [];
    if (argument && ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal))
      return argument.literal.text;
    return null;
  }
  return aliases.get(type.typeName.text) ?? null;
}

/** Literal keys of a key expression: 'a', cond ? 'a' : 'b', `prefix.${x}` (→ branch "prefix"). */
function keyCandidates(node: ts.Expression): Array<{ key: string; kind: 'leaf' | 'branch' }> {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ key: node.text, kind: 'leaf' }];
  if (ts.isParenthesizedExpression(node)) return keyCandidates(node.expression);
  if (ts.isConditionalExpression(node)) return [...keyCandidates(node.whenTrue), ...keyCandidates(node.whenFalse)];
  if (ts.isTemplateExpression(node)) {
    const prefix = node.head.text.replace(/\.$/, '');
    return prefix ? [{ key: prefix, kind: 'branch' }] : [];
  }
  return [];
}

function keyUses(file: string, source: ts.SourceFile): KeyUse[] {
  const uses: KeyUse[] = [];
  const aliases = new Map<string, string>();
  for (const statement of source.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      const namespace = translatorTypeNamespace(statement.type, aliases);
      if (namespace) aliases.set(statement.name.text, namespace);
    }
  }
  const scopes: Array<Map<string, string>> = [new Map()];
  const bind = (name: string, namespace: string): void => void scopes.at(-1)?.set(name, namespace);
  const lookup = (name: string): string | undefined => {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      const namespace = scopes[index]?.get(name);
      if (namespace) return namespace;
    }
    return undefined;
  };
  const use = (node: ts.Node, key: string, kind: KeyUse['kind'], call?: KeyCall): void => {
    uses.push({ file, line: lineOf(source, node), key, kind, call });
  };
  const useKeys = (node: ts.CallExpression, namespace: string, method: KeyCall['method']): void => {
    const [argument, values] = node.arguments;
    if (!argument) return;
    const call: KeyCall = { method, values: valueNames(values) };
    for (const candidate of keyCandidates(argument)) use(node, `${namespace}.${candidate.key}`, candidate.kind, call);
  };

  const visit = (node: ts.Node): void => {
    const isFunction = ts.isFunctionLike(node);
    if (isFunction) {
      scopes.push(new Map());
      for (const parameter of node.parameters) {
        const namespace = translatorTypeNamespace(parameter.type, aliases);
        if (namespace && ts.isIdentifier(parameter.name)) bind(parameter.name.text, namespace);
        // ({ t }: { t: AdminTranslator<'admin.x'> }) — a translator passed as a prop.
        if (ts.isObjectBindingPattern(parameter.name) && parameter.type && ts.isTypeLiteralNode(parameter.type)) {
          for (const member of parameter.type.members) {
            if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
            const propNamespace = translatorTypeNamespace(member.type, aliases);
            if (propNamespace) bind(member.name.text, propNamespace);
          }
        }
      }
    }

    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) {
        const namespace = factoryNamespace(node.initializer);
        if (namespace) bind(node.name.text, namespace);
      } else if (ts.isArrayBindingPattern(node.name)) {
        // const [rows, t] = await Promise.all([query(), getTranslations('admin.x')]);
        let all: ts.Expression = node.initializer;
        while (ts.isAwaitExpression(all)) all = all.expression;
        const list = ts.isCallExpression(all) ? all.arguments[0] : undefined;
        if (list && ts.isArrayLiteralExpression(list)) {
          node.name.elements.forEach((element, index) => {
            const item = list.elements[index];
            const namespace = item ? factoryNamespace(item) : null;
            if (namespace && ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
              bind(element.name.text, namespace);
            }
          });
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const factory = factoryNamespace(node);
      if (factory) use(node, factory, 'namespace');
      if (ts.isIdentifier(callee)) {
        const namespace = lookup(callee.text);
        if (namespace) useKeys(node, namespace, 'plain');
        // zod issue keys get their values from the issue ({min}, {max}, params) at runtime.
        if (callee.text === 'errorKey') useKeys(node, 'admin.validation', 'unchecked');
        if (callee.text === 'adminPageMetadata') useKeys(node, 'admin', 'plain');
      } else if (ts.isPropertyAccessExpression(callee) && TRANSLATOR_METHODS.has(callee.name.text)) {
        const namespace = ts.isIdentifier(callee.expression) ? lookup(callee.expression.text) : undefined;
        const method = callee.name.text;
        // t.has(dynamicKey) is a runtime check of an optional key — nothing to verify statically.
        if (namespace && method !== 'has') useKeys(node, namespace, method === 'raw' ? 'unchecked' : 'rich');
      } else {
        // (await getAdminTranslations('admin.errors'))('missingMedia')
        const namespace = factoryNamespace(callee);
        if (namespace) useKeys(node, namespace, 'plain');
      }
    }

    ts.forEachChild(node, visit);
    if (isFunction) scopes.pop();
  };
  visit(source);
  return uses;
}

/** {arguments} and <tags> a message needs. */
function messageNeeds(message: string): { args: Set<string>; tags: Set<string> } {
  const args = new Set<string>();
  const tags = new Set<string>();
  const walk = (elements: readonly MessageFormatElement[]): void => {
    for (const element of elements) {
      if (isArgumentElement(element) || isNumberElement(element) || isDateElement(element) || isTimeElement(element)) {
        args.add(element.value);
      } else if (isPluralElement(element) || isSelectElement(element)) {
        args.add(element.value);
        for (const option of Object.values(element.options)) walk(option.value);
      } else if (isTagElement(element)) {
        tags.add(element.value);
        walk(element.children);
      }
    }
  };
  walk(parse(message));
  return { args, tags };
}

/** The leaves a use formats: the key itself, or the direct leaves of a template branch. */
function formattedLeaves(use: KeyUse): string[] {
  if (use.kind === 'leaf') return LEAVES[use.key] === undefined ? [] : [use.key];
  const prefix = `${use.key}.`;
  return Object.keys(LEAVES).filter(key => key.startsWith(prefix) && !key.slice(prefix.length).includes('.'));
}

/** What a use fails to pass: missing {arguments} / <tags>, or tags formatted with plain t(). */
function missingValues(use: KeyUse): string[] {
  const call = use.call;
  if (!call || call.method === 'unchecked' || call.values === 'dynamic') return [];
  const provided = call.values === 'none' ? new Set<string>() : call.values;
  return formattedLeaves(use).flatMap(key => {
    const { args, tags } = messageNeeds(LEAVES[key] ?? '');
    const problems = [...args].filter(name => !provided.has(name)).map(name => `{${name}}`);
    if (call.method === 'plain') problems.push(...[...tags].map(name => `<${name}> needs t.rich`));
    else problems.push(...[...tags].filter(name => !provided.has(name)).map(name => `<${name}>`));
    return problems.map(problem => `${use.file}:${use.line}: ${key} ${problem}`);
  });
}

function missingKey(use: KeyUse): boolean {
  if (!use.key.startsWith('admin')) return false;
  if (use.kind === 'leaf') return LEAVES[use.key] === undefined;
  return use.key !== 'admin' && !BRANCHES.has(use.key);
}

describe('admin copy lives in messages/admin/ru.json', () => {
  it('scans the admin code', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('has no Cyrillic string literals or JSX text in the admin code', () => {
    const offenders = files.flatMap(({ file, source }) => cyrillicLiterals(source).map(line => `${file}:${line}`));
    expect(offenders).toEqual([]);
  });

  it('reads only keys that exist in messages/admin/ru.json', () => {
    const uses = files.flatMap(({ file, source }) => keyUses(file, source));
    // The scan really sees the code's keys (namespaces, plain keys and template branches).
    expect(uses.filter(use => use.kind === 'leaf').length).toBeGreaterThan(400);
    expect(uses.filter(use => use.kind === 'branch').length).toBeGreaterThan(5);
    const missing = uses.filter(missingKey).map(use => `${use.file}:${use.line}: ${use.key} (${use.kind})`);
    expect(missing).toEqual([]);
  });

  it('passes every {argument} and <tag> the messages need', () => {
    const uses = files.flatMap(({ file, source }) => keyUses(file, source));
    expect(uses.flatMap(missingValues)).toEqual([]);
  });
});

describe('messages/admin/ru.json', () => {
  it('holds only the admin namespace, every message valid ICU', () => {
    expect(Object.keys(adminRu)).toEqual(['admin']);
    const invalid = Object.entries(LEAVES).flatMap(([key, value]) => {
      try {
        parse(value);
        return value.trim() === '' ? [`${key}: empty`] : [];
      } catch (error: unknown) {
        return [`${key}: ${error instanceof Error ? error.message : String(error)}`];
      }
    });
    expect(invalid).toEqual([]);
  });

  it('names every section and landing image of the texts editor, and labels only existing texts', () => {
    const { sections, images, labels } = adminRu.admin.siteTexts;
    expect(Object.keys(sections).sort()).toEqual(CONTENT_SECTIONS.map(section => section.id).sort());
    expect(Object.keys(flattenMessages(images)).sort()).toEqual([...IMAGE_KEYS].sort());
    const stale = Object.keys(flattenMessages(labels)).filter(key => !isMessageKey(key));
    expect(stale).toEqual([]);
    // Read by computed key without values: a placeholder shown in a label must be ICU-quoted ('{title}').
    const withArguments = Object.entries({ ...flattenMessages(sections), ...flattenMessages(labels) }).filter(
      ([, value]) => {
        const { args, tags } = messageNeeds(value);
        return args.size + tags.size > 0;
      },
    );
    expect(withArguments).toEqual([]);
  });
});
