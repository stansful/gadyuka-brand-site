"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { errorFor } from "@/lib/admin/action-result";
import { saveOffer } from "@/lib/admin/actions/offers";
import type { AdminMediaRef, OfferFormData } from "@/lib/admin/types";
import type { LocalizedText } from "@/lib/i18n-text";
import { EditLocaleProvider, localesWithErrors, translationGaps } from "../i18n/LocaleTabs";
import { LocalizedField } from "../i18n/LocalizedField";
import { MediaPicker } from "../media/MediaPicker";
import { describedBy, Field } from "../ui/Field";
import { TextInput } from "../ui/inputs";
import { Card } from "../ui/layout";
import { Switch } from "../ui/Switch";
import { useActionSubmit } from "../ui/useActionSubmit";
import { EntityFormShell } from "./EntityFormShell";
import { siteLinksFor } from "./site-links";

const LOCALIZED = ["title", "text", "badge", "ctaLabel"] as const;

export function OfferForm({ initial }: { initial: OfferFormData | null }): ReactElement {
  return (
    <EditLocaleProvider>
      <OfferFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function OfferFormInner({ initial }: { initial: OfferFormData | null }): ReactElement {
  const router = useRouter();
  const [title, setTitle] = useState<LocalizedText>(initial?.title ?? {});
  const [text, setText] = useState<LocalizedText>(initial?.text ?? {});
  const [badge, setBadge] = useState<LocalizedText>(initial?.badge ?? {});
  const [ctaLabel, setCtaLabel] = useState<LocalizedText>(initial?.ctaLabel ?? {});
  const [ctaHref, setCtaHref] = useState(initial?.ctaHref ?? "");
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? "");
  const [image, setImage] = useState<AdminMediaRef | null>(initial?.image ?? null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(
      () =>
        saveOffer(initial?.id ?? null, {
          title,
          text,
          badge,
          ctaLabel,
          ctaHref: ctaHref.trim() === "" ? null : ctaHref.trim(),
          validUntil: validUntil === "" ? null : validUntil,
          imageId: image?.id ?? null,
          published,
        }),
      {
        onSuccess: (data) => {
          if (!initial) router.replace(`/admin/offers/${data.id}`);
        },
      },
    );
  };

  const hrefError = errorFor(fieldErrors, "ctaHref");
  const untilError = errorFor(fieldErrors, "validUntil");
  const hrefHint = "Например: #contacts, /en#tailoring или https://t.me/…";
  const untilHint = "Последний день акции (включительно). После него предложение скрывается с сайта. Пусто — бессрочно.";

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([title, text, badge, ctaLabel])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor("offers") : undefined}
      remove={initial ? { entity: "offer", id: initial.id, noun: "предложение", listHref: "/admin/offers" } : undefined}
      aside={
        <>
          <Card title="Публикация" bodyClassName="flex flex-col gap-5">
            <Switch checked={published} onCheckedChange={setPublished} label="Показывать на сайте" />
            <Field htmlFor="offer-until" label="Действует до" hint={untilHint} error={untilError}>
              <div className="flex gap-2">
                <TextInput
                  id="offer-until"
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                  invalid={Boolean(untilError)}
                  aria-describedby={describedBy("offer-until", untilHint, untilError)}
                />
                {validUntil ? (
                  <button type="button" onClick={() => setValidUntil("")} className="shrink-0 rounded-md px-2 text-xs text-muted hover:text-fg">
                    Очистить
                  </button>
                ) : null}
              </div>
            </Field>
          </Card>
          <Card title="Изображение">
            <MediaPicker id="offer-image" label="Картинка (необязательно)" value={image} onChange={setImage} aspect="wide" error={errorFor(fieldErrors, "imageId")} />
          </Card>
        </>
      }
    >
      <Card title="Предложение" bodyClassName="flex flex-col gap-5">
        <LocalizedField name="title" label="Заголовок" required value={title} onChange={setTitle} fieldErrors={fieldErrors} maxLength={200} />
        <LocalizedField
          name="badge"
          label="Плашка"
          value={badge}
          onChange={setBadge}
          fieldErrors={fieldErrors}
          maxLength={40}
          placeholder="−15%"
          hint="Короткий акцент на карточке. Пусто — без плашки."
        />
        <LocalizedField name="text" label="Текст" multiline rows={5} value={text} onChange={setText} fieldErrors={fieldErrors} maxLength={3000} />
      </Card>
      <Card title="Кнопка" description="Необязательно. Если подпись пустая — кнопки не будет." bodyClassName="flex flex-col gap-5">
        <LocalizedField name="ctaLabel" label="Подпись кнопки" value={ctaLabel} onChange={setCtaLabel} fieldErrors={fieldErrors} maxLength={60} />
        <Field htmlFor="offer-href" label="Ссылка кнопки" hint={hrefHint} error={hrefError}>
          <TextInput
            id="offer-href"
            value={ctaHref}
            onChange={(event) => setCtaHref(event.target.value)}
            invalid={Boolean(hrefError)}
            aria-describedby={describedBy("offer-href", hrefHint, hrefError)}
            maxLength={500}
            spellCheck={false}
            className="font-mono"
          />
        </Field>
      </Card>
    </EntityFormShell>
  );
}
