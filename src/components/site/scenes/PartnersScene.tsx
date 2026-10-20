"use client";

import { type ReactElement, useRef } from "react";
import { chapterReveal, panelWipes, retire, unseen } from "../motion/effects";
import { gsap } from "../motion/gsap";
import { useScene } from "../motion/useScene";
import { SceneRoot, type SceneProps } from "./SceneRoot";

/** «Партнёры»: chapter header, ink-wipe slots and the «Гадюка × ваш бренд» crossover title punching in. */
export function PartnersScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root, ctx) => {
    chapterReveal(root);
    panelWipes(root, ctx);
    const title = root.querySelector(".crossover__title");
    const crossover = root.querySelector(".crossover");
    if (title && crossover && unseen([crossover]).length > 0) {
      gsap.from(title, { scale: 0.7, opacity: 0, duration: 1, ease: "back.out(1.6)", scrollTrigger: { trigger: crossover, start: "top 80%", onEnter: retire } });
    }
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}
