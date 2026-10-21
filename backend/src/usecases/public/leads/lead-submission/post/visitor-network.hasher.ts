import { createHmac } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { ConfigService } from '~config';
import { IpNetwork } from '~core/leads/ip-network';

/**
 * Lead.ipHash: HMAC-SHA256(key = IP_HASH_SALT, the visitor's network — IpNetwork) in hex. The IP itself
 * is never stored; the secret salt keeps the 2^32 IPv4 space from being brute-forced back. Visitors
 * without a known IP share one bucket. The key is the validated IP_HASH_SALT as is (ConfigService trims it
 * before its minimum length is checked).
 */
@Injectable()
export class VisitorNetworkHasher {
  private readonly salt: string;

  constructor(config: ConfigService) {
    this.salt = config.getSafety('IP_HASH_SALT');
  }

  hashOf(clientIp: string): string {
    const network = IpNetwork.of(clientIp).trim().toLowerCase();
    return createHmac('sha256', this.salt).update(network, 'utf8').digest('hex');
  }
}
