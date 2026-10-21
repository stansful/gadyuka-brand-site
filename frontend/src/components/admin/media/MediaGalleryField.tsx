'use client';

import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { GripVertical, ImagePlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type ReactElement, type ReactNode } from 'react';

import type { AdminMediaRef } from './media-types';

import { moveId, useDndAccessibility, useSortableSensors } from '../lists/dnd';
import { Button } from '../ui/Button';
import { MediaLibraryDialog } from './MediaLibraryDialog';
import { MediaThumb } from './MediaThumb';

/**
 * Ordered multi-image field (product photos): drag & drop to reorder, add from the
 * media library (with upload), remove. The first image is the main one.
 */
export function MediaGalleryField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  max = 30,
}: {
  id: string;
  label: ReactNode;
  value: AdminMediaRef[];
  onChange: (next: AdminMediaRef[]) => void;
  hint?: ReactNode;
  error?: string;
  max?: number;
}): ReactElement {
  const t = useTranslations('admin.media.gallery');
  const [open, setOpen] = useState(false);
  const sensors = useSortableSensors();
  // Stable id (SSR-safe aria-describedby; dnd-kit falls back to a module counter).
  const dndId = useId();
  const ids = value.map(media => media.id);

  const onDragEnd = (event: DragEndEvent): void => {
    const next = moveId(ids, event.active.id, event.over?.id);
    if (!next) return;
    const byId = new Map(value.map(media => [media.id, media]));
    onChange(next.map(mediaId => byId.get(mediaId)).filter((media): media is AdminMediaRef => media !== undefined));
  };

  const positionOf = (mediaId: string | number): number => ids.indexOf(String(mediaId));
  const nameOf = (mediaId: string | number): string => t('photo', { number: positionOf(mediaId) + 1 });
  const accessibility = useDndAccessibility(nameOf, positionOf);

  return (
    <div className="flex flex-col gap-2" role="group" aria-labelledby={`${id}-label`}>
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium text-fg/90">
          {label}
        </span>
        <span className="text-xs text-muted">
          {value.length} / {max}
        </span>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={accessibility}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <ul className={clsx('grid grid-cols-3 gap-2 sm:grid-cols-4', error && 'rounded-lg ring-2 ring-red-fg/60')}>
            {value.map((media, index) => (
              <SortableImage
                key={media.id}
                media={media}
                index={index}
                onRemove={() => onChange(value.filter(item => item.id !== media.id))}
              />
            ))}
            {value.length < max ? (
              <li>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line-strong text-xs text-muted transition-colors hover:border-beige/60 hover:text-fg"
                >
                  <ImagePlus className="size-5" aria-hidden />
                  {t('add')}
                </button>
              </li>
            ) : null}
          </ul>
        </SortableContext>
      </DndContext>

      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-red-fg" role="alert">
          {error}
        </p>
      ) : null}
      {value.length === 0 ? (
        <div>
          <Button
            size="sm"
            variant="outline"
            icon={<ImagePlus className="size-4" aria-hidden />}
            onClick={() => setOpen(true)}
          >
            {t('choose')}
          </Button>
        </div>
      ) : null}

      <MediaLibraryDialog
        open={open}
        multiple
        excludeIds={ids}
        onClose={() => setOpen(false)}
        onSelect={selected => {
          const existing = new Set(ids);
          const added = selected
            .filter(media => !existing.has(media.id))
            .map(media => ({ id: media.id, url: media.url, width: media.width, height: media.height, alt: media.alt }));
          onChange([...value, ...added].slice(0, max));
        }}
      />
    </div>
  );
}

function SortableImage({
  media,
  index,
  onRemove,
}: {
  media: AdminMediaRef;
  index: number;
  onRemove: () => void;
}): ReactElement {
  const t = useTranslations('admin.media.gallery');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: media.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx('group relative', isDragging && 'z-10 opacity-80')}
    >
      <MediaThumb media={media} className="aspect-square w-full" sizes="160px" />
      {index === 0 ? (
        <span className="absolute bottom-1 left-1 rounded bg-beige px-1.5 py-0.5 text-[10px] font-semibold text-ink">
          {t('main')}
        </span>
      ) : null}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('drag', { number: index + 1 })}
        className="absolute top-1 left-1 flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-ink/75 text-fg active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('remove', { number: index + 1 })}
        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-md bg-ink/75 text-fg hover:bg-red hover:text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}
