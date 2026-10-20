"use client";

import { type ReactElement, useRef } from "react";
import { panelWipes, retire, unseen } from "../motion/effects";
import { gsap, splitText } from "../motion/gsap";
import { useScene } from "../motion/useScene";
import { SceneRoot, type SceneProps } from "./SceneRoot";

/** «Новости» (the newspaper page): the sheet unrolls, the headline is set letter by letter, columns rise. */
export function NewsScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root, ctx) => {
    panelWipes(root, ctx);
    const cols = root.querySelector(".gazette__cols");
    // A late scene (useScene): what the visitor may already have seen stays as rendered.
    unseen(Array.from(root.querySelectorAll<HTMLElement>(".story"))).forEach((story, i) => {
      gsap.from(story, {
        y: 50,
        opacity: 0,
        duration: 1,
        delay: Math.min(i, 4) * 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: cols ?? story, start: "top 85%", onEnter: retire },
      });
    });
    const title = root.querySelector<HTMLElement>(".gazette__title");
    if (title && unseen([title]).length > 0) {
      // autoSplit: the masked lines are re-measured (and the reveal rebuilt at its progress)
      // after a resize, a rotation or a late font swap, until the reveal has finished.
      splitText().create(title, {
        type: "lines,chars",
        mask: "lines",
        autoSplit: true,
        onSplit: (split) => {
          // Start state set once, then to(): no computed-style read per char.
          gsap.set(split.chars, { yPercent: 110 });
          return gsap.to(split.chars, {
            yPercent: 0,
            duration: 0.9,
            stagger: 0.02,
            ease: "power4.out",
            onComplete: () => {
              split.revert();
            },
            scrollTrigger: { trigger: title, start: "top 85%", onEnter: retire },
          });
        },
      });
    }
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}
