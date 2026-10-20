'use client';

import { createContext, type ReactElement, type ReactNode, useContext } from 'react';

import type { ErrorCopy } from './error-copy';

const ErrorCopyContext = createContext<ErrorCopy | null>(null);

/**
 * Makes the error page's copy (resolved by the server layout, see ./error-copy.ts) available to
 * the client error boundary of the same segment: Next.js renders error.tsx INSIDE the layout,
 * so the boundary always finds this provider above it. Renders no element.
 */
export function ErrorCopyProvider({ copy, children }: { copy: ErrorCopy; children: ReactNode }): ReactElement {
  return <ErrorCopyContext value={copy}>{children}</ErrorCopyContext>;
}

/** The copy of the error page; null only outside the [locale] layout (never in practice). */
export function useErrorCopy(): ErrorCopy | null {
  return useContext(ErrorCopyContext);
}
