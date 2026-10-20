'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, useTransition, type ReactElement, type ReactNode } from 'react';
import { toast } from 'sonner';

import { defaultLocale, localeNames, locales, mapLocales } from '@/i18n/locales';
import { resetSiteText, saveSiteTexts } from '@/lib/admin/actions/content';
import { formatDateTimeRu } from '@/lib/admin/labels';
import type { SiteTextEntry, SiteTextGroup, SiteTextsPageData } from '@/lib/admin/types';
import type { LocalizedText } from '@/lib/i18n-text';

import { EditLocaleProvider, translationGaps, useEditLocale } from '../i18n/LocaleTabs';
import { LocalizedField } from '../i18n/LocalizedField';
import { MediaPicker } from '../media/MediaPicker';
import { Badge, Card } from '../ui/layout';
import { useActionSubmit } from '../ui/useActionSubmit';
import { useConfirm } from '../ui/useConfirm';
import { errorLocales, errorsByEntryKey } from './content-errors';
import { EntityFormShell } from './EntityFormShell';
import { siteLinksFor } from './site-links';
import {
  editImage,
  editText,
  hasUnsavedText,
  imageChanges,
  settleImages,
  settleTexts,
  shownImage,
  shownText,
  textChanges,
  type ImageDrafts,
  type TextDrafts,
} from './site-text-drafts';

/**
 * «Тексты сайта» editor: the texts (Message rows) of one section — or the search matches of
 * several — with their language tabs, plus the section's landing images (ContentImage rows).
 * One «Сохранить» sends what the owner changed, each with the stored text it started from
 * (site-text-drafts.ts): the server writes only what changed and refuses — naming them — texts
 * changed in another tab or session meanwhile, instead of overwriting them. Each text shows its
 * default, an «изменено» marker (Message.editedAt) and «Вернуть по умолчанию».
 */
export function SiteTextsForm({ data }: { data: SiteTextsPageData }): ReactElement {
  return (
    <EditLocaleProvider>
      <SiteTextsFormInner key={`${data.mode}:${data.section ?? ''}:${data.query}`} data={data} />
    </EditLocaleProvider>
  );
}

function sameValues(a: LocalizedText | undefined, b: LocalizedText | undefined): boolean {
  return locales.every(locale => (a?.[locale] ?? '') === (b?.[locale] ?? ''));
}

