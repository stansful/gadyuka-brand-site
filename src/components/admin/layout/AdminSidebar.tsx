'use client';

import { clsx } from 'clsx';
import {
  BadgePercent,
  ExternalLink,
  FileText,
  Handshake,
  Images,
  Inbox,
  LayoutDashboard,
  Layers,
  Library,
  ListTree,
  LogOut,
  Menu,
  MessageSquareQuote,
  Newspaper,
  Settings,
  Share2,
  Shirt,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations, type Messages } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { logoutAction } from '@/lib/admin/actions/auth';

/** Sidebar entries; the label is admin.nav.items.<key>. */
type NavItem = { href: string; key: keyof Messages['admin']['nav']['items']; icon: LucideIcon };

export const ADMIN_NAV: readonly NavItem[] = [
  { href: '/admin', key: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/content', key: 'content', icon: FileText },
  { href: '/admin/menu', key: 'menu', icon: ListTree },
  { href: '/admin/collections', key: 'collections', icon: Layers },
  { href: '/admin/products', key: 'products', icon: Shirt },
  { href: '/admin/reviews', key: 'reviews', icon: MessageSquareQuote },
  { href: '/admin/news', key: 'news', icon: Newspaper },
  { href: '/admin/gallery', key: 'gallery', icon: Images },
  { href: '/admin/offers', key: 'offers', icon: BadgePercent },
  { href: '/admin/partners', key: 'partners', icon: Handshake },
  { href: '/admin/socials', key: 'socials', icon: Share2 },
  { href: '/admin/media', key: 'media', icon: Library },
  { href: '/admin/leads', key: 'leads', icon: Inbox },
  { href: '/admin/settings', key: 'settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Wordmark(): ReactElement {
  const t = useTranslations('admin.nav');
  return (
    <span className="flex flex-col gap-1">
      <span
        aria-hidden
        className="block h-4 w-[132px] bg-beige"
        style={{
          maskImage: 'url(/brand/wordmark-ink.svg)',
          WebkitMaskImage: 'url(/brand/wordmark-ink.svg)',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'left center',
          WebkitMaskPosition: 'left center',
        }}
      />
      <span className="sr-only">{t('brand')}</span>
      <span className="text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">{t('subtitle')}</span>
    </span>
  );
}

function NavList({
  pathname,
  newLeads,
  onNavigate,
}: {
  pathname: string;
  newLeads: number;
  onNavigate?: () => void;
}): ReactElement {
  const t = useTranslations('admin.nav');
  return (
    <ul className="flex flex-col gap-0.5">
      {ADMIN_NAV.map(item => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors',
                active ? 'bg-blue font-semibold text-fg' : 'text-fg/70 hover:bg-raised-hi hover:text-fg',
              )}
            >
              <Icon className={clsx('size-4 shrink-0', active ? 'text-beige' : 'text-muted')} aria-hidden />
              <span className="flex-1 truncate">{t(`items.${item.key}`)}</span>
              {item.href === '/admin/leads' && newLeads > 0 ? (
                <span
                  className="rounded-full bg-beige px-1.5 text-[11px] font-semibold text-ink"
                  aria-label={t('newLeads', { count: newLeads })}
                >
                  {newLeads > 99 ? '99+' : newLeads}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function FooterLinks({ canLogout }: { canLogout: boolean }): ReactElement {
  const t = useTranslations('admin.nav');
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-fg/70 hover:bg-raised-hi hover:text-fg"
      >
        <ExternalLink className="size-4 text-muted" aria-hidden />
        {t('openSite')}
      </a>
      {canLogout ? (
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-fg/70 hover:bg-raised-hi hover:text-fg"
          >
            <LogOut className="size-4 text-muted" aria-hidden />
            {t('logout')}
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Sidebar navigation: fixed column on desktop, top bar + drawer below 1024 px. */
export function AdminSidebar({ newLeads, canLogout }: { newLeads: number; canLogout: boolean }): ReactElement {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-r border-line bg-panel px-3 py-5 lg:flex">
        <Link href="/admin" className="px-3" aria-label={t('home')}>
          <Wordmark />
        </Link>
        <nav aria-label={t('sections')} className="min-h-0 flex-1 overflow-y-auto">
          <NavList pathname={pathname} newLeads={newLeads} />
        </nav>
        <FooterLinks canLogout={canLogout} />
      </aside>

      {/* Tablet / mobile */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-panel/95 px-4 backdrop-blur lg:hidden">
        <Link href="/admin" aria-label={t('home')}>
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-mobile-nav"
          className="flex size-10 items-center justify-center rounded-md text-fg hover:bg-raised-hi"
        >
          <Menu className="size-5" aria-hidden />
          <span className="sr-only">{t('openMenu')}</span>
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('closeMenu')}
            className="absolute inset-0 bg-ink/70"
            onClick={() => setOpen(false)}
          />
          <div
            id="admin-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={t('mobileMenu')}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 border-r border-line bg-panel px-3 py-4"
            onKeyDown={event => {
              if (event.key === 'Escape') setOpen(false);
            }}
          >
            <div className="flex items-center justify-between px-3">
              <Wordmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-md hover:bg-raised-hi"
                autoFocus
              >
                <X className="size-5" aria-hidden />
                <span className="sr-only">{t('closeMenu')}</span>
              </button>
            </div>
            <nav aria-label={t('sections')} className="min-h-0 flex-1 overflow-y-auto">
              <NavList pathname={pathname} newLeads={newLeads} onNavigate={() => setOpen(false)} />
            </nav>
            <FooterLinks canLogout={canLogout} />
          </div>
        </div>
      ) : null}
    </>
  );
}
