import { describe, expect, it } from 'vitest';

import { activeMapFor, isExternalHref, menuAnchor, menuHref, menuLink } from './nav';

const item = { id: 'm1', label: 'О нас', href: '#about', showInHeader: true, showInFooter: true };

describe('site menu links', () => {
  it('keeps landing anchors on the landing and points to them from other pages', () => {
    expect(menuAnchor('#catalog')).toBe('catalog');
    expect(menuAnchor('/catalog/menya-zapomnyat')).toBeNull();
    expect(menuHref({ href: '#about' }, '', 'ru')).toBe('#about');
    expect(menuHref({ href: '#about' }, '/en', 'en')).toBe('/en#about');
  });

  it('localizes site paths (query and hash kept, a typed language prefix replaced)', () => {
    expect(menuHref({ href: '/catalog/menya-zapomnyat' }, '', 'en')).toBe('/en/catalog/menya-zapomnyat');
    expect(menuHref({ href: '/catalog/menya-zapomnyat' }, '', 'ru')).toBe('/catalog/menya-zapomnyat');
    expect(menuHref({ href: '/en/catalog/x#product-y' }, '', 'ru')).toBe('/catalog/x#product-y');
    expect(menuHref({ href: '/#gallery' }, '', 'en')).toBe('/en#gallery');
  });

  it('leaves external links, mailto: and tel: alone', () => {
    expect(menuHref({ href: 'https://t.me/gadyuka' }, '/en', 'en')).toBe('https://t.me/gadyuka');
    expect(menuHref({ href: 'mailto:hello@example.com' }, '', 'ru')).toBe('mailto:hello@example.com');
    expect(menuHref({ href: 'tel:+79000000000' }, '', 'en')).toBe('tel:+79000000000');
  });

  it('opens only http(s) links to other sites in a new tab', () => {
    expect(isExternalHref('https://t.me/gadyuka')).toBe(true);
    expect(isExternalHref('HTTP://example.com')).toBe(true);
    expect(isExternalHref('mailto:hello@example.com')).toBe(false);
    expect(isExternalHref('/catalog/x')).toBe(false);
    expect(isExternalHref('#about')).toBe(false);
  });

  it('turns a menu item into a link of the current page', () => {
    expect(menuLink(item, '/en', 'en')).toEqual({
      id: 'm1',
      label: 'О нас',
      href: '/en#about',
      anchor: 'about',
      external: false,
    });
    expect(menuLink({ ...item, href: 'https://vk.com/gadyuka' }, '', 'ru')).toMatchObject({
      href: 'https://vk.com/gadyuka',
      anchor: null,
      external: true,
    });
  });

  it('highlights every menu section while it is on screen (scroll-spy), nothing elsewhere', () => {
    const map = activeMapFor([{ href: '#home' }, { href: '#catalog' }, { href: 'https://t.me/x' }]);
    expect(map).toEqual({ home: 'home', catalog: 'catalog' });
    expect(map.reviews ?? null).toBeNull();
  });
});
