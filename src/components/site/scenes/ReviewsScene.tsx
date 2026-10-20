"use client";

import { type ReactElement, useRef } from "react";
import { chapterReveal, genericReveals, retire, unseen } from "../motion/effects";
import { gsap } from "../motion/gsap";
import { useScene } from "../motion/useScene";
import { SceneRoot, type SceneProps } from "./SceneRoot";

/**
 * «Отзывы»: each witness panel is inked in, the hooded figure steps out of the dark, then the
 * speech bubble pops from its tail and the name plate drops in.
 */
export function ReviewsScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root) => {
    chapterReveal(root);
    genericReveals(root);
    // A late scene (useScene): what the visitor may already have seen stays as rendered.
    unseen(Array.from(root.querySelectorAll<HTMLElement>(".say"))).forEach((say) => {
      const left = say.classList.contains("say--b") || say.classList.contains("say--c");
      const tl = gsap.timeline({ scrollTrigger: { trigger: say, start: "top 85%", onEnter: retire } });
      tl.fromTo(
        say,
        { clipPath: left ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)" },
        { clipPath: "inset(-12% -6% -6% -6%)", duration: 0.95, ease: "power3.inOut", clearProps: "clipPath" },
      );
      const fig = say.querySelector(".say__fig");
      const bubble = say.querySelector(".say__bubble");
      const who = say.querySelector(".say__who");
      if (fig) tl.from(fig, { yPercent: 18, opacity: 0, duration: 1.1, ease: "power3.out" }, 0.3);
      if (bubble) {
        tl.from(
          bubble,
          {
            scale: 0.2,
            rotation: left ? 8 : -8,
            opacity: 0,
            transformOrigin: left ? "24% 120%" : "76% 120%",
            duration: 0.75,
            ease: "back.out(1.9)",
          },
          0.55,
        );
      }
      if (who) tl.from(who, { opacity: 0, y: 14, duration: 0.55 }, 0.85);
    });
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}
