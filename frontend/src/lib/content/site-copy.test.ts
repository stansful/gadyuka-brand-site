import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { flattenMessages, isMessageKey, MESSAGE_KEYS, type MessageKey } from '@/i18n/messages';

import ru from '../../../messages/ru.json';
import { isImageKey } from './registry';

/**
 * Regression guard of the rule «all text of the public site is a message»: every word a visitor
 * (or a screen reader, or the owner's Telegram) gets comes from messages/<locale>.json through the
 * DB-backed messages, so the admin can edit it. Parses the site's sources with the TypeScript
 * compiler (comments are not nodes, so they never count) and checks:
 * 1. no Cyrillic in string literals, template literals or JSX text;
 * 2. no words at all in JSX text, in literal JSX children or in literal copy attributes
 *    (aria-label, alt, title, placeholder …) — only aria-hidden glyphs such as → ★ ✂ may stay;
 * 3. every message key the code names exists in messages/ru.json: texts['…'], data-edit="…",
 *    t('…') of a getTranslations({ namespace }) translator, the telegram.* keys;
 * 4. and the other way round: every message is used somewhere (no dead keys).
 */

const ROOT = path.resolve(import.meta.dirname, '../../..');

/** The public site's code: what the visitor and the owner's Telegram get. Test files are skipped. */
const SITE_SOURCES = [
  'src/components/site',
  'src/app/[locale]',
  'src/app/manifest.ts',
  'src/app/api/leads',
  'src/lib/seo',
  'src/lib/telegram.ts',
  'src/lib/leads.ts',
  'src/lib/lead-form-config.ts',
  'src/lib/lead-intent.ts',
];

/**
 * Cyrillic that is not copy. Each entry: file, the literal text, why it stays.
 * - 'А': the sample character a font load is requested with (`document.fonts.load(font, 'А')`)
 *   so that the browser fetches the Cyrillic subset — never shown.
 */
const ALLOWED_CYRILLIC: ReadonlyArray<{ file: string; includes: string }> = [
  { file: 'src/components/site/motion/scheduler.ts', includes: 'А' },
  { file: 'src/components/site/motion/boot.ts', includes: "textContent||'А'" },
];

/** JSX attributes whose value is read out or shown. */
const COPY_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'alt',
  'title',
  'placeholder',
]);

/**
 * Keys read through an object or a computed key rather than a literal, so the scan below cannot
 * see them: forms.* (the whole namespace goes to LeadForm as `labels`; errors by code),
 * social.<TYPE> (by the link's type), telegram.leadTypes.<TYPE> (by the lead's type).
 */
const DYNAMIC_PREFIXES = ['forms.', 'social.', 'telegram.leadTypes.'];

/** Files whose translator is bound to a namespace without a getTranslations call in the file. */
const IMPLICIT_NAMESPACES: Readonly<Record<string, { namespace: string; callees: readonly string[] }>> = {
  // t: TelegramText (loadTelegramText — getTranslations({ namespace: 'telegram' })), label(): its <b> wrapper
  'src/lib/telegram.ts': { namespace: 'telegram', callees: ['t', 'label'] },
};

function filesUnder(relative: string): string[] {
  const absolute = path.join(ROOT, relative);
  if (statSync(absolute).isFile()) return [relative];
  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return filesUnder(child);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

type Source = { file: string; sourceFile: ts.SourceFile };

const sources: Source[] = SITE_SOURCES.flatMap(filesUnder).map(file => ({
  file,
  sourceFile: ts.createSourceFile(
    file,
    readFileSync(path.join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  ),
}));

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, child => walk(child, visit));
}

function where(source: Source, node: ts.Node): string {
  const { line } = source.sourceFile.getLineAndCharacterOfPosition(node.getStart(source.sourceFile));
  return `${source.file}:${line + 1}`;
}

/** The text of a string literal / template part, or null. */
function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) return node.text;
  return null;
}

const CYRILLIC = /[А-Яа-яЁё]/;
const LETTER = /[A-Za-zА-Яа-яЁё]/;

/**
 * The literal strings an expression can evaluate to: 'a', `a`, both branches of
 * `cond ? 'a' : undefined`, the operands of `x ?? 'a'` / `x || 'a'`, the literal parts of a
 * template. Calls, JSX and identifiers yield nothing (their own nodes are checked separately).
 */
function literalsIn(node: ts.Node): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map(span => span.literal.text)];
  if (ts.isParenthesizedExpression(node) || ts.isJsxExpression(node)) {
    return node.expression ? literalsIn(node.expression) : [];
  }
  if (ts.isConditionalExpression(node)) return [...literalsIn(node.whenTrue), ...literalsIn(node.whenFalse)];
  if (ts.isBinaryExpression(node)) return [...literalsIn(node.left), ...literalsIn(node.right)];
  return [];
}

/** namespace of a getTranslations(…) call: getTranslations('ns') / getTranslations({ namespace: 'ns' }). */
function translationsNamespace(call: ts.CallExpression): string | null {
  if (!ts.isIdentifier(call.expression) || call.expression.text !== 'getTranslations') return null;
  const [arg] = call.arguments;
  if (!arg) return '';
  if (ts.isStringLiteral(arg)) return arg.text;
  if (ts.isObjectLiteralExpression(arg)) {
    for (const property of arg.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        property.name.getText() === 'namespace' &&
        ts.isStringLiteral(property.initializer)
      ) {
        return property.initializer.text;
      }
    }
    return '';
  }
  return null;
}

