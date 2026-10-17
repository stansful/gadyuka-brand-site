"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { errorFor } from "@/lib/admin/action-result";
import { saveCollection } from "@/lib/admin/actions/collections";
import { countRu } from "@/lib/admin/labels";
import { slugify } from "@/lib/admin/slug";
import type { AdminMediaRef, CollectionFormData } from "@/lib/admin/types";
import type { LocalizedText } from "@/lib/i18n-text";
import { EditLocaleProvider, localesWithErrors, translationGaps } from "../i18n/LocaleTabs";
import { LocalizedField } from "../i18n/LocalizedField";
import { MediaPicker } from "../media/MediaPicker";
import { Card } from "../ui/layout";
import { Switch } from "../ui/Switch";
import { useActionSubmit } from "../ui/useActionSubmit";
import { EntityFormShell } from "./EntityFormShell";
import { collectionSiteLinks } from "./site-links";
import { SlugField } from "./SlugField";

const LOCALIZED = ["title", "description"] as const;

export function CollectionForm({ initial }: { initial: CollectionFormData | null }): ReactElement {
  return (
    <EditLocaleProvider>
      <CollectionFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function CollectionFormInner({ initial }: { initial: CollectionFormData | null }): ReactElement {
  const router = useRouter();
  const [title, setTitle] = useState<LocalizedText>(initial?.title ?? {});
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(initial !== null);
  const [description, setDescription] = useState<LocalizedText>(initial?.description ?? {});
  const [cover, setCover] = useState<AdminMediaRef | null>(initial?.cover ?? null);
  const [published, setPublished] = useState(initial?.published ?? false);
  const { pending, fieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    run(() => saveCollection(initial?.id ?? null, { slug, title, description, coverId: cover?.id ?? null, published }), {
      onSuccess: (data) => {
        if (!initial) router.replace(`/admin/collections/${data.id}`);
      },
    });
  };

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([title, description])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? collectionSiteLinks(initial.slug) : undefined}
      remove={
        initial
          ? {
              entity: "collection",
              id: initial.id,
              noun: "коллекцию",
              listHref: "/admin/collections",
              warning:
                initial.productCount > 0
                  ? `Вместе с коллекцией будут удалены ${countRu(initial.productCount, "товар", "товара", "товаров")}.`
                  : undefined,
            }
          : undefined
      }
      aside={
        <>
          <Card title="Публикация">
            <Switch
              checked={published}
              onCheckedChange={setPublished}
              label="Показывать на сайте"
              description="Скрытая коллекция и её товары не видны посетителям."
            />
          </Card>
          <Card title="Обложка">
            <MediaPicker
              id="collection-cover"
              label="Изображение коллекции"
              value={cover}
              onChange={setCover}
              aspect="wide"
              error={errorFor(fieldErrors, "coverId")}
            />
          </Card>
        </>
      }
    >
      <Card title="Основное" bodyClassName="flex flex-col gap-5">
        <LocalizedField
          name="title"
          label="Название"
          required
          value={title}
          onChange={(next) => {
            setTitle(next);
            if (!slugTouched) setSlug(slugify(next.ru ?? ""));
          }}
          fieldErrors={fieldErrors}
          maxLength={200}
          placeholder="Меня запомнят"
          hint="Никогда не называйте коллекцию «первой» или «дебютной»."
        />
        <SlugField
          id="collection-slug"
          value={slug}
          onChange={(next) => {
            setSlugTouched(true);
            setSlug(next);
          }}
          source={title.ru ?? ""}
          error={fieldErrors.slug}
          prefix="/catalog/"
        />
        <LocalizedField
          name="description"
          label="Описание"
          multiline
          rows={5}
          value={description}
          onChange={setDescription}
          fieldErrors={fieldErrors}
          maxLength={5000}
        />
      </Card>
    </EntityFormShell>
  );
}
