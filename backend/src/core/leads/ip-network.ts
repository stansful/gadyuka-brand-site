import { isIP } from 'node:net';

interface Ipv6Parts {
  /** The address without an embedded IPv4 tail ("64:ff9b::198.51.100.4" → "64:ff9b::") */
  readonly head: string;
  /** The embedded IPv4 tail as two hextets ([] when there is none) */
  readonly tail: readonly number[];
}

/**
 * The network a visitor's lead rate limit counts by: an IPv4 address as is, an IPv4-mapped IPv6
 * address ("::ffff:1.2.3.4") as its IPv4, any other IPv6 address as its /64 prefix
 * ("2001:db8:1:2::/64") — one IPv6 subscriber usually owns a whole /64, so per-address keys would be
 * free to rotate. Anything else (e.g. "unknown") is kept as is, lowercased.
 */
export class IpNetwork {
  private static readonly IPV6 = 6;
  private static readonly HEXTETS = 8;
  private static readonly PREFIX_HEXTETS = 4;
  private static readonly MAPPED_ZERO_HEXTETS = 5;
  private static readonly MAPPED_MARKER = 0xffff;
  private static readonly MAX_HEXTET = 0xffff;
  private static readonly HEX = 16;
  private static readonly OCTET_BITS = 8;
  private static readonly OCTET_MASK = 0xff;
  private static readonly IPV4_TAIL = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

  static of(ip: string): string {
    const address = ip.trim().toLowerCase();
    const hextets = isIP(address) === IpNetwork.IPV6 ? IpNetwork.findHextets(address) : undefined;
    if (hextets === undefined) {
      return address;
    }
    return IpNetwork.isIpv4Mapped(hextets) ? IpNetwork.ipv4Of(hextets) : IpNetwork.prefixOf(hextets);
  }

  /** The 8 hextets of a valid IPv6 address ("::" and an IPv4 tail expanded), or undefined. */
  private static findHextets(address: string): number[] | undefined {
    const { head, tail } = IpNetwork.splitIpv4Tail(address);
    const halves = head.split('::');
    return halves.length > 2 ? undefined : IpNetwork.joinHalves(halves, tail);
  }

  /** The halves around "::" (one when there is none) + the IPv4 tail → 8 hextets, the gap filled with zeros. */
  private static joinHalves([first, second]: readonly string[], tail: readonly number[]): number[] | undefined {
    const leading = IpNetwork.parseGroups(first);
    const trailing = [...IpNetwork.parseGroups(second), ...tail];
    const missing = IpNetwork.HEXTETS - leading.length - trailing.length;
    const hasGap = second !== undefined;
    if (missing < 0 || (!hasGap && missing !== 0)) {
      return undefined;
    }
    return IpNetwork.validHextets([...leading, ...Array.from({ length: missing }, () => 0), ...trailing]);
  }

  private static splitIpv4Tail(address: string): Ipv6Parts {
    const match = IpNetwork.IPV4_TAIL.exec(address);
    if (match === null) {
      return { head: address, tail: [] };
    }
    const [a, b, c, d] = match.slice(1, 5).map(Number);
    const head = address.slice(0, match.index);
    const trimmedHead = head.endsWith(':') && !head.endsWith('::') ? head.slice(0, -1) : head;
    return { head: trimmedHead, tail: [IpNetwork.hextetOf(a, b), IpNetwork.hextetOf(c, d)] };
  }

  private static hextetOf(high: number, low: number): number {
    return (high << IpNetwork.OCTET_BITS) | low;
  }

  private static parseGroups(part: string | undefined): number[] {
    if (part === undefined || part === '') {
      return [];
    }
    return part
      .split(':')
      .filter(group => group.length > 0)
      .map(group => Number.parseInt(group, IpNetwork.HEX));
  }

  private static validHextets(hextets: number[]): number[] | undefined {
    const isValid = (hextet: number): boolean =>
      Number.isInteger(hextet) && hextet >= 0 && hextet <= IpNetwork.MAX_HEXTET;
    return hextets.length === IpNetwork.HEXTETS && hextets.every(isValid) ? hextets : undefined;
  }

  private static isIpv4Mapped(hextets: readonly number[]): boolean {
    const zeros = hextets.slice(0, IpNetwork.MAPPED_ZERO_HEXTETS);
    return zeros.every(hextet => hextet === 0) && hextets[IpNetwork.MAPPED_ZERO_HEXTETS] === IpNetwork.MAPPED_MARKER;
  }

  private static ipv4Of(hextets: readonly number[]): string {
    const [high, low] = hextets.slice(-2);
    return [
      high >> IpNetwork.OCTET_BITS,
      high & IpNetwork.OCTET_MASK,
      low >> IpNetwork.OCTET_BITS,
      low & IpNetwork.OCTET_MASK,
    ].join('.');
  }

  private static prefixOf(hextets: readonly number[]): string {
    const prefix = hextets.slice(0, IpNetwork.PREFIX_HEXTETS).map(hextet => hextet.toString(IpNetwork.HEX));
    return `${prefix.join(':')}::/64`;
  }
}