function SiteTextsFormInner({ data }: { data: SiteTextsPageData }): ReactElement {
  const t = useTranslations('admin');
  const entries = data.groups.flatMap(group => group.entries);
  const imageEntries = data.groups.flatMap(group => group.images);
  const [texts, setTexts] = useState<TextDrafts>({});
  const [images, setImages] = useState<ImageDrafts>({});
  // Keys of the last save in payload order: zod reports shape errors by index (content-errors.ts).
  const [sentKeys, setSentKeys] = useState<{ texts: string[]; images: string[] }>({ texts: [], images: [] });
  const [resetting, startReset] = useTransition();
  const [resettingKey, setResettingKey] = useState<string | null>(null);
  const [confirmDialog, confirm] = useConfirm();
  const { pending, fieldErrors, setFieldErrors, run } = useActionSubmit();

  const entryKeys = entries.map(entry => entry.key);
  const imageKeys = imageEntries.map(image => image.key);
  const errors = errorsByEntryKey(fieldErrors, sentKeys.texts, sentKeys.images);

  const clearErrorsOf = (key: string): void => {
    const rest = Object.fromEntries(
      Object.entries(errors).filter(([path]) => path !== key && !path.startsWith(`${key}.`)),
    );
    setFieldErrors(rest);
  };

  const submit = (): void => {
    const sentTexts = textChanges(texts, entries);
    const sentImages = imageChanges(images, imageEntries);
    // The page's values when the save is sent (the drafts settle against them).
    const seenTexts = Object.fromEntries(entries.map(entry => [entry.key, entry.values]));
    const seenImages = Object.fromEntries(imageEntries.map(image => [image.key, image.media]));
    // Errors still shown keep their fields while the new save's indexes take over.
    setFieldErrors(errors);
    setSentKeys({ texts: sentTexts.map(change => change.key), images: sentImages.map(change => change.key) });
    run(
      () =>
        saveSiteTexts({
          entries: sentTexts,
          images: sentImages.map(change => ({
            key: change.key,
            mediaId: change.media?.id ?? null,
            base: change.base?.id ?? null,
          })),
        }),
      {
        // Shows what was stored (trimmed), keeping anything typed while the save ran.
        onSuccess: saved => {
          setTexts(current => settleTexts(current, sentTexts, saved.values, seenTexts));
          setImages(current => settleImages(current, sentImages, seenImages));
        },
      },
    );
  };

  const reset = async (entry: SiteTextEntry): Promise<void> => {
    const isStored = Object.keys(entry.edited).length > 0;
    if (!isStored) {
      // Only local, unsaved changes: the stored text already is the default.
      setTexts(current => editText(current, entry, entry.defaults));
      clearErrorsOf(entry.key);
      return;
    }
    const confirmed = await confirm({
      title: t('siteTexts.form.resetTitle'),
      description: t('siteTexts.form.resetDescription', { label: entry.label }),
      confirmLabel: t('siteTexts.form.resetConfirm'),
    });
    if (!confirmed) return;
    const shown = shownText(texts, entry);
    const sent = { key: entry.key, values: mapLocales(locale => ({ value: shown[locale], base: shown[locale] })) };
    setResettingKey(entry.key);
    startReset(async () => {
      try {
        const result = await resetSiteText(entry.key);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setTexts(current =>
          settleTexts(current, [sent], { [entry.key]: result.data.values }, { [entry.key]: entry.values }),
        );
        clearErrorsOf(entry.key);
        toast.success(result.message ?? t('siteTexts.resetDone'));
      } catch {
        toast.error(t('errors.network'));
      } finally {
        setResettingKey(null);
      }
    });
  };

  const singleGroup = data.mode === 'section' ? data.groups[0] : undefined;

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={false}
      localeGaps={translationGaps(entries.map(entry => shownText(texts, entry)))}
      localeErrors={errorLocales(errors, [...entryKeys, ...imageKeys])}
      siteLinks={singleGroup ? siteLinksFor(singleGroup.anchor) : undefined}
      aside={
        <>
          {imageEntries.length > 0 ? (
            <Card
              title={t('siteTexts.form.images')}
              description={t('siteTexts.form.imagesHint')}
              bodyClassName="flex flex-col gap-5"
            >
              {imageEntries.map(image => (
                <MediaPicker
                  key={image.key}
                  id={`image-${image.key.replace(/[^A-Za-z0-9_-]/g, '-')}`}
                  label={image.label}
                  value={shownImage(images, image)}
                  onChange={media => setImages(current => editImage(current, image, media))}
                  aspect="wide"
                  error={errors[image.key]}
                  hint={<span className="font-mono text-[11px]">{image.key}</span>}
                />
              ))}
            </Card>
          ) : null}
          <HelpCard />
        </>
      }
    >
      {data.groups.map(group => (
        <GroupCard key={group.section} group={group} search={data.mode === 'search'}>
          {group.entries.map(entry => (
            <SiteTextField
              key={entry.key}
              entry={entry}
              value={shownText(texts, entry)}
              unsaved={hasUnsavedText(texts, entry)}
              onChange={next => setTexts(current => editText(current, entry, next))}
              fieldErrors={errors}
              resetting={resetting && resettingKey === entry.key}
              onReset={() => void reset(entry)}
            />
          ))}
        </GroupCard>
      ))}
      {confirmDialog}
    </EntityFormShell>
  );
}

function GroupCard({
  group,
  search,
  children,
}: {
  group: SiteTextGroup;
  search: boolean;
  children: ReactNode;
}): ReactElement {
  const t = useTranslations('admin.siteTexts.form');
  return (
    <Card
      title={group.label}
      description={t(search ? 'found' : 'count', { count: group.entries.length })}
      actions={
        search ? (
          <Link
            href={`/admin/content?section=${encodeURIComponent(group.section)}`}
            className="text-xs font-medium text-beige hover:underline"
          >
            {t('wholeSection')}
          </Link>
        ) : undefined
      }
      bodyClassName="flex flex-col divide-y divide-line p-0"
    >
      {children}
    </Card>
  );
}

const DEFAULT_PREVIEW_LENGTH = 140;

function preview(text: string): string {
  return text.length > DEFAULT_PREVIEW_LENGTH ? `${text.slice(0, DEFAULT_PREVIEW_LENGTH)}…` : text;
}

