"use client";

import { clsx } from "clsx";
import { Check, Search } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { formatBytes } from "@/lib/admin/labels";
import type { AdminMedia } from "@/lib/admin/types";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/inputs";
import { Modal } from "../ui/Modal";
import { fetchMediaPage, MediaApiError } from "./media-api";
import { UploadDropzone, UploadProgressList } from "./UploadDropzone";
import { useUploadQueue } from "./useUploadQueue";

export type MediaLibraryDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen files (one in single mode). */
  onSelect: (media: AdminMedia[]) => void;
  multiple?: boolean;
  title?: string;
  /** Already used ids (shown as «уже добавлено», not selectable). */
  excludeIds?: readonly string[];
};

/** Media picker: search, upload (drag & drop), choose one or several images. */
export function MediaLibraryDialog({
  open,
  onClose,
  onSelect,
  multiple = false,
  title,
  excludeIds = [],
}: MediaLibraryDialogProps): ReactElement {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={title ?? (multiple ? "Выберите изображения" : "Выберите изображение")}
      description="Из медиатеки или загрузите новые — они сразу появятся в медиатеке."
    >
      <PickerBody multiple={multiple} excludeIds={excludeIds} onSelect={onSelect} onClose={onClose} />
    </Modal>
  );
}

type Loaded = { key: string; items: AdminMedia[]; nextCursor: string | null; error: string | null };

/** Mounted only while the dialog is open → fresh state and data on every open. */
function PickerBody({
  multiple,
  excludeIds,
  onSelect,
  onClose,
}: {
  multiple: boolean;
  excludeIds: readonly string[];
  onSelect: (media: AdminMedia[]) => void;
  onClose: () => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [uploaded, setUploaded] = useState<AdminMedia[]>([]);
  const [selected, setSelected] = useState<AdminMedia[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const key = debouncedQuery;
    fetchMediaPage({ query: key }, controller.signal).then(
      (page) => setLoaded({ key, items: page.items, nextCursor: page.nextCursor, error: null }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({ key, items: [], nextCursor: null, error: error instanceof MediaApiError ? error.message : "Не удалось загрузить медиатеку" });
      },
    );
    return () => controller.abort();
  }, [debouncedQuery]);

  const loading = loaded === null || loaded.key !== debouncedQuery;
  const excluded = new Set(excludeIds);

  const toggle = useCallback(
    (media: AdminMedia) => {
      if (!multiple) {
        onSelect([media]);
        onClose();
        return;
      }
      setSelected((current) =>
        current.some((item) => item.id === media.id) ? current.filter((item) => item.id !== media.id) : [...current, media],
      );
    },
    [multiple, onClose, onSelect],
  );

  const uploads = useUploadQueue((media) => {
    setUploaded((current) => [media, ...current]);
    if (multiple) setSelected((current) => [...current, media]);
  });

  const loadMore = (): void => {
    if (!loaded?.nextCursor) return;
    setLoadingMore(true);
    fetchMediaPage({ cursor: loaded.nextCursor, query: loaded.key }).then(
      (page) => {
        setLoaded((current) =>
          current && current.key === loaded.key
            ? { ...current, items: [...current.items, ...page.items], nextCursor: page.nextCursor }
            : current,
        );
        setLoadingMore(false);
      },
      () => setLoadingMore(false),
    );
  };

  const uploadedIds = new Set(uploaded.map((item) => item.id));
  const items = [...uploaded, ...(loaded?.items ?? []).filter((item) => !uploadedIds.has(item.id))];
  const selectedIds = new Set(selected.map((item) => item.id));

  return (
    <div className="flex flex-col gap-4">
      <UploadDropzone compact onFiles={uploads.enqueue} />
      <UploadProgressList items={uploads.items} onClear={uploads.clearFinished} />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <TextInput
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Search is live (debounced); Enter must never submit anything.
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder="Поиск по имени файла"
          aria-label="Поиск по имени файла"
          className="pl-9"
        />
      </div>

      {loaded?.error ? (
        <p className="rounded-md bg-red/15 px-3 py-2 text-sm text-red-fg" role="alert">
          {loaded.error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-busy>
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-lg bg-raised-hi" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {debouncedQuery ? "Ничего не найдено." : "Медиатека пуста — загрузите первое изображение."}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((media) => {
            const isExcluded = excluded.has(media.id);
            const isSelected = selectedIds.has(media.id);
            const name = media.alt.ru || media.originalName || "Изображение";
            return (
              <li key={media.id}>
                <button
                  type="button"
                  disabled={isExcluded}
                  aria-pressed={multiple ? isSelected : undefined}
                  onClick={() => toggle(media)}
                  title={`${name} · ${media.width}×${media.height} · ${formatBytes(media.size)}`}
                  className={clsx(
                    "group relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-raised transition-colors",
                    isSelected ? "border-beige" : "border-transparent hover:border-line-strong",
                    isExcluded && "cursor-not-allowed opacity-40",
                  )}
                >
                  <Image src={media.url} alt="" fill sizes="(min-width: 1024px) 160px, 30vw" className="object-cover" />
                  <span className="sr-only">{name}</span>
                  {isSelected ? (
                    <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-beige text-ink">
                      <Check className="size-4" aria-hidden />
                    </span>
                  ) : null}
                  {isExcluded ? (
                    <span className="absolute inset-x-0 bottom-0 bg-ink/80 px-1 py-0.5 text-center text-[10px] text-fg">уже добавлено</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {loaded?.nextCursor ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" pending={loadingMore} onClick={loadMore}>
            Показать ещё
          </Button>
        </div>
      ) : null}

      {multiple ? (
        <div className="sticky bottom-0 -mx-5 -mb-4 flex items-center justify-between gap-3 border-t border-line bg-panel px-5 py-3">
          <span className="text-sm text-muted">Выбрано: {selected.length}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button
              variant="primary"
              disabled={selected.length === 0 || uploads.busy}
              onClick={() => {
                onSelect(selected);
                onClose();
              }}
            >
              Добавить ({selected.length})
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
