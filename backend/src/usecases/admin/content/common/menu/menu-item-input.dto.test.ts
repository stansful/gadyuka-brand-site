import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { DtoValidation } from '../test/dto-validation';
import { MenuItemInputDto } from './menu-item-input.dto';

const valid = { label: { ru: 'Каталог' }, href: '#catalog', showInHeader: true, showInFooter: false, published: true };

describe('MenuItemInputDto (port of the admin menuItemInputSchema)', () => {
  it('accepts a Russian label and a site link (trimmed)', async () => {
    for (const href of ['#catalog', '/catalog/menya-zapomnyat', 'https://t.me/gadyuka', 'mailto:a@b.ru', 'tel:+7900']) {
      deepStrictEqual(await DtoValidation.fieldsOf(MenuItemInputDto, { ...valid, href }), {}, href);
    }
    const result = await DtoValidation.validate(MenuItemInputDto, { ...valid, href: ' /catalog ' });
    ok(result.ok);
    strictEqual(result.value.href, '/catalog');
  });

  it('requires the link, refuses a bare "#" and links that are not site links', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(MenuItemInputDto, { ...valid, href: ' ' }), {
      href: { key: 'admin.validation.hrefRequired' },
    });
    deepStrictEqual(await DtoValidation.fieldsOf(MenuItemInputDto, { ...valid, href: '#' }), {
      href: { key: 'admin.validation.hrefBareHash' },
    });
    for (const href of ['javascript:alert(1)', '//evil.example', 'catalog']) {
      deepStrictEqual(await DtoValidation.fieldsOf(MenuItemInputDto, { ...valid, href }), {
        href: { key: 'admin.validation.siteHref' },
      });
    }
    deepStrictEqual(await DtoValidation.fieldsOf(MenuItemInputDto, { ...valid, href: `/${'a'.repeat(500)}` }), {
      href: { key: 'admin.validation.tooLong', values: { max: 500 } },
    });
  });

  it('requires the Russian label (≤ 80) and boolean placement flags', async () => {
    deepStrictEqual(await DtoValidation.fieldsOf(MenuItemInputDto, { ...valid, label: { en: 'Catalog' } }), {
      'label.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
    });
    deepStrictEqual(
      await DtoValidation.fieldsOf(MenuItemInputDto, { ...valid, label: { ru: 'x'.repeat(81) }, showInFooter: 'no' }),
      {
        'label.ru': { key: 'admin.validation.tooLong', values: { max: 80 } },
        showInFooter: { key: 'admin.validation.invalid' },
      },
    );
  });
});
