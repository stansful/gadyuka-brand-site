"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { errorFor } from "@/lib/admin/action-result";
import { saveReview } from "@/lib/admin/actions/reviews";
import type { AdminMediaRef, ReviewFormData } from "@/lib/admin/types";
import type { LocalizedText } from "@/lib/i18n-text";
import { EditLocaleProvider, localesWithErrors, translationGaps } from "../i18n/LocaleTabs";
import { LocalizedField } from "../i18n/LocalizedField";
import { MediaPicker } from "../media/MediaPicker";
import { describedBy, Field } from "../ui/Field";
import { Select, TextInput } from "../ui/inputs";
import { Card } from "../ui/layout";
import { Switch } from "../ui/Switch";
import { useActionSubmit } from "../ui/useActionSubmit";
import { EntityFormShell } from "./EntityFormShell";
import { siteLinksFor } from "./site-links";

const LOCALIZED = ["role", "text"] as const;

export function ReviewForm({ initial }: { initial: ReviewFormData | null }): ReactElement {
  return (
    <EditLocaleProvider>
      <ReviewFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function ReviewFormInner({ initial }: { initial: ReviewFormData | null }): ReactElement {
  const router = useRouter();
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [role, setRole] = useState<LocalizedText>(initial?.role ?? {});
  const [text, setText] = useState<LocalizedText>(initial?.text ?? {});
  const [avatar, setAvatar] = useState<AdminMediaRef | null>(initial?.avatar ?? null);
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(() => saveReview(initial?.id ?? null, { author, role, text, avatarId: avatar?.id ?? null, rating, published }), {
      onSuccess: (data) => {
        if (!initial) router.replace(`/admin/reviews/${data.id}`);
      },
    });
  };

  const authorError = errorFor(fieldErrors, "author");
  const ratingError = errorFor(fieldErrors, "rating");

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([role, text])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor("reviews") : undefined}
      remove={initial ? { entity: "review", id: initial.id, noun: "отзыв", listHref: "/admin/reviews" } : undefined}
      aside={
        <>
          <Card title="Публикация">
            <Switch checked={published} onCheckedChange={setPublished} label="Показывать на сайте" />
          </Card>
          <Card title="Фото автора">
            <MediaPicker
              id="review-avatar"
              label="Аватар (необязательно)"
              value={avatar}
              onChange={setAvatar}
              error={errorFor(fieldErrors, "avatarId")}
            />
          </Card>
        </>
      }
    >
      <Card title="Отзыв" bodyClassName="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_200px]">
          <Field htmlFor="review-author" label="Автор" required error={authorError} hint="Одинаково на всех языках.">
            <TextInput
              id="review-author"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              invalid={Boolean(authorError)}
              aria-describedby={describedBy("review-author", true, authorError)}
              aria-required
              maxLength={120}
              placeholder="Сергей"
            />
          </Field>
          <Field htmlFor="review-rating" label="Оценка" error={ratingError}>
            <Select
              id="review-rating"
              value={rating === null ? "" : String(rating)}
              onChange={(event) => setRating(event.target.value === "" ? null : Number(event.target.value))}
              invalid={Boolean(ratingError)}
            >
              <option value="">Без оценки</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {"★".repeat(value)} ({value})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <LocalizedField
          name="role"
          label="Подпись к автору"
          value={role}
          onChange={setRole}
          fieldErrors={fieldErrors}
          maxLength={120}
          placeholder="покупатель"
        />
        <LocalizedField
          name="text"
          label="Текст отзыва"
          required
          multiline
          rows={6}
          value={text}
          onChange={setText}
          fieldErrors={fieldErrors}
          maxLength={3000}
        />
      </Card>
    </EntityFormShell>
  );
}
