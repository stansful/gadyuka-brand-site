"use client";

import { useState, type ReactElement } from "react";
import { saveContentSection } from "@/lib/admin/actions/content";
import { formatDateTimeRu } from "@/lib/admin/labels";
import type { AdminMediaRef, ContentSectionData } from "@/lib/admin/types";
import type { LocalizedText } from "@/lib/i18n-text";
import { EditLocaleProvider, translationGaps } from "../i18n/LocaleTabs";
import { LocalizedField } from "../i18n/LocalizedField";
import { MediaPicker } from "../media/MediaPicker";
import { Card } from "../ui/layout";
import { useActionSubmit } from "../ui/useActionSubmit";
import { errorLocales, errorsByBlockKey } from "./content-errors";
import { EntityFormShell } from "./EntityFormShell";
import { siteLinksFor } from "./site-links";

type BlockState = { value: LocalizedText; media: AdminMediaRef | null };

export function ContentSectionForm({ data }: { data: ContentSectionData }): ReactElement {
  return (
    <EditLocaleProvider>
      <ContentSectionFormInner key={data.section} data={data} />
    </EditLocaleProvider>
  );
}

function ContentSectionFormInner({ data }: { data: ContentSectionData }): ReactElement {
  const [blocks, setBlocks] = useState<Record<string, BlockState>>(() =>
    Object.fromEntries(data.blocks.map((block) => [block.key, { value: block.value, media: block.media }])),
  );
  const { pending, fieldErrors, run } = useActionSubmit();
  const keys = data.blocks.map((block) => block.key);
  const errors = errorsByBlockKey(fieldErrors, keys);

  const update = (key: string, patch: Partial<BlockState>): void => {
    setBlocks((current) => {
      const existing = current[key] ?? { value: {}, media: null };
      return { ...current, [key]: { ...existing, ...patch } };
    });
  };

  const submit = (): void => {
    run(() =>
      saveContentSection({
        section: data.section,
        blocks: data.blocks.map((block) => {
          const state = blocks[block.key];
          return block.kind === "IMAGE"
            ? { key: block.key, mediaId: state?.media?.id ?? null }
            : { key: block.key, value: state?.value ?? {} };
        }),
      }),
    );
  };

  const textValues = data.blocks.filter((block) => block.kind !== "IMAGE").map((block) => blocks[block.key]?.value ?? {});
  const lastUpdated = data.blocks
    .map((block) => block.updatedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  return (
    <EntityFormShell
      onSubmit={submit}
      pending={pending}
      isNew={false}
      localeGaps={translationGaps(textValues)}
      localeErrors={errorLocales(errors, keys)}
      siteLinks={siteLinksFor(data.anchor)}
    >
      <Card
        title={data.label}
        description={lastUpdated ? `Последнее изменение: ${formatDateTimeRu(lastUpdated)}` : undefined}
        bodyClassName="flex flex-col gap-6"
      >
        {data.blocks.map((block) => {
          const state = blocks[block.key] ?? { value: {}, media: null };
          const keyHint = <span className="font-mono text-[11px] text-muted/80">{block.key}</span>;
          if (block.kind === "IMAGE") {
            return (
              <MediaPicker
                key={block.key}
                id={`block-${block.key.replace(/\./g, "-")}`}
                label={block.label}
                value={state.media}
                onChange={(media) => update(block.key, { media })}
                aspect="wide"
                error={errors[block.key]}
                hint={keyHint}
              />
            );
          }
          return (
            <LocalizedField
              key={block.key}
              idPrefix="block"
              name={block.key}
              label={block.label}
              value={state.value}
              onChange={(value) => update(block.key, { value })}
              multiline={block.kind === "RICHTEXT"}
              rows={block.kind === "RICHTEXT" ? 5 : 3}
              fieldErrors={errors}
              hint={
                block.kind === "RICHTEXT" ? (
                  <>
                    Абзацы разделяйте пустой строкой. · {keyHint}
                  </>
                ) : block.kind === "LINK" ? (
                  <>Ссылка: https://…, /… или #раздел · {keyHint}</>
                ) : (
                  keyHint
                )
              }
            />
          );
        })}
      </Card>
    </EntityFormShell>
  );
}
