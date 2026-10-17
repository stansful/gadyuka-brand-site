"use client";

import type { ReactElement, ReactNode, RefObject } from "react";

/** Elements a scene can render as (all HTMLElement, so one ref type fits). */
export type SceneTag = "section" | "article" | "footer";

/** Serializable props of a scene wrapper (passed from server components). */
export type SceneProps = {
  as?: SceneTag;
  id?: string;
  className?: string;
  labelledBy?: string;
  /** Page number of the chapter (data-folio). */
  folio?: string;
  children: ReactNode;
};

/**
 * The DOM root a scene animates: renders the section (or article / footer) with the ref.
 * data-scene-pending: CSS draws the scene's start states until the scene is set up (it may be
 * set up only when it approaches the viewport — motion/scheduler.ts).
 */
export function SceneRoot({
  sceneRef,
  as: Tag = "section",
  id,
  className,
  labelledBy,
  folio,
  children,
}: SceneProps & { sceneRef: RefObject<HTMLElement | null> }): ReactElement {
  return (
    <Tag ref={sceneRef} id={id} className={className} aria-labelledby={labelledBy} data-folio={folio} data-scene-pending="">
      {children}
    </Tag>
  );
}
