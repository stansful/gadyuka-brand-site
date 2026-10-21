import { Reflector } from '@nestjs/core';

/** The route needs no signed-in user (AuthGuard lets it through). The internal key is still required. */
export const Public = Reflector.createDecorator<void, true>({ transform: () => true });