/** The name a getTranslations call is bound to: `const t = await …` or `const [t, …] = await Promise.all([…])`. */
function boundName(call: ts.CallExpression): string | null {
  let node: ts.Node = call;
  let index = -1;
  if (ts.isArrayLiteralExpression(node.parent)) {
    index = node.parent.elements.indexOf(call);
    node = node.parent.parent; // Promise.all(…)
  }
  while (ts.isAwaitExpression(node.parent) || ts.isParenthesizedExpression(node.parent)) node = node.parent;
  const declaration = node.parent;
  if (!ts.isVariableDeclaration(declaration)) return null;
  if (index === -1) return ts.isIdentifier(declaration.name) ? declaration.name.text : null;
  if (!ts.isArrayBindingPattern(declaration.name)) return null;
  const element = declaration.name.elements[index];
  return element && ts.isBindingElement(element) && ts.isIdentifier(element.name) ? element.name.text : null;
}

/** Every message key the site code names (with where), found by the rules in the header comment. */
function referencedKeys(): Array<{ key: string; at: string }> {
  const out: Array<{ key: string; at: string }> = [];
  for (const source of sources) {
    const translators = new Map<string, string>();
    walk(source.sourceFile, node => {
      if (ts.isCallExpression(node)) {
        const namespace = translationsNamespace(node);
        const name = namespace === null ? null : boundName(node);
        if (namespace !== null && name) translators.set(name, namespace);
      }
    });
    const implicit = IMPLICIT_NAMESPACES[source.file];
    if (implicit) for (const callee of implicit.callees) translators.set(callee, implicit.namespace);

    walk(source.sourceFile, node => {
      // texts['hero.title']
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'texts' &&
        ts.isStringLiteral(node.argumentExpression)
      ) {
        out.push({ key: node.argumentExpression.text, at: where(source, node) });
      }
      // data-edit="hero.title" / data-edit={cond ? 'hero.heading' : undefined}
      if (ts.isJsxAttribute(node) && node.name.getText() === 'data-edit' && node.initializer) {
        for (const key of literalsIn(node.initializer)) out.push({ key, at: where(source, node) });
      }
      // t('title') of a namespaced translator; t(`leadTypes.${type}`) is dynamic (DYNAMIC_PREFIXES)
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const namespace = translators.get(node.expression.text);
        const [arg] = node.arguments;
        if (namespace !== undefined && arg && ts.isStringLiteral(arg)) {
          out.push({ key: namespace ? `${namespace}.${arg.text}` : arg.text, at: where(source, node) });
        }
      }
      // 'about.advantages.0.title' typed as a TextKey; messages.error.kicker on a resolved tree
      const text = literalText(node);
      if (text !== null && isMessageKey(text)) out.push({ key: text, at: where(source, node) });
      if (ts.isPropertyAccessExpression(node)) {
        const chain = node.getText(source.sourceFile).split('.');
        for (let start = 1; start < chain.length - 1; start += 1) {
          const key = chain.slice(start).join('.');
          if (isMessageKey(key)) out.push({ key, at: where(source, node) });
        }
      }
    });
  }
  return out;
}

describe('public site copy lives in the messages', () => {
  it('has no Cyrillic string or JSX text in the site code (comments and tests aside)', () => {
    const found: string[] = [];
    for (const source of sources) {
      walk(source.sourceFile, node => {
        const text = ts.isJsxText(node) ? node.text : literalText(node);
        if (text === null || !CYRILLIC.test(text)) return;
        const allowed = ALLOWED_CYRILLIC.some(entry => entry.file === source.file && text.includes(entry.includes));
        if (!allowed) found.push(`${where(source, node)} ${JSON.stringify(text.slice(0, 80))}`);
      });
    }
    expect(found).toEqual([]);
  });

  it('has no words in JSX text, literal JSX children or literal copy attributes (only aria-hidden glyphs)', () => {
    const found: string[] = [];
    for (const source of sources) {
      walk(source.sourceFile, node => {
        if (ts.isJsxText(node) && LETTER.test(node.text)) found.push(`${where(source, node)} ${node.text.trim()}`);
        if (
          ts.isJsxExpression(node) &&
          node.expression &&
          (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
          literalsIn(node.expression).some(text => LETTER.test(text))
        ) {
          found.push(`${where(source, node)} ${node.getText(source.sourceFile)}`);
        }
        if (ts.isJsxAttribute(node) && COPY_ATTRIBUTES.has(node.name.getText()) && node.initializer) {
          const values = ts.isStringLiteral(node.initializer) ? [node.initializer.text] : literalsIn(node.initializer);
          if (values.some(text => LETTER.test(text)))
            found.push(`${where(source, node)} ${node.getText(source.sourceFile)}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  const references = referencedKeys();

  it('only names message keys that exist in messages/ru.json', () => {
    const unknown = references
      .filter(({ key }) => !isMessageKey(key) && !isImageKey(key))
      .map(({ key, at }) => `${at} ${key}`);
    expect(unknown).toEqual([]);
    expect(new Set(references.map(({ key }) => key)).size).toBeGreaterThan(150); // the scan really sees the site
  });

  it('uses every message (no dead keys)', () => {
    const used = new Set(references.map(({ key }) => key));
    const dead = MESSAGE_KEYS.filter(
      (key: MessageKey) => !used.has(key) && !DYNAMIC_PREFIXES.some(prefix => key.startsWith(prefix)),
    );
    expect(dead).toEqual([]);
  });

  it('keeps the dynamic families complete', () => {
    const keys = Object.keys(flattenMessages(ru));
    for (const type of ['TAILORING', 'PARTNERSHIP', 'CONTACT']) expect(keys).toContain(`telegram.leadTypes.${type}`);
    for (const code of ['required', 'tooShort', 'tooLong', 'server', 'network', 'invalidForm']) {
      expect(keys).toContain(`forms.errors.${code}`);
    }
  });
});
