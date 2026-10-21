import { isIP } from 'node:net';

import { Injectable } from '@nestjs/common';

import { FastifyRequest } from 'fastify';

import { RequestHeader } from '~core/constants/request-header.enum';

/**
 * The visitor's IP. The backend is only reachable from the Next.js server, which forwards the
 * visitor's address in x-client-ip (trusted: such requests carry the internal key). Without a valid
 * header the connection address is used.
 */
@Injectable()
export class ClientIpResolver {
  static readonly UNKNOWN = 'unknown';

  resolve(request: FastifyRequest): string {
    const forwarded = request.headers[RequestHeader.CLIENT_IP];
    const candidate = typeof forwarded === 'string' ? forwarded.trim() : '';
    if (isIP(candidate) !== 0) {
      return candidate;
    }
    return isIP(request.ip) !== 0 ? request.ip : ClientIpResolver.UNKNOWN;
  }
}
