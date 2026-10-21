import { Reflector } from '@nestjs/core';

/**
 * The route is reachable without the x-internal-key header (InternalKeyGuard lets it through).
 * Only GET|HEAD /media/*: the site rewrites it to the backend for browsers and next/image.
 */
export const NoInternalKey = Reflector.createDecorator<void, true>({ transform: () => true });
