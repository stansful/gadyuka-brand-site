"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState, type ReactElement } from "react";
import { errorFor } from "@/lib/admin/action-result";
import { saveSettings } from "@/lib/admin/actions/settings";
import { SOCIAL_TYPE_LABELS } from "@/lib/admin/labels";
import type { AdminMediaRef, SettingsFormData } from "@/lib/admin/types";
import { SOCIAL_TYPES, type SocialType } from "@/lib/content/schemas";
import type { LocalizedText } from "@/lib/i18n-text";
import { EditLocaleProvider, localesWithErrors, translationGaps } from "../i18n/LocaleTabs";
import { LocalizedField } from "../i18n/LocalizedField";
import { MediaPicker } from "../media/MediaPicker";
import { Button } from "../ui/Button";
import { describedBy, Field } from "../ui/Field";
import { Select, TextInput } from "../ui/inputs";
import { Card } from "../ui/layout";
import { useActionSubmit } from "../ui/useActionSubmit";
import { EntityFormShell } from "./EntityFormShell";
import { siteLinksFor } from "./site-links";

const LOCALIZED = ["address", "seoTitle", "seoDescription"] as const;

type SocialRow = { key: number; type: SocialType; url: string };

function isSocialType(value: string): value is SocialType {
  return (SOCIAL_TYPES as readonly string[]).includes(value);
}

export function SettingsForm({ initial }: { initial: SettingsFormData }): ReactElement {
  return (
    <EditLocaleProvider>
      <SettingsFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function SettingsFormInner({ initial }: { initial: SettingsFormData }): ReactElement {
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [address, setAddress] = useState<LocalizedText>(initial.address);
  const [socials, setSocials] = useState<SocialRow[]>(() => initial.socials.map((link, index) => ({ key: index, ...link })));
  const [nextKey, setNextKey] = useState(initial.socials.length);
  const [seoTitle, setSeoTitle] = useState<LocalizedText>(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState<LocalizedText>(initial.seoDescription);
  const [ogImage, setOgImage] = useState<AdminMediaRef | null>(initial.ogImage);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(() =>
      saveSettings({
        phone,
        email,
        address,
        socials: socials.map(({ type, url }) => ({ type, url: url.trim() })),
        seoTitle,
        seoDescription,
        ogImageId: ogImage?.id ?? null,
      }),
    );
  };

  const updateSocial = (key: number, patch: Partial<Omit<SocialRow, "key">>): void => {
    setSocials((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const moveSocial = (index: number, delta: -1 | 1): void => {
    setSocials((current) => {
      const target = index + delta;
      const row = current[index];
      const other = current[target];
      if (!row || !other) return current;
      const next = [...current];
      next[index] = other;
      next[target] = row;
      return next;
    });
  };
  const addSocial = (): void => {
    setSocials((current) => [...current, { key: nextKey, type: "telegram", url: "" }]);
    setNextKey((key) => key + 1);
  };

  const phoneError = errorFor(fieldErrors, "phone");
  const emailError = errorFor(fieldErrors, "email");
  const socialsError = fieldErrors.socials;

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={false}
      localeGaps={translationGaps([address, seoTitle, seoDescription])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={siteLinksFor("contacts")}
      aside={
        <Card title="Картинка для соцсетей (OG)" description="Показывается при отправке ссылки на сайт в мессенджерах. Лучше 1200×630.">
          <MediaPicker id="settings-og" label="OG-изображение" value={ogImage} onChange={setOgImage} aspect="wide" error={errorFor(fieldErrors, "ogImageId")} />
        </Card>
      }
    >
      <Card title="Контакты" description="Показываются в разделе «Контакты» и в подвале." bodyClassName="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <Field htmlFor="settings-phone" label="Телефон" error={phoneError}>
            <TextInput
              id="settings-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              invalid={Boolean(phoneError)}
              aria-describedby={describedBy("settings-phone", null, phoneError)}
              maxLength={40}
              placeholder="+7 900 000-00-00"
            />
          </Field>
          <Field htmlFor="settings-email" label="E-mail" error={emailError}>
            <TextInput
              id="settings-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              invalid={Boolean(emailError)}
              aria-describedby={describedBy("settings-email", null, emailError)}
              maxLength={200}
              placeholder="hello@example.ru"
            />
          </Field>
        </div>
        <LocalizedField name="address" label="Адрес" value={address} onChange={setAddress} fieldErrors={fieldErrors} maxLength={300} placeholder="Краснодар" />
      </Card>

      <Card
        title="Соцсети"
        description="Порядок здесь = порядок на сайте."
        actions={
          <Button size="sm" variant="outline" icon={<Plus className="size-4" aria-hidden />} onClick={addSocial} disabled={socials.length >= 20}>
            Добавить
          </Button>
        }
        bodyClassName="flex flex-col gap-3"
      >
        {socials.length === 0 ? <p className="text-sm text-muted">Соцсетей пока нет.</p> : null}
        {socials.map((row, index) => {
          const urlError = errorFor(fieldErrors, `socials.${index}.url`);
          const typeError = errorFor(fieldErrors, `socials.${index}.type`);
          const urlId = `social-url-${row.key}`;
          return (
            <div key={row.key} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-start">
              <div className="sm:w-44">
                <label htmlFor={`social-type-${row.key}`} className="sr-only">
                  Соцсеть {index + 1}
                </label>
                <Select
                  id={`social-type-${row.key}`}
                  value={row.type}
                  invalid={Boolean(typeError)}
                  onChange={(event) => {
                    if (isSocialType(event.target.value)) updateSocial(row.key, { type: event.target.value });
                  }}
                >
                  {SOCIAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SOCIAL_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor={urlId} className="sr-only">
                  Ссылка {index + 1}
                </label>
                <TextInput
                  id={urlId}
                  type="url"
                  value={row.url}
                  onChange={(event) => updateSocial(row.key, { url: event.target.value })}
                  invalid={Boolean(urlError)}
                  aria-describedby={describedBy(urlId, null, urlError)}
                  placeholder="https://t.me/…"
                  spellCheck={false}
                  maxLength={500}
                />
                {urlError ? (
                  <p id={`${urlId}-error`} className="text-xs font-medium text-red-fg" role="alert">
                    {urlError}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label="Выше" disabled={index === 0} onClick={() => moveSocial(index, -1)}>
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button size="sm" variant="ghost" aria-label="Ниже" disabled={index === socials.length - 1} onClick={() => moveSocial(index, 1)}>
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Удалить ссылку"
                  onClick={() => setSocials((current) => current.filter((item) => item.key !== row.key))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
        {socialsError ? (
          <p className="text-xs font-medium text-red-fg" role="alert">
            {socialsError}
          </p>
        ) : null}
      </Card>

      <Card title="SEO" description="Заголовок и описание сайта для поисковиков и соцсетей — на каждом языке." bodyClassName="flex flex-col gap-5">
        <LocalizedField
          name="seoTitle"
          label="Заголовок (title)"
          value={seoTitle}
          onChange={setSeoTitle}
          fieldErrors={fieldErrors}
          maxLength={120}
          hint="До ~60 символов видно в выдаче."
        />
        <LocalizedField
          name="seoDescription"
          label="Описание (description)"
          multiline
          rows={3}
          value={seoDescription}
          onChange={setSeoDescription}
          fieldErrors={fieldErrors}
          maxLength={400}
          hint="До ~160 символов видно в выдаче."
        />
      </Card>
    </EntityFormShell>
  );
}
