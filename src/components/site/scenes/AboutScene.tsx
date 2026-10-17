"use client";

import { type ReactElement, useRef } from "react";
import { chapterReveal, panelWipes, playWhileVisible, sfxPop, tongueLoop } from "../motion/effects";
import { gsap } from "../motion/gsap";
import { useScene } from "../motion/useScene";
import { SceneRoot, type SceneProps } from "./SceneRoot";

/** «О нас»: chapter header, ink-wipe panels, «ТССС!», and the close-up snake flicking its tongue. */
export function AboutScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root, ctx) => {
    chapterReveal(root);
    panelWipes(root, ctx);
    sfxPop(root);
    const tongue = root.querySelector(".closeup__tongue");
    const closeup = root.querySelector(".closeup");
    if (tongue && closeup) {
      gsap.set(tongue, { transformOrigin: "52.6% 57%" });
      playWhileVisible(closeup, tongueLoop(tongue));
    }
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}
