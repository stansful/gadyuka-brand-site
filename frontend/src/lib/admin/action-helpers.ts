import 'server-only';
import { unstable_rethrow } from 'next/navigation';

import { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';

import type { AdminTranslator } from './i18n';

import { actionFail, type ActionFailure, type ActionResult } from './action-result';
import { AdminAuthError, requireAdminAction } from './auth';
import { getAdminTranslations } from './i18n-server';

/**
 * Wraps the body of every admin Server Action:
 *  1. authorizes the caller (requireAdminAction — never trust that the form was rendered for an admin);
 *  2. maps known failures to messages from admin.errors (auth, Prisma unique/FK/not-found);
 *  3. logs unexpected errors server-side and returns a generic message (no stack traces to the client).
 * Next.js control-flow errors (redirect, notFound) are re-thrown.
 */
export async function adminAction<T>(label: string, run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    await requireAdminAction();
    return await run();
  } catch (error: unknown) {
    unstable_rethrow(error);
    const t = await getAdminTranslations('admin.errors');
    if (error instanceof AdminAuthError) return actionFail(t('sessionExpired'));
    const known = describePrismaError(error, t);
    if (known) return actionFail(known);
    console.error(`[admin] action "${label}" failed:`, error);
    return actionFail(t('actionFailed'));
  }
}

function describePrismaError(error: unknown, t: AdminTranslator<'admin.errors'>): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (error.code) {
    case 'P2002':
      return t('duplicate');
    case 'P2003':
      return t('related');
    case 'P2025':
      return t('notFound');
    default:
      return null;
  }
}

/** Ids from `ids` that do not exist as Media rows (to report a stale picker instead of an FK error). */
export async function findMissingMediaIds(ids: ReadonlyArray<string | null | undefined>): Promise<string[]> {
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
  if (wanted.length === 0) return [];
  const rows = await db.media.findMany({ where: { id: { in: wanted } }, select: { id: true } });
  const found = new Set(rows.map(row => row.id));
  return wanted.filter(id => !found.has(id));
}

type AdminErrorKey = Parameters<AdminTranslator<'admin.errors'>>[0];

/** A failure with a shared admin.errors message («Некорректный идентификатор» …). */
export async function errorFailure(key: AdminErrorKey): Promise<ActionFailure> {
  const t = await getAdminTranslations('admin.errors');
  return actionFail(t(key));
}

/**
 * Fails with «Выбранное изображение не найдено…» (on `fields` too) when a picked media id no
 * longer exists — a stale picker, reported instead of a foreign key error. Null = all present.
 */
export async function missingMediaFailure(
  ids: ReadonlyArray<string | null | undefined>,
  fields: readonly string[] = [],
): Promise<ActionFailure | null> {
  if ((await findMissingMediaIds(ids)).length === 0) return null;
  const message = (await getAdminTranslations('admin.errors'))('missingMedia');
  return actionFail(message, Object.fromEntries(fields.map(field => [field, message])));
}
