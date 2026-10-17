"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { errorFor } from "@/lib/admin/action-result";
import { saveGalleryItem } from "@/lib/admin/actions/gallery";
import type { AdminMediaRef, GalleryFormData } from "@/lib/admin/types";
import type { LocalizedText } from "@/lib/i18n-text";
import { EditLocaleProvider, localesWithErrors, translationGaps } from "../i18n/LocaleTabs";
import { LocalizedField } from "../i18n/LocalizedField";
import { MediaPicker } from "../media/MediaPicker";
import { Card } from "../ui/layout";
import { Switch } from "../ui/Switch";
import { useActionSubmit } from "../ui/useActionSubmit";
import { EntityFormShell } from "./EntityFormShell";
import { siteLinksFor } from "./site-links";

const LOCALIZED = ["caption"] as const;

export function GalleryForm({ initial }: { initial: GalleryFormData | null }): ReactElement {
  return (
    <EditLocaleProvider>
      <GalleryFormInner initial={initial} />
    </EditLocaleProvider>
  );
}

function GalleryFormInner({ initial }: { initial: GalleryFormData | null }): ReactElement {
  const router = useRouter();
  const [media, setMedia] = useState<AdminMediaRef | null>(initial?.media ?? null);
  const [caption, setCaption] = useState<LocalizedText>(initial?.caption ?? {});
  const [published, setPublished] = useState(initial?.published ?? true);
  const { pending, fieldErrors, setFieldErrors, run } = useActionSubmit();

  const submit = (): void => {
    if (!media) {
      setFieldErrors({ mediaId: "Выберите изображение" });
      return;
    }
    run(() => saveGalleryItem(initial?.id ?? null, { mediaId: media.id, caption, published }), {
      onSuccess: (data) => {
        if (!initial) router.replace(`/admin/gallery/${data.id}`);
      },
    });
  };

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={initial === null}
      localeGaps={translationGaps([caption])}
      localeErrors={localesWithErrors(fieldErrors, LOCALIZED)}
      siteLinks={initial ? siteLinksFor("gallery") : undefined}
      remove={initial ? { entity: "gallery", id: initial.id, noun: "фото из галереи", listHref: "/admin/gallery" } : undefined}
      aside={
        <Card title="Публикация">
          <Switch checked={published} onCheckedChange={setPublished} label="Показывать на сайте" />
        </Card>
      }
    >
      <Card title="Фото" bodyClassName="flex flex-col gap-5">
        <MediaPicker
          id="gallery-media"
          label="Изображение"
          required
          value={media}
          onChange={setMedia}
          aspect="wide"
          error={errorFor(fieldErrors, "mediaId")}
          hint="Описание (alt) для незрячих задаётся в медиатеке."
        />
        <LocalizedField name="caption" label="Подпись" value={caption} onChange={setCaption} fieldErrors={fieldErrors} maxLength={300} />
      </Card>
    </EntityFormShell>
  );
}