/** One text: the field of the selected language + key, markers and «Вернуть по умолчанию». */
function SiteTextField({
  entry,
  value,
  unsaved,
  onChange,
  fieldErrors,
  resetting,
  onReset,
}: {
  entry: SiteTextEntry;
  value: LocalizedText;
  /** An edit not saved yet («не сохранено»). */
  unsaved: boolean;
  onChange: (next: LocalizedText) => void;
  fieldErrors: Record<string, string>;
  resetting: boolean;
  onReset: () => void;
}): ReactElement {
  const t = useTranslations('admin.siteTexts.form');
  const { locale } = useEditLocale();
  const current = value[locale] ?? '';
  const fallback = entry.defaults[locale];
  const editedLocales = locales.filter(item => entry.edited[item] !== undefined);
  const differsFromDefault = !sameValues(value, entry.defaults);
  const longest = Math.max(...locales.map(item => Math.max(entry.defaults[item].length, entry.values[item].length)));
  // Long texts, paragraphs and plural templates get a textarea, short labels a single line.
  const multiline =
    entry.kind === 'richtext' || longest > 90 || locales.some(item => entry.values[item].includes('\n'));
  const rows = entry.kind === 'richtext' ? 5 : 3;

  const tokens = [...entry.placeholders.map(name => `{${name}}`), ...entry.tags.map(name => `<${name}>…</${name}>`)];
  const hint = (
    <>
      {tokens.length > 0 ? (
        <>
          {t.rich('placeholders', {
            tokens: () =>
              tokens.map((token, index) => (
                <span key={token}>
                  {index > 0 ? ', ' : null}
                  <code className="font-mono text-fg/80">{token}</code>
                </span>
              )),
          })}{' '}
        </>
      ) : null}
      {entry.kind === 'richtext' ? <>{t('richtextHint')} </> : null}
      {entry.kind === 'link' ? <>{t('linkHint')} </> : null}
      {current !== fallback ? (fallback === '' ? t('defaultEmpty') : t('default', { text: preview(fallback) })) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <LocalizedField
        idPrefix="text"
        name={entry.key}
        label={entry.label}
        value={value}
        onChange={onChange}
        required={entry.required}
        multiline={multiline}
        rows={rows}
        fieldErrors={fieldErrors}
        hint={hint}
      />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <code className="font-mono">{entry.key}</code>
        {editedLocales.length > 0 ? (
          <Badge
            tone="beige"
            title={editedLocales
              .map(item =>
                t('editedAt', {
                  language: localeNames[item].short,
                  date: formatDateTimeRu(entry.edited[item] ?? ''),
                }),
              )
              .join('\n')}
          >
            {t('editedBadge', { languages: editedLocales.map(item => localeNames[item].short).join(', ') })}
          </Badge>
        ) : null}
        {unsaved ? <Badge tone="blue">{t('unsaved')}</Badge> : null}
        {entry.missing.length > 0 ? (
          <Badge tone="outline" title={t('missingTitle')}>
            {t('missing', { languages: entry.missing.map(item => localeNames[item].short).join(', ') })}
          </Badge>
        ) : null}
        {locale !== defaultLocale && current.trim() === '' && (value[defaultLocale] ?? '').trim() !== '' ? (
          <Badge tone="outline">{t('noTranslation')}</Badge>
        ) : null}
        {editedLocales.length > 0 || differsFromDefault ? (
          <button
            type="button"
            onClick={onReset}
            disabled={resetting}
            aria-busy={resetting || undefined}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-muted transition-colors hover:bg-raised-hi hover:text-fg disabled:opacity-50"
            aria-label={t('resetLabel', { label: entry.label })}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t('reset')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function HelpCard(): ReactElement {
  const t = useTranslations('admin.siteTexts.help');
  return (
    <Card title={t('title')} bodyClassName="flex flex-col gap-2 text-xs leading-relaxed text-muted">
      <p>{t.rich('edited', { badge: chunks => <Badge tone="beige">{chunks}</Badge> })}</p>
      <p>{t('empty')}</p>
      <p>{t.rich('placeholders', { code: chunks => <code className="font-mono text-fg/80">{chunks}</code> })}</p>
      <p>{t('save')}</p>
    </Card>
  );
}
