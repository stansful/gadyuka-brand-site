"use client";

import { Copy, ExternalLink, Trash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { deleteMedia, updateMediaAlt } from "@/lib/admin/actions/media";
import { formatBytes, formatDateTimeRu } from "@/lib/admin/labels";
import type { AdminMedia, MediaUsage } from "@/lib/admin/types";
import type { LocalizedText } from "@/lib/i18n-text";
import { EditLocaleProvider, LocaleTabs, localesWithErrors, translationGaps } from "../i18n/LocaleTabs";
import { LocalizedField } from "../i18n/LocalizedField";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { NETWORK_ERROR_MESSAGE, useActionSubmit } from "../ui/useActionSubmit";
import { useConfirm } from "../ui/useConfirm";
import { fetchMediaDetails, MediaApiError } from "./media-api";

/** Media details: preview, info, alt text per language, usages, delete (blocked while used). */
export function MediaDetailsDialog({
  media,
  onClose,
  onUpdated,
  onDeleted,
}: {
  media: AdminMedia | null;
  onClose: () => void;
  onUpdated: (media: AdminMedia) => void;
  onDeleted: (id: string) => void;
}): ReactElement {
  return (
    <Modal open={media !== null} onClose={onClose} size="lg" title="Изображение" description={media?.originalName ?? undefined}>
      {media ? <DetailsBody key={media.id} media={media} onUpdated={onUpdated} onDeleted={onDeleted} onClose={onClose} /> : null}
    </Modal>
  );
}

type UsageState = { status: "loading" } | { status: "ready"; usages: MediaUsage[] } | { status: "error"; message: string };

function DetailsBody({
  media,
  onUpdated,
  onDeleted,
  onClose,
}: {
  media: AdminMedia;
  onUpdated: (media: AdminMedia) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}): ReactElement {
  const [alt, setAlt] = useState<LocalizedText>(media.alt);
  const [usage, setUsage] = useState<UsageState>({ status: "loading" });
  const [deleting, startDelete] = useTransition();
  const [confirmDialog, confirm] = useConfirm();
  const save = useActionSubmit();

  useEffect(() => {
    const controller = new AbortController();
    fetchMediaDetails(media.id, controller.signal).then(
      (details) => setUsage({ status: "ready", usages: details.usages }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setUsage({ status: "error", message: error instanceof MediaApiError ? error.message : "Не удалось проверить использование" });
      },
    );
    return () => controller.abort();
  }, [media.id]);

  const usages = usage.status === "ready" ? usage.usages : [];
  const inUse = usages.length > 0;

  const copyUrl = (): void => {
    const absolute = new URL(media.url, window.location.origin).toString();
    navigator.clipboard.writeText(absolute).then(
      () => toast.success("Ссылка скопирована"),
      () => toast.error("Не удалось скопировать ссылку"),
    );
  };

  const onDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Удалить файл?",
      description: "Файл будет удалён с сервера без возможности восстановления.",
    });
    if (!confirmed) return;
    startDelete(async () => {
      try {
        const result = await deleteMedia(media.id);
        if (result.ok) {
          toast.success(result.message ?? "Файл удалён");
          onDeleted(media.id);
          onClose();
          return;
        }
        if ("usages" in result) setUsage({ status: "ready", usages: result.usages });
        toast.error(result.error);
      } catch {
        toast.error(NETWORK_ERROR_MESSAGE);
      }
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-raised">
          <Image src={media.url} alt={alt.ru ?? ""} fill sizes="(min-width: 768px) 420px, 90vw" className="object-contain" />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">Размер</dt>
          <dd>
            {media.width} × {media.height} px · {formatBytes(media.size)}
          </dd>
          <dt className="text-muted">Формат</dt>
          <dd>{media.mime}</dd>
          <dt className="text-muted">Загружено</dt>
          <dd>{formatDateTimeRu(media.createdAt)}</dd>
          <dt className="text-muted">Адрес</dt>
          <dd className="truncate font-mono" title={media.url}>
            {media.url}
          </dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={<Copy className="size-4" aria-hidden />} onClick={copyUrl}>
            Копировать ссылку
          </Button>
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium text-fg/80 hover:bg-raised-hi hover:text-fg"
          >
            <ExternalLink className="size-4" aria-hidden />
            Открыть файл
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <EditLocaleProvider>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              save.run(() => updateMediaAlt(media.id, alt), {
                onSuccess: (data) => onUpdated({ ...media, alt: data.alt }),
              });
            }}
          >
            <LocaleTabs gaps={translationGaps([alt])} errors={localesWithErrors(save.fieldErrors, ["alt"])} />
            <LocalizedField
              name="alt"
              idPrefix={`media-${media.id}`}
              label="Описание (alt)"
              hint="Что изображено — для незрячих посетителей и поисковиков. Например: «Белое худи с гравюрной змеёй»."
              value={alt}
              onChange={setAlt}
              fieldErrors={save.fieldErrors}
              maxLength={300}
            />
            <div>
              <Button type="submit" variant="primary" pending={save.pending}>
                Сохранить описание
              </Button>
            </div>
          </form>
        </EditLocaleProvider>

        <section aria-labelledby={`usage-${media.id}`} className="flex flex-col gap-2 border-t border-line pt-4">
          <h3 id={`usage-${media.id}`} className="text-sm font-semibold">
            Где используется
          </h3>
          {usage.status === "loading" ? (
            <p className="text-xs text-muted">Проверяем…</p>
          ) : usage.status === "error" ? (
            <p className="text-xs text-red-fg">{usage.message}</p>
          ) : usages.length === 0 ? (
            <p className="text-xs text-muted">Нигде — файл можно удалить.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {usages.map((item, index) => (
                <li key={`${item.href}-${index}`}>
                  <Link href={item.href} className="text-beige underline-offset-4 hover:underline">
                    {item.kind}: {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="border-t border-line pt-4">
          <Button
            variant="danger"
            size="sm"
            icon={<Trash className="size-4" aria-hidden />}
            pending={deleting}
            disabled={usage.status !== "ready" || inUse}
            onClick={() => void onDelete()}
          >
            Удалить файл
          </Button>
          {inUse ? (
            <p className="mt-2 text-xs text-muted">Удаление недоступно, пока файл используется. Замените его в местах выше.</p>
          ) : null}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
