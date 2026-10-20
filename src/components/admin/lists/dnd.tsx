'use client';

import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type ScreenReaderInstructions,
  type SensorDescriptor,
  type SensorOptions,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';

/** Shared drag & drop setup: pointer + keyboard sensors and screen-reader texts (admin.list.dnd). */

export function useSortableSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/**
 * dnd-kit `accessibility` of a sortable list: what screen readers hear while an item is
 * dragged (««Худи» перемещён на позицию 3.») and how to drag with the keyboard.
 */
export function useDndAccessibility(
  nameOf: (id: UniqueIdentifier) => string,
  positionOf: (id: UniqueIdentifier) => number,
): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions } {
  const t = useTranslations('admin.list.dnd');
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dragStart', { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('dragOver', { name: nameOf(active.id), position: positionOf(over.id) + 1 })
        : t('dragOutside', { name: nameOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t('dropped', { name: nameOf(active.id), position: positionOf(over.id) + 1 })
        : t('released', { name: nameOf(active.id) }),
    onDragCancel: ({ active }) => t('cancelled', { name: nameOf(active.id) }),
  };
  return { announcements, screenReaderInstructions: { draggable: t('instructions') } };
}

/** Moves `ids` so that `activeId` takes the place of `overId`. Returns null when nothing changes. */
export function moveId(
  ids: readonly string[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null | undefined,
): string[] | null {
  if (overId === null || overId === undefined || activeId === overId) return null;
  const from = ids.indexOf(String(activeId));
  const to = ids.indexOf(String(overId));
  if (from < 0 || to < 0) return null;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return null;
  next.splice(to, 0, moved);
  return next;
}
