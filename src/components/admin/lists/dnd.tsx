"use client";

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
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/** Shared drag & drop setup: pointer + keyboard sensors and Russian screen-reader texts. */

export function useSortableSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function makeAnnouncements(nameOf: (id: UniqueIdentifier) => string, positionOf: (id: UniqueIdentifier) => number): Announcements {
  return {
    onDragStart: ({ active }) => `Взят элемент «${nameOf(active.id)}».`,
    onDragOver: ({ active, over }) =>
      over ? `«${nameOf(active.id)}» над позицией ${positionOf(over.id) + 1}.` : `«${nameOf(active.id)}» вне списка.`,
    onDragEnd: ({ active, over }) =>
      over ? `«${nameOf(active.id)}» перемещён на позицию ${positionOf(over.id) + 1}.` : `«${nameOf(active.id)}» отпущен.`,
    onDragCancel: ({ active }) => `Перемещение «${nameOf(active.id)}» отменено.`,
  };
}

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Чтобы переместить элемент, нажмите пробел или Enter, перемещайте стрелками, затем снова нажмите пробел или Enter. Escape — отмена.",
};

/** Moves `ids` so that `activeId` takes the place of `overId`. Returns null when nothing changes. */
export function moveId(ids: readonly string[], activeId: UniqueIdentifier, overId: UniqueIdentifier | null | undefined): string[] | null {
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
