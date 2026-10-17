"use client";

import { type ReactElement, useRef } from "react";
import { chapterReveal, genericReveals, panelWipes, sfxPop } from "../motion/effects";
import { useScene } from "../motion/useScene";
import { SceneRoot, type SceneProps } from "./SceneRoot";

/**
 * The common chapter choreography: the chapter header (sheet, inked title, typed narration),
 * ink-wipe panels, lead reveals and comic SFX. Used by «Индивидуальный пошив», «Контакты»
 * and the error pages; richer chapters have their own scene.
 */
export function ChapterScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root, ctx) => {
    chapterReveal(root);
    panelWipes(root, ctx);
    genericReveals(root);
    sfxPop(root);
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}
