/**
 * The UUID form of the seed's derived ids (SeedRowIds, SeedMediaIdentity): the first 16 bytes of a hash
 * with the version nibble and the RFC 9562 variant (10xx) stamped in, as the canonical lowercase
 * 8-4-4-4-12 text — so it passes any UUID check of the API while staying the same on every run.
 */
export class SeedUuid {
  static readonly BYTES = 16;
  /** The byte whose high nibble is the version, and the one whose top two bits are the variant. */
  private static readonly VERSION_BYTE = 6;
  private static readonly VARIANT_BYTE = 8;
  private static readonly NIBBLE_BITS = 4;
  private static readonly LOW_NIBBLE_MASK = 0x0f;
  private static readonly VARIANT_PAYLOAD_MASK = 0x3f;
  private static readonly VARIANT_RFC_9562 = 0x80;
  /** Where each hex group of the canonical text ends. */
  private static readonly GROUP_ENDS: readonly number[] = [8, 12, 16, 20, 32];

  /** The first 16 of `bytes` (left untouched) stamped with `version` (0…15) and the variant. */
  format(bytes: Uint8Array, version: number): string {
    const { VERSION_BYTE, VARIANT_BYTE } = SeedUuid;
    const uuid = Buffer.from(bytes.subarray(0, SeedUuid.BYTES));
    uuid[VERSION_BYTE] = (version << SeedUuid.NIBBLE_BITS) | ((uuid[VERSION_BYTE] ?? 0) & SeedUuid.LOW_NIBBLE_MASK);
    uuid[VARIANT_BYTE] = SeedUuid.VARIANT_RFC_9562 | ((uuid[VARIANT_BYTE] ?? 0) & SeedUuid.VARIANT_PAYLOAD_MASK);
    return this.groupsOf(uuid.toString('hex'));
  }

  private groupsOf(hex: string): string {
    const ends = SeedUuid.GROUP_ENDS;
    return ends.map((end, index) => hex.slice(ends[index - 1] ?? 0, end)).join('-');
  }
}
