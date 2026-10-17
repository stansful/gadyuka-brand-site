"use client";

import { type ReactElement, useSyncExternalStore } from "react";

const noopSubscribe = (): (() => void) => () => {};

/**
 * An inline script that runs while the browser parses the server HTML (before first paint).
 *
 * Rendered only during SSR and hydration (server snapshot = true), so React never creates a
 * <script> element on the client — e.g. when a not-found / error boundary is client-rendered —
 * where it would not execute anyway (and React warns about it). After hydration the element is
 * dropped from the DOM; the script has already done its job by then.
 */
export function BootScript({ code }: { code: string }): ReactElement | null {
  const fromServerHtml = useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true,
  );
  return fromServerHtml ? <script dangerouslySetInnerHTML={{ __html: code }} /> : null;
}
