"use client";

import { type ReactElement, useRef } from "react";
import { retire } from "../motion/effects";
import { gsap } from "../motion/gsap";
import { useScene } from "../motion/useScene";
import { SceneRoot, type SceneProps } from "./SceneRoot";

/** Footer: «Продолжение следует…» fades in and the big wordmark is pressed in from the left. */
export function FooterScene(props: Omit<SceneProps, "as">): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root) => {
    const word = root.querySelector(".ftr__word");
    const tbc = root.querySelector(".ftr__tbc");
    // fromTo (not from): until the setup the start state comes from CSS (noir.css, scene start
    // states), and from() would take that hidden state as its end value.
    if (word) {
      gsap.fromTo(
        word,
        { clipPath: "inset(0% 100% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power3.inOut", clearProps: "clipPath", scrollTrigger: { trigger: word, start: "top 90%", onEnter: retire } },
      );
    }
    if (tbc) gsap.fromTo(tbc, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.9, ease: "power1.out", scrollTrigger: { trigger: tbc, start: "top 92%", onEnter: retire } });
  });
  return <SceneRoot sceneRef={ref} as="footer" {...props} />;
}
