import { MEDIA_URL_PREFIX } from '~core/media/media.constants';

/** GET|HEAD /media/<key> — outside /api/v1: it is the public URL of every file (media.url). */
export const MEDIA_ROUTE = `${MEDIA_URL_PREFIX}/*`;

/** Name of the wildcard parameter (the key) in Fastify. */
export const MEDIA_KEY_PARAM = '*';
