'use server';

import type { DeleteMediaResult, MediaUsageView } from '@/components/admin/media/media-types';
import { adminApiAction } from '@/lib/api/admin-action';
import { translateAdminMessage } from '@/lib/api/admin-messages';
import type { ApiResult } from '@/lib/api/api-result';
import { deleteMediaFile, getMediaDetails, saveMediaAlt } from '@/lib/api/media';
import type { LocalizedText } from '@/lib/localized-text';

import { actionOk, type ActionResult } from '../action-result';
import { translateMediaUsages } from '../media-usages';

/** Saves the alt text of a media file (every language; empty translations are dropped). */
export async function updateMediaAlt(id: string, alt: LocalizedText): Promise<ActionResult<{ alt: LocalizedText }>> {
  return adminApiAction('updateMediaAlt', () => saveMediaAlt(id, alt), {
    revalidatesContent: true,
    onSuccess: async data =>
      actionOk({ alt: { ...data.alt } }, await translateAdminMessage({ key: 'admin.media.altSaved' })),
  });
}

/**
 * Deletes a media file (row + stored file) — only when nothing references it. Otherwise returns
 * the list of places that use it (the UI shows them as links).
 */
export async function deleteMedia(id: string): Promise<DeleteMediaResult> {
  const blocked: { usages: MediaUsageView[] | null } = { usages: null };
  const result = await adminApiAction(
    'deleteMedia',
    async () => {
      const deleted = await withInvalidIdMessage(deleteMediaFile(id));
      if (isInUse(deleted)) blocked.usages = await findUsages(id);
      return deleted;
    },
    {
      revalidatesContent: true,
      onSuccess: async () => actionOk(null, await translateAdminMessage({ key: 'admin.media.details.deleted' })),
    },
  );
  if (!result.ok && blocked.usages) return { ok: false, error: result.error, usages: blocked.usages };
  return result;
}

/** A malformed id is one message («Некорректный идентификатор»), not «Проверьте поля формы». */
async function withInvalidIdMessage(request: Promise<ApiResult<void>>): Promise<ApiResult<void>> {
  const result = await request;
  if (result.ok || result.failure.kind !== 'validation') return result;
  return {
    ok: false,
    failure: {
      kind: 'domain',
      status: result.failure.status,
      error: 'badRequest',
      message: { key: 'admin.errors.invalidId' },
    },
  };
}

function isInUse(result: ApiResult<void>): boolean {
  return !result.ok && result.failure.kind === 'domain' && result.failure.message.key === 'admin.media.errors.inUse';
}

/** The places that use the file, for the refused delete (null when they cannot be loaded). */
async function findUsages(id: string): Promise<MediaUsageView[] | null> {
  const details = await getMediaDetails(id);
  return details.ok ? translateMediaUsages(details.data.usages) : null;
}
