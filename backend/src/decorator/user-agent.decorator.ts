import { createParamDecorator } from '@nestjs/common';

import { RequestContext } from './request-context';

/** The visitor's User-Agent forwarded by the site's server (x-client-user-agent), or undefined. */
export const UserAgent = createParamDecorator(RequestContext.userAgentOf);
