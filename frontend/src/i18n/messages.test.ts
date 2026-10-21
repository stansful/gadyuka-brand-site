import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MESSAGES,
  flattenMessages,
  isMessageKey,
  MESSAGE_KEYS,
  unflattenMessages,
  type SiteMessages,
} from './messages';

describe('message keys', () => {
  it('are the string leaves of shared/messages/ru.json, numeric segments included', () => {
    expect(MESSAGE_KEYS).toContain('hero.title');
    expect(MESSAGE_KEYS).toContain('about.advantages.0.title');
    expect(MESSAGE_KEYS).toContain('forms.errors.tooShort');
    expect(isMessageKey('forms.errors')).toBe(false); // a branch, not a message
    expect(isMessageKey('header.nav.home')).toBe(false); // menu labels are MenuItem rows
  });

  it('flatten and unflatten are inverse', () => {
    const tree = { a: { b: 'x', c: { '0': { d: 'y' } } }, e: 'z' };
    const flat = flattenMessages(tree);
    expect(flat).toEqual({ 'a.b': 'x', 'a.c.0.d': 'y', e: 'z' });
    expect(unflattenMessages(flat)).toEqual(tree);
    expect(() => unflattenMessages({ a: 'x', 'a.b': 'y' })).toThrow();
  });
});

/**
 * What next-intl can render — the ground truth of the backend's trial format of admin edits
 * (backend/src/module/messages, «trial format»: the same cases with the same verdicts). A next-intl
 * upgrade that changes a verdict fails here; then update the backend's cases and checks with it.
 */
describe('next-intl rendering of edited ICU values', () => {
  type Case = { key: 'catalog.models' | 'catalog.orderSubject'; value: string; renders: boolean };
  const SAMPLE_COUNTS = [0, 1, 2, 3, 5, 21];
  const LEAF = { 'catalog.models': 'models', 'catalog.orderSubject': 'orderSubject' } as const;

  /** Whether next-intl t() renders `value` as the ru text of `key` for every sample argument. */
  function rendersInNextIntl({ key, value }: Case): boolean {
    const ru = DEFAULT_MESSAGES.ru;
    const messages: SiteMessages = { ...ru, catalog: { ...ru.catalog, [LEAF[key]]: value } };
    let failed = false;
    const t = createTranslator({
      locale: 'ru',
      messages,
      timeZone: 'Europe/Moscow',
      onError: () => {
        failed = true;
      },
    });
    for (const count of SAMPLE_COUNTS) {
      if (key === 'catalog.models') t(key, { count });
      else t(key, { product: 'Худи «Яд»' });
    }
    return !failed;
  }

  const cases: Case[] = [
    { key: 'catalog.models', value: '{count, plural, one {# вещь} other {# вещей}}', renders: true },
    { key: 'catalog.models', value: '{count, number, ::currency/USD}', renders: true },
    { key: 'catalog.models', value: '{count, number, ::currency/XY}', renders: false },
    { key: 'catalog.models', value: '{count, number, currency}', renders: false },
    { key: 'catalog.models', value: '{count, number, ::unit/foo}', renders: false },
    // a broken format in a branch only some counts select
    {
      key: 'catalog.models',
      value: '{count, plural, one {{count, number, ::unit/foo}} other {# шт.}}',
      renders: false,
    },
    { key: 'catalog.orderSubject', value: 'Заказ: {product, select, other {«{product}»}}', renders: true },
    { key: 'catalog.orderSubject', value: 'Заказ от {product, date}', renders: false }, // a text formatted as a date
  ];

  it('renders exactly the values the backend accepts', () => {
    expect(cases.map(rendersInNextIntl)).toEqual(cases.map(item => item.renders));
  });
});
