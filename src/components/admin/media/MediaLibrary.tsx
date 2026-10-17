"use client";

import { clsx } from "clsx";
import { Images, Search } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ReactElement } from "react";
import { localeNames, locales } from "@/i18n/locales";
import { formatBytes } from "@/lib/admin/labels";
import type { AdminMedia, MediaPage } from "@/lib/admin/types";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/inputs";
import { Badge, EmptyState } from "../ui/layout";
import { fetchMediaPage, MediaApiError } from "./media-api";
import { MediaDetailsDialog } from "./MediaDetailsDialog";
import { UploadDropzone, UploadProgressList } from "./UploadDropzone";
import { useUploadQueue } from "./useUploadQueue";

type Loaded = { key: string; items: AdminMedia[]; nextCursor: string | null; error: string | null };

/** Media library page: multi-upload (drag & drop), search, grid, details with alt editing and safe delete. */
export function MediaLibrary({ initial, total }: { initial: MediaPage; total: number }): ReactElement {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loaded, setLoaded] = useState<Loaded>({ key: "", items: initial.items, nextCursor: initial.nextCursor, error: null });
  const [uploaded, setUploaded] = useState<AdminMedia[]>([]);
  const [overrides, setOverrides] = useState<ReadonlyMap<string, AdminMedia>>(new Map());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (loaded.key === debouncedQuery) return;
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
  }, [debouncedQuery, loaded.key]);

  const uploads = useUploadQueue((media) => setUploaded((current) => [media, ...current]));

  const loadMore = (): void => {
    if (!loaded.nextCursor) return;
    const key = loaded.key;
    setLoadingMore(true);
    fetchMediaPage({ cursor: loaded.nextCursor, query: key }).then(
      (page) => {
        setLoaded((current) =>
          current.key === key ? { ...current, items: [...current.items, ...page.items], nextCursor: page.nextCursor } : current,
        );
        setLoadingMore(false);
      },
      () => setLoadingMore(false),
    );
  };

  const searching = loaded.key !== debouncedQuery;
  const uploadedIds = new Set(uploaded.map((item) => item.id));
  const visibleUploads = debouncedQuery ? [] : uploaded;
  const items = [...visibleUploads, ...loaded.items.filter((item) => !uploadedIds.has(item.id))]
    .filter((item) => !removed.has(item.id))
    .map((item) => overrides.get(item.id) ?? item);
  const openMedia = openId ? (items.find((item) => item.id === openId) ?? null) : null;
  const shownTotal = total + uploaded.length - removed.size;

  return (
    <div className="flex flex-col gap-5">
      <UploadDropzone onFiles={uploads.enqueue} />
      <UploadProgressList items={uploads.items} onClear={uploads.clearFinished} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <TextInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени файла"
            aria-label="Поиск по имени файла"
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {searching ? "Ищем…" : debouncedQuery ? `Найдено: ${items.length}${loaded.nextCursor ? "+" : ""}` : `Всего файлов: ${shownTotal}`}
        </p>
      </div>

      {loaded.error ? (
        <p className="rounded-md bg-red/15 px-3 py-2 text-sm text-red-fg" role="alert">
          {loaded.error}
        </p>
      ) : null}

      {items.length === 0 && !searching ? (
        <EmptyState
          icon={<Images aria-hidden />}
          title={debouncedQuery ? "Ничего не найдено" : "Медиатека пуста"}
          description={debouncedQuery ? "Попробуйте другое название файла." : "Перетащите изображения в область выше — они будут сжаты и сохранены."}
        />
      ) : (
        <ul className={clsx("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6", searching && "opacity-60")}>
          {items.map((media) => {
            const name = media.alt.ru || media.originalName || "Изображение";
            const missingAlt = locales.filter((locale) => !(media.alt[locale] ?? "").trim());
            return (
              <li key={media.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(media.id)}
                  className="group flex w-full flex-col overflow-hidden rounded-lg border border-line bg-panel text-left transition-colors hover:border-line-strong"
                >
                  <span className="relative block aspect-square w-full bg-raised">
                    <Image src={media.url} alt="" fill sizes="(min-width: 1280px) 200px, (min-width: 640px) 30vw, 45vw" className="object-cover" />
                  </span>
                  <span className="flex flex-col gap-1 p-2">
                    <span className="truncate text-xs text-fg" title={name}>
                      {name}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] text-muted">
                        {media.width}×{media.height} · {formatBytes(media.size)}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {media.usageCount > 0 ? <Badge tone="blue">используется: {media.usageCount}</Badge> : <Badge>не используется</Badge>}
                      {missingAlt.length > 0 ? (
                        <Badge tone="outline" title="Нет описания (alt) на этих языках">
                          нет alt {missingAlt.map((locale) => localeNames[locale].short).join("/")}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {loaded.nextCursor && !searching ? (
        <div className="flex justify-center">
          <Button variant="outline" pending={loadingMore} onClick={loadMore}>
            Показать ещё
          </Button>
        </div>
      ) : null}

      <MediaDetailsDialog
        media={openMedia}
        onClose={() => setOpenId(null)}
        onUpdated={(media) => setOverrides((current) => new Map(current).set(media.id, media))}
        onDeleted={(id) => setRemoved((current) => new Set(current).add(id))}
      />
    </div>
  );
}
