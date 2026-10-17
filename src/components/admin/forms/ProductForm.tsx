"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { errorFor } from "@/lib/admin/action-result";
import { saveProduct } from "@/lib/admin/actions/products";
import { slugify } from "@/lib/admin/slug";
import type { AdminMediaRef, CollectionOption, ProductFormData } from "@/lib/admin/types";
import type { LocalizedText } from "@/lib/i18n-text";
import { EditLocaleProvider, localesWithErrors, translationGaps } from "../i18n/LocaleTabs";
import { LocalizedField } from "../i18n/LocalizedField";
import { MediaGalleryField } from "../media/MediaGalleryField";
import { describedBy, Field } from "../ui/Field";
import { Select, TextInput } from "../ui/inputs";
import { Card } from "../ui/layout";
import { Switch } from "../ui/Switch";
import { useActionSubmit } from "../ui/useActionSubmit";
import { EntityFormShell } from "./EntityFormShell";
import { collectionSiteLinks, siteLinksFor } from "./site-links";
import { SlugField } from "./SlugField";

const LOCALIZED = ["title", "description", "details"] as const;

export function ProductForm({
  initial,
  collections,
  defaultCollectionId,
}: {
  initial: ProductFormData | null;
  collections: CollectionOption[];
  defaultCollectionId?: string;
}): ReactElement {
  return (
    <EditLocaleProvider>
      <ProductFormInner initial={initial} collections={collections} defaultCollectionId={defaultCollectionId} />
    </EditLocaleProvider>
  );
}

/** "12 900" → 12900; "" → null; anything else → NaN (the server reports the error). */
function parsePrice(value: string): number | null {
  const compact = value.replace(/[\s ₽]/g, "");
  if (compact === "") return null;
  return /^\d+$/.test(compact) ? Number(compact) : Number.NaN;
}

function ProductFormInner({
  initial,
  collections,
  defaultCollectionId,
}: {
  initial: ProductFormData | null;
  collections: CollectionOption[];
  defaultCollectionId?: string;
}): ReactElement {
  const router = useRouter();
  const [title, setTitle] = useState<LocalizedText>(initial?.title ?? {});
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(initial !== null);
  const [collectionId, setCollectionId] = useState(initial?.collectionId ?? defaultCollectionId ?? collections[0]?.id ?? "");
  const [description, setDescription] = useState<LocalizedText>(initial?.description ?? {});
  const [details, setDetails] = useState<LocalizedText>(initial?.details ?? {});
  const [price, setPrice] = useState(initial?.price === null || initial?.price === undefined ? "" : String(initial.price));
  const [images, setImages] = useState<AdminMediaRef[]>(initial?.images ?? []);
  const [published, setPublished] = useState(initial?.published ?? false);
  const { pending, fieldErrors, setFieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    const parsedPrice = parsePrice(price);
    if (Number.isNaN(parsedPrice)) {
      setFieldErrors({ price: "Укажите цену целым числом рублей, например 12900, или оставьте пустым" });
      return;
    }
    run(
      () =>
        saveProduct(initial?.id ?? null, {
          slug,
          collectionId,
          title,
          description,
          details,
          price: parsedPrice,
          imageIds: images.map((image) => image.id),
          published,
        }),
      {
        onSuccess: (data) => {
          if (!initial) router.replace(`/admin/products/${data.id}`);
        },
      },
    );
  };

  const priceError = errorFor(fieldErrors, "price");
  const collectionError = errorFor(fieldErrors, "collectionId");
  const priceHint = "Целое число рублей. Пусто — «цена по запросу».";
  const savedCollection = initial ? collections.find((collection) => collection.id === initial.collectionId) : undefined;

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([title, description, details])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={
        initial && savedCollection ? collectionSiteLinks(savedCollection.slug, initial.slug) : initial ? siteLinksFor("catalog") : undefined
      }
      remove={initial ? { entity: "product", id: initial.id, noun: "товар", listHref: "/admin/products" } : undefined}
      aside={
        <>
          <Card title="Публикация" bodyClassName="flex flex-col gap-5">
            <Switch checked={published} onCheckedChange={setPublished} label="Показывать на сайте" />
            <Field htmlFor="product-collection" label="Коллекция" required error={collectionError}>
              <Select
                id="product-collection"
                value={collectionId}
                onChange={(event) => setCollectionId(event.target.value)}
                invalid={Boolean(collectionError)}
                aria-describedby={describedBy("product-collection", null, collectionError)}
              >
                {collections.length === 0 ? <option value="">Сначала создайте коллекцию</option> : null}
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="product-price" label="Цена, ₽" hint={priceHint} error={priceError}>
              <TextInput
                id="product-price"
                inputMode="numeric"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="цена по запросу"
                invalid={Boolean(priceError)}
                aria-describedby={describedBy("product-price", priceHint, priceError)}
              />
            </Field>
          </Card>
          <Card title="Фото">
            <MediaGalleryField
              id="product-images"
              label="Фотографии товара"
              hint="Перетаскивайте, чтобы изменить порядок. Первое фото — главное."
              value={images}
              onChange={setImages}
              error={errorFor(fieldErrors, "imageIds")}
            />
          </Card>
        </>
      }
    >
      <Card title="Описание" bodyClassName="flex flex-col gap-5">
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
          placeholder="Худи «Знак», белое"
        />
        <SlugField
          id="product-slug"
          value={slug}
          onChange={(next) => {
            setSlugTouched(true);
            setSlug(next);
          }}
          source={title.ru ?? ""}
          error={fieldErrors.slug}
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
        <LocalizedField
          name="details"
          label="Детали"
          multiline
          rows={5}
          value={details}
          onChange={setDetails}
          fieldErrors={fieldErrors}
          maxLength={5000}
          hint="Каждая строка — отдельный пункт списка (ткань, принт, посадка…)."
        />
      </Card>
    </EntityFormShell>
  );
}
