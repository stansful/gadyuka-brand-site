import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { ConfigService } from '~config';
import { IpNetwork } from '~core/leads/ip-network';

/**
 * Visitor IP hash: HMAC-SHA256(key = IP_HASH_SALT, the visitor's network — IpNetwork) in hex. The IP
 * itself is never stored; the secret salt keeps the address space from being brute-forced back.
 * Visitors without a known IP share one bucket. Used for lead rate limiting and visit tracking.
 */
@Injectable()
export class VisitorIpHasher {
  private readonly salt: string;

  constructor(config: ConfigService) {
    this.salt = config.getSafety('IP_HASH_SALT');
  }

  hashOf(clientIp: string): string {
    const network = IpNetwork.of(clientIp).trim().toLowerCase();
    return createHmac('sha256', this.salt).update(network, 'utf8').digest('hex');
  }
}
