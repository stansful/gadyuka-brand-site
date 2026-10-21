'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { errorFor } from '@/lib/admin/action-result';
import { saveMenuItem } from '@/lib/admin/actions/menu';
import type { MenuHrefOption } from '@/lib/admin/content-entities';
import type { LocalizedText } from '@/lib/localized-text';
import type { AdminMenuItemDetails } from '@shared/contracts/content-entities';

import { EditLocaleProvider, localesWithErrors, translationGaps } from '../i18n/LocaleTabs';
import { LocalizedField } from '../i18n/LocalizedField';
import { describedBy, Field } from '../ui/Field';
import { Select, TextInput } from '../ui/inputs';
import { Card } from '../ui/layout';
import { Switch } from '../ui/Switch';
import { useActionSubmit } from '../ui/useActionSubmit';
import { EntityFormShell } from './EntityFormShell';
import { siteLinksFor } from './site-links';

const LOCALIZED = ['label'] as const;

type MenuItemFormProps = {
  initial: AdminMenuItemDetails | null;
  /** Landing anchors and collection pages to pick the link from. */
  hrefOptions: MenuHrefOption[];
};

export function MenuItemForm(props: MenuItemFormProps): ReactElement {
  return (
    <EditLocaleProvider>
      <MenuItemFormInner {...props} />
    </EditLocaleProvider>
  );
}

function MenuItemFormInner({ initial, hrefOptions }: MenuItemFormProps): ReactElement {
  const t = useTranslations('admin');
  const router = useRouter();
  const [label, setLabel] = useState<LocalizedText>(initial?.label ?? {});
  const [href, setHref] = useState(initial?.href ?? '');
  const [showInHeader, setShowInHeader] = useState(initial?.showInHeader ?? true);
  const [showInFooter, setShowInFooter] = useState(initial?.showInFooter ?? true);
  const [published, setPublished] = useState(initial?.published ?? true);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(() => saveMenuItem(initial?.id ?? null, { label, href, showInHeader, showInFooter, published }), {
      onSuccess: data => {
        if (!initial) router.replace(`/admin/menu/${data.id}`);
      },
    });
  };

  const hrefError = errorFor(fieldErrors, 'href');
  const hrefHint = t('menu.form.hrefHint');
  const knownOption = hrefOptions.find(option => option.href === href.trim());

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([label])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor(null) : undefined}
      remove={initial ? { entity: 'menuItem', id: initial.id, listHref: '/admin/menu', withMedia: false } : undefined}
      aside={
        <Card title={t('menu.form.where')} bodyClassName="flex flex-col gap-4">
          <Switch checked={published} onCheckedChange={setPublished} label={t('form.showOnSite')} />
          <Switch
            checked={showInHeader}
            onCheckedChange={setShowInHeader}
            label={t('menu.form.inHeader')}
            description={t('menu.form.inHeaderHint')}
          />
          <Switch
            checked={showInFooter}
            onCheckedChange={setShowInFooter}
            label={t('menu.form.inFooter')}
            description={t('menu.form.inFooterHint')}
          />
          {published && !showInHeader && !showInFooter ? (
            <p className="text-xs text-beige">{t('menu.form.invisible')}</p>
          ) : null}
        </Card>
      }
    >
      <Card title={t('menu.form.main')} bodyClassName="flex flex-col gap-5">
        <LocalizedField
          name="label"
          label={t('menu.form.label')}
          required
          value={label}
          onChange={setLabel}
          fieldErrors={fieldErrors}
          maxLength={80}
          placeholder={t('menu.form.labelPlaceholder')}
        />
        <Field htmlFor="menu-href" label={t('menu.form.href')} required hint={hrefHint} error={hrefError}>
          <TextInput
            id="menu-href"
            value={href}
            onChange={event => setHref(event.target.value)}
            invalid={Boolean(hrefError)}
            aria-describedby={describedBy('menu-href', hrefHint, hrefError)}
            aria-required
            maxLength={500}
            spellCheck={false}
            placeholder="#catalog"
            className="font-mono"
          />
        </Field>
        {hrefOptions.length > 0 ? (
          <Field htmlFor="menu-href-pick" label={t('menu.form.pick')}>
            <Select
              id="menu-href-pick"
              value={knownOption ? knownOption.href : ''}
              onChange={event => {
                if (event.target.value) setHref(event.target.value);
              }}
            >
              <option value="">{t('menu.form.pickPlaceholder')}</option>
              {hrefOptions.map(option => (
                <option key={option.href} value={option.href}>
                  {t('menu.form.option', { label: option.label, href: option.href })}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </Card>
    </EntityFormShell>
  );
}
