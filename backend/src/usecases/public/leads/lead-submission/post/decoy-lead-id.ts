import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

/**
 * The id answered to a honeypot hit: a UUID v7 (48-bit creation time + random bits) like the ids of
 * stored leads, so a bot cannot tell the decoy from a success.
 */
@Injectable()
export class DecoyLeadId {
  private static readonly BYTES = 16;
  private static readonly TIMESTAMP_BYTES = 6;
  private static readonly VERSION_BYTE = 6;
  private static readonly VARIANT_BYTE = 8;
  private static readonly VERSION_7 = 0x70;
  private static readonly VARIANT_RFC_9562 = 0x80;
  private static readonly LOW_NIBBLE = 0x0f;
  private static readonly LOW_SIX_BITS = 0x3f;
  /** Hex positions of the dashes: 8-4-4-4-12 */
  private static readonly GROUP_ENDS = [8, 12, 16, 20] as const;

  /** A fresh id with the creation time `nowMs` (milliseconds since the epoch). */
  create(nowMs: number): string {
    const bytes = randomBytes(DecoyLeadId.BYTES);
    bytes.writeUIntBE(nowMs, 0, DecoyLeadId.TIMESTAMP_BYTES);
    bytes[DecoyLeadId.VERSION_BYTE] =
      (bytes[DecoyLeadId.VERSION_BYTE] & DecoyLeadId.LOW_NIBBLE) | DecoyLeadId.VERSION_7;
    bytes[DecoyLeadId.VARIANT_BYTE] =
      (bytes[DecoyLeadId.VARIANT_BYTE] & DecoyLeadId.LOW_SIX_BITS) | DecoyLeadId.VARIANT_RFC_9562;
    return this.format(bytes.toString('hex'));
  }

  private format(hex: string): string {
    const [first, second, third, fourth] = DecoyLeadId.GROUP_ENDS;
    return [
      hex.slice(0, first),
      hex.slice(first, second),
      hex.slice(second, third),
      hex.slice(third, fourth),
      hex.slice(fourth),
    ].join('-');
  }
}
