import { createParamDecorator } from '@nestjs/common';

import { RequestContext } from './request-context';

/** The visitor's IP (x-client-ip from the Next.js server, else the connection address). */
export const ClientIp = createParamDecorator(RequestContext.clientIpOf);
