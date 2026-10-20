'use client';

import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';

import type { HeaderLabels, LanguageSwitcherProps } from '../labels';

import { pad2 } from '../format';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { motionEnabled } from '../motion/env';
import { NAVIGATE_EVENT } from '../motion/events';
import { gsap } from '../motion/gsap';
import { lockScroll } from '../motion/lenis-store';

/** A menu link (MenuItem row, see ../nav.ts menuLink). */
export type NavItem = {
  /** MenuItem.id (React key, data-entity-id). */
  id: string;
  /** Section anchor ("catalog") — the key of the active-section highlight; null for other links. */
  anchor: string | null;
  /** Full href ("#catalog" on the landing, "/#catalog" elsewhere, a localized path or a URL). */
  href: string;
  label: string;
  /** External http(s) link: opens in a new tab, with the hidden labels.opensInNewTab hint. */
  external: boolean;
};

/** target / rel of a menu link (external links open in a new tab). */
function newTabProps(item: NavItem): { target?: '_blank'; rel?: string } {
  return item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

type HeaderClientProps = {
  nav: ReadonlyArray<NavItem>;
  homeHref: string;
  /** Href of the lead form («Оставить заявку» in the mobile menu). */
  formHref: string;
  menuCaption: string;
  cta: string;
  /** Section id → highlighted menu anchor while that section is in the middle of the viewport. */
  activeMap: Readonly<Record<string, string | null>>;
  /** Accessible names (messages/*.json, resolved on the server). */
  labels: HeaderLabels;
  languages: LanguageSwitcherProps;
};

const DESKTOP_MIN = 1024;

/** Items of the mobile menu that rise in after the wipe. */
const MENU_ITEMS = '.mnav__list li, .mnav__cta, .mnav__cap';

/** Stops the menu's wipe and item tweens (a reopen during the closing wipe must win over it). */
function stopMenuTweens(menu: HTMLElement): void {
  gsap.killTweensOf(menu);
  gsap.killTweensOf(menu.querySelectorAll(MENU_ITEMS));
}

/**
 * Site header (fixed): logo, main menu, language switcher, burger + full-screen mobile menu.
 * Ported from the concept: solid background after 40 px of scroll, active menu item follows
 * the section in the middle of the viewport, the mobile menu opens with a circular ink wipe,
 * makes the page behind it inert, closes on Esc (focus returns to the burger), on a link and
 * when the viewport grows to desktop width.
 */
export function HeaderClient({
  nav,
  homeHref,
  formHref,
  menuCaption,
  cta,
  activeMap,
  labels,
  languages,
}: HeaderClientProps): ReactElement {
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  // Solid header after the first 40 px (never depends on a rendered frame).
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = (): void => {
      header.classList.toggle('is-solid', window.scrollY > 40);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Active menu item: the section crossing the middle of the viewport. Blocks between sections
  // (the red band) name the section they belong to in data-nav-section.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('main > section[id], main > [data-nav-section]'),
    );
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
          const id = entry.target.dataset.navSection ?? entry.target.id;
          setActive(activeMap[id] ?? null);
        }
      },
      { rootMargin: '-45% 0px -54% 0px' },
    );
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [activeMap]);

  const setInert = (on: boolean): void => {
    document.querySelectorAll<HTMLElement>('main, .ftr').forEach(el => {
      el.inert = on;
    });
  };

  const closeMenu = useCallback((instant: boolean): void => {
    const menu = menuRef.current;
    if (!menu || !openRef.current) return;
    openRef.current = false;
    setOpen(false);
    lockScroll(false);
    setInert(false);
    const hide = (): void => {
      if (openRef.current) return; // reopened meanwhile
      menu.hidden = true;
    };
    stopMenuTweens(menu);
    if (motionEnabled() && !instant) {
      gsap.to(menu, { clipPath: 'circle(0% at 100% 0%)', duration: 0.5, ease: 'power3.inOut', onComplete: hide });
    } else {
      hide();
    }
  }, []);

  const openMenu = (): void => {
    const menu = menuRef.current;
    if (!menu || openRef.current) return;
    stopMenuTweens(menu);
    openRef.current = true;
    setOpen(true);
    menu.hidden = false;
    lockScroll(true);
    setInert(true);
    if (motionEnabled()) {
      gsap.fromTo(
        menu,
        { clipPath: 'circle(0% at 100% 0%)' },
        { clipPath: 'circle(150% at 100% 0%)', duration: 0.7, ease: 'power3.inOut' },
      );
      gsap.fromTo(
        menu.querySelectorAll(MENU_ITEMS),
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, delay: 0.2, ease: 'power3.out' },
      );
    }
    menu.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && openRef.current) {
        closeMenu(false);
        burgerRef.current?.focus();
      }
    };
    const onResize = (): void => {
      if (openRef.current && window.innerWidth >= DESKTOP_MIN) closeMenu(true);
    };
    const onNavigate = (): void => closeMenu(true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
      if (openRef.current) {
        lockScroll(false);
        setInert(false);
      }
    };
  }, [closeMenu]);

  return (
    <>
      <header className="hdr" data-hdr ref={headerRef}>
        <div className="hdr__in">
          <a className="hdr__logo" href={homeHref} aria-label={labels.homeLink}>
            <span className="hdr__mark mask-img m-logo" aria-hidden="true" />
            <span className="hdr__word mask-img m-wordmark" aria-hidden="true" />
          </a>
          <nav className="nav" aria-label={labels.mainNavigation}>
            <ul className="nav__list">
              {nav.map(item => (
                <li key={item.id}>
                  <a
                    className="nav__link"
                    href={item.href}
                    {...newTabProps(item)}
                    data-nav={item.anchor ?? undefined}
                    data-entity="MenuItem"
                    data-entity-id={item.id}
                    aria-current={item.anchor !== null && active === item.anchor ? 'true' : undefined}
                  >
                    {item.label}
                    {item.external ? <span className="sr-only"> {labels.opensInNewTab}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hdr__tools">
            <LanguageSwitcher {...languages} />
            <button
              ref={burgerRef}
              className="burger"
              type="button"
              aria-expanded={open}
              aria-controls="mnav"
              aria-label={open ? labels.closeMenu : labels.openMenu}
              onClick={() => (openRef.current ? closeMenu(false) : openMenu())}
            >
              <span className="burger__line" />
              <span className="burger__line" />
            </button>
          </div>
        </div>
      </header>

      <div className="mnav" id="mnav" ref={menuRef} hidden data-lenis-prevent="">
        <nav className="mnav__in" aria-label={labels.mobileMenu}>
          <p className="mnav__cap caption caption--paper" data-edit="header.menuCaption">
            {menuCaption}
          </p>
          <ol className="mnav__list">
            {nav.map((item, index) => (
              <li key={item.id}>
                <a href={item.href} {...newTabProps(item)} onClick={() => closeMenu(true)}>
                  <span className="mnav__no" aria-hidden="true">
                    {pad2(index + 1)}
                  </span>
                  <span data-entity="MenuItem" data-entity-id={item.id}>
                    {item.label}
                  </span>
                  {item.external ? <span className="sr-only"> {labels.opensInNewTab}</span> : null}
                </a>
              </li>
            ))}
          </ol>
          <a
            className="btn btn--red mnav__cta"
            href={formHref}
            data-lead-type="CONTACT"
            onClick={() => closeMenu(true)}
          >
            <span className="btn__face" data-edit="header.cta">
              {cta}
            </span>
          </a>
        </nav>
      </div>
    </>
  );
}
