import { brandAssetUrl } from '@/lib/media-url';

import type { CSSProperties } from 'react';

/**
 * The brand files noir.css draws as CSS masks / backgrounds, as custom properties on <html>
 * ([locale] layout) holding their content-hashed URLs (brandAssetUrl → `?v=…`): CSS cannot read
 * the build's hashes itself; noir.css uses them as `var(--brand-…)`. The hero snake's <use>
 * asks for the same URL as the --brand-logo mask, so one download serves both.
 */
export type BrandAssetStyle = CSSProperties &
  Record<
    | '--brand-wordmark'
    | '--brand-logo'
    | '--brand-head-front'
    | '--brand-closeup-ink'
    | '--brand-closeup-red'
    | '--brand-tongue'
    | '--brand-hood',
    string
  >;

const cssUrl = (file: string): string => `url(${brandAssetUrl(file)})`;

/** The style attribute for <html>. */
export function brandAssetStyle(): BrandAssetStyle {
  return {
    '--brand-wordmark': cssUrl('wordmark-ink.svg'),
    '--brand-logo': cssUrl('logo-red-tongue-ink.svg'),
    '--brand-head-front': cssUrl('head-front-ink.svg'),
    '--brand-closeup-ink': cssUrl('head-closeup-ink.svg'),
    '--brand-closeup-red': cssUrl('head-closeup-red.svg'),
    '--brand-tongue': cssUrl('tongue-red.svg'),
    '--brand-hood': cssUrl('hood.svg'),
  };
}
