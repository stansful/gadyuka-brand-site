import { createParamDecorator } from '@nestjs/common';

import { RequestContext } from './request-context';

/** The signed-in user (AuthenticatedUser) — on routes behind AuthGuard, i.e. not @Public(). */
export const CurrentUser = createParamDecorator(RequestContext.currentUser);
