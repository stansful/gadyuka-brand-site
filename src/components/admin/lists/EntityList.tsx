"use client";

import {
  closestCenter,
  DndContext,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import { GripVertical, Pencil, Trash } from "lucide-react";
import Link from "next/link";
import { useId, useOptimistic, useTransition, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import { localeNames } from "@/i18n/locales";
import { deleteItem, reorderItems, setPublished } from "@/lib/admin/actions/entities";
import type { OrderableEntity, PublishableEntity } from "@/lib/admin/schemas";
import type { EntityRow } from "@/lib/admin/types";
import { MediaThumb } from "../media/MediaThumb";
import { Badge, EmptyState } from "../ui/layout";
import { Switch } from "../ui/Switch";
import { useConfirm } from "../ui/useConfirm";
import { NETWORK_ERROR_MESSAGE } from "../ui/useActionSubmit";
import { makeAnnouncements, moveId, screenReaderInstructions, useSortableSensors } from "./dnd";

type OptimisticAction =
  | { type: "reorder"; ids: string[] }
  | { type: "publish"; id: string; published: boolean }
  | { type: "remove"; id: string };

function applyAction(rows: EntityRow[], action: OptimisticAction): EntityRow[] {
  switch (action.type) {
    case "reorder": {
      const byId = new Map(rows.map((row) => [row.id, row]));
      return action.ids.map((id) => byId.get(id)).filter((row): row is EntityRow => row !== undefined);
    }
    case "publish":
      return rows.map((row) => (row.id === action.id ? { ...row, published: action.published } : row));
    case "remove":
      return rows.filter((row) => row.id !== action.id);
  }
}

function isOrderable(entity: PublishableEntity): entity is OrderableEntity {
  return entity !== "news";
}

export type EntityListProps = {
  entity: PublishableEntity;
  rows: EntityRow[];
  /** Drag & drop ordering (ignored for news, which are ordered by date). */
  sortable?: boolean;
  layout?: "list" | "grid";
  /** «товар», used in confirmations: «Удалить товар?» */
  nounAccusative: string;
  empty: { title: string; description?: string; action?: ReactNode };
};

/**
 * Generic admin list: optimistic drag & drop ordering, publish toggles and delete with
 * confirmation. Server Actions re-render the page with fresh rows; on failure the
 * optimistic state rolls back automatically.
 */
export function EntityList({ entity, rows, sortable = true, layout = "list", nounAccusative, empty }: EntityListProps): ReactElement {
  const [items, applyOptimistic] = useOptimistic(rows, applyAction);
  const [, startTransition] = useTransition();
  const [confirmDialog, confirm] = useConfirm();
  const sensors = useSortableSensors();
  // Stable id: dnd-kit otherwise numbers its aria-describedby ids with a module counter,
  // which differs between the server render and hydration.
  const dndId = useId();
  const canSort = sortable && isOrderable(entity) && items.length > 1;
  const ids = items.map((row) => row.id);

  const nameOf = (id: string | number): string => items.find((row) => row.id === id)?.title ?? "элемент";
  const positionOf = (id: string | number): number => ids.indexOf(String(id));

  const runAction = (optimistic: OptimisticAction, action: () => Promise<{ ok: boolean; error?: string; message?: string }>, quiet = false): void => {
    startTransition(async () => {
      applyOptimistic(optimistic);
      try {
        const result = await action();
        if (!result.ok) toast.error(result.error ?? "Не удалось выполнить действие");
        else if (!quiet && result.message) toast.success(result.message);
      } catch {
        toast.error(NETWORK_ERROR_MESSAGE);
      }
    });
  };

  const onDragEnd = (event: DragEndEvent): void => {
    if (!isOrderable(entity)) return;
    const next = moveId(ids, event.active.id, event.over?.id);
    if (!next) return;
    runAction({ type: "reorder", ids: next }, () => reorderItems(entity, next), true);
  };

  const onTogglePublished = (row: EntityRow, published: boolean): void => {
    runAction({ type: "publish", id: row.id, published }, () => setPublished(entity, row.id, published));
  };

  const onDelete = async (row: EntityRow): Promise<void> => {
    const confirmed = await confirm({
      title: `Удалить ${nounAccusative}?`,
      description: (
        <>
          «{row.title}» будет удалён без возможности восстановления.
          {row.deleteWarning ? <strong className="mt-2 block text-red-fg">{row.deleteWarning}</strong> : null}
          <span className="mt-2 block">Изображения останутся в медиатеке.</span>
        </>
      ),
      confirmLabel: "Удалить",
    });
    if (!confirmed) return;
    runAction({ type: "remove", id: row.id }, () => deleteItem(entity, row.id));
  };

  if (items.length === 0) {
    return (
      <>
        <EmptyState title={empty.title} description={empty.description} action={empty.action} />
        {confirmDialog}
      </>
    );
  }

  const list = (
    <ul className={clsx(layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" : "flex flex-col gap-2")}>
      {items.map((row, index) => {
        const render = (handle: Handle | null): ReactNode =>
          layout === "grid" ? (
            <GridTile row={row} handle={handle} onToggle={onTogglePublished} onDelete={onDelete} />
          ) : (
            <ListRow row={row} index={index} handle={handle} onToggle={onTogglePublished} onDelete={onDelete} />
          );
        return canSort ? (
          <SortableRow key={row.id} id={row.id}>
            {render}
          </SortableRow>
        ) : (
          <li key={row.id}>{render(null)}</li>
        );
      })}
    </ul>
  );

  return (
    <>
      {canSort ? (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{ announcements: makeAnnouncements(nameOf, positionOf), screenReaderInstructions }}
        >
          <SortableContext items={ids} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      ) : (
        list
      )}
      {confirmDialog}
    </>
  );
}

export type Handle = {
  setActivatorNode: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
};

function SortableRow({ id, children }: { id: string; children: (handle: Handle) => ReactNode }): ReactElement {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx("relative", isDragging && "z-10 opacity-80 shadow-2xl")}
    >
      {children({ setActivatorNode: setActivatorNodeRef, attributes, listeners })}
    </li>
  );
}

function DragHandle({
  setActivatorNode,
  attributes,
  listeners,
  label,
}: Handle & { label: string }): ReactElement {
  return (
    <button
      type="button"
      ref={setActivatorNode}
      {...attributes}
      {...listeners}
      aria-label={`Перетащить «${label}»`}
      className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-raised-hi hover:text-fg active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

function MissingBadges({ row }: { row: EntityRow }): ReactElement | null {
  if (row.missingLocales.length === 0) return null;
  return (
    <>
      {row.missingLocales.map((locale) => (
        <Badge key={locale} tone="outline" title={`Нет перевода: ${localeNames[locale].ru}`}>
          нет {localeNames[locale].short}
        </Badge>
      ))}
    </>
  );
}

type RowProps = {
  row: EntityRow;
  handle: Handle | null;
  onToggle: (row: EntityRow, published: boolean) => void;
  onDelete: (row: EntityRow) => Promise<void>;
};

function RowActions({ row, onDelete }: Pick<RowProps, "row" | "onDelete">): ReactElement {
  return (
    <div className="flex items-center gap-1">
      <Link
        href={row.href}
        className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-raised-hi hover:text-fg"
        aria-label={`Редактировать «${row.title}»`}
        title="Редактировать"
      >
        <Pencil className="size-4" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={() => void onDelete(row)}
        className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-red/20 hover:text-red-fg"
        aria-label={`Удалить «${row.title}»`}
        title="Удалить"
      >
        <Trash className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function ListRow({ row, index, handle, onToggle, onDelete }: RowProps & { index: number }): ReactElement {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-lg border border-line bg-panel px-2 py-2 transition-colors hover:border-line-strong sm:px-3",
        !row.published && "bg-panel/60",
      )}
    >
      {handle ? <DragHandle {...handle} label={row.title} /> : <span className="w-6 shrink-0 text-center text-xs text-muted">{index + 1}</span>}
      <MediaThumb media={row.thumb} className="size-12 shrink-0" sizes="48px" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={row.href} className={clsx("truncate text-sm font-semibold hover:text-beige", row.published ? "text-fg" : "text-fg/60")}>
            {row.title}
          </Link>
          {!row.published ? <Badge>скрыто</Badge> : null}
          <MissingBadges row={row} />
        </div>
        {row.subtitle || row.meta ? (
          <p className="mt-0.5 truncate text-xs text-muted">{[row.subtitle, row.meta].filter(Boolean).join(" · ")}</p>
        ) : null}
      </div>
      <Switch
        size="sm"
        checked={row.published}
        onCheckedChange={(published) => onToggle(row, published)}
        ariaLabel={`Показывать на сайте: «${row.title}»`}
      />
      <RowActions row={row} onDelete={onDelete} />
    </div>
  );
}

function GridTile({ row, handle, onToggle, onDelete }: RowProps): ReactElement {
  return (
    <div className={clsx("flex flex-col overflow-hidden rounded-lg border border-line bg-panel", !row.published && "opacity-70")}>
      <Link href={row.href} className="block" aria-label={`Редактировать «${row.title}»`}>
        <MediaThumb media={row.thumb} className="aspect-square w-full rounded-none border-0" sizes="(min-width: 1280px) 220px, 45vw" />
      </Link>
      <div className="flex flex-col gap-2 p-2">
        <p className="truncate text-xs text-fg" title={row.title}>
          {row.title}
        </p>
        <div className="flex items-center justify-between gap-1">
          {handle ? <DragHandle {...handle} label={row.title} /> : <span />}
          <Switch
            size="sm"
            checked={row.published}
            onCheckedChange={(published) => onToggle(row, published)}
            ariaLabel={`Показывать на сайте: «${row.title}»`}
          />
          <RowActions row={row} onDelete={onDelete} />
        </div>
        <MissingBadges row={row} />
      </div>
    </div>
  );
}
