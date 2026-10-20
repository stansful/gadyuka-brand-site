'use client';

import { type ReactElement, useRef } from 'react';

import { WordmarkUse } from '../brand/BrandDefs';
import { gsap, scrollTrigger } from '../motion/gsap';
import { useScene } from '../motion/useScene';

/** Copies of the wordmark on the track: the loop moves it by half (xPercent −50), seamlessly. */
const COPIES = 8;

/**
 * The red «ГАДЮКА» band (from concepts/03-editorial-ink, slide 6 of the brandbook), between
 * «О нас» and «Индивидуальный пошив»: a red strip at −3°, the wordmark running forever.
 * Scroll velocity boosts the speed, scroll direction reverses it, and the strip itself drifts
 * a little (scrubbed xPercent 2 → −2). Decorative (aria-hidden). With reduced motion — static.
 */
export function RedBand({ navSection }: { navSection?: string }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useScene(ref, band => {
    const track = band.querySelector<HTMLElement>('.band__track');
    const rot = band.querySelector<HTMLElement>('.band__rot');
    if (!track || !rot) return;

    const loop = gsap.to(track, { xPercent: -50, ease: 'none', duration: 42, repeat: -1 });
    loop.totalTime(loop.duration() * 200); // headroom, so the band can also run backwards
    let direction = 1;
    const trigger = scrollTrigger().create({
      trigger: band,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: self => {
        direction = self.direction;
        const boost = gsap.utils.clamp(1, 9, 1 + Math.abs(self.getVelocity()) / 220);
        gsap.to(loop, { timeScale: direction * boost, duration: 0.2, overwrite: true });
        gsap.to(loop, { timeScale: direction, duration: 1.4, delay: 0.25 });
      },
      // Off screen the loop rests (nothing visible changes).
      onToggle: self => {
        if (self.isActive) loop.resume();
        else loop.pause();
      },
    });
    if (!trigger.isActive) loop.pause();
    gsap.fromTo(
      rot,
      { xPercent: 2 },
      {
        xPercent: -2,
        ease: 'none',
        scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );

    return () => {
      gsap.killTweensOf(loop);
    };
  });

  return (
    <div className="band" aria-hidden="true" ref={ref} data-nav-section={navSection}>
      <div className="band__rot">
        <div className="band__track">
          {Array.from({ length: COPIES }, (_, index) => (
            <WordmarkUse key={index} className="band__wm" />
          ))}
        </div>
      </div>
    </div>
  );
}
