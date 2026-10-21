import { BinaryLike, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import { IHash, IHashOptions } from './hash.interface';

/**
 * Password hashing with scrypt (node:crypto): "<salt hex><delimiter><derived key hex>", a fresh
 * random salt per hash. Verification is constant-time; a malformed stored hash never matches.
 */
export class HashService implements IHash {
  private static readonly DEFAULT_DELIMITER = ':';
  private static readonly DEFAULT_SALT_BYTES = 16;
  private static readonly DEFAULT_KEY_BYTES = 32;
  private readonly delimiter: string;
  private readonly saltSize: number;
  private readonly keyLength: number;

  constructor({ saltSize, keyLength, delimiter }: IHashOptions) {
    this.delimiter = delimiter ?? HashService.DEFAULT_DELIMITER;
    this.saltSize = saltSize ?? HashService.DEFAULT_SALT_BYTES;
    this.keyLength = keyLength ?? HashService.DEFAULT_KEY_BYTES;
  }

  async hash(plainText: string): Promise<string> {
    const salt = randomBytes(this.saltSize).toString('hex');
    const derivedKey = await this.derive(plainText, salt);
    return `${salt}${this.delimiter}${derivedKey.toString('hex')}`;
  }

  async verify(plainText: string, hash: string): Promise<boolean> {
    const [salt, key] = hash.split(this.delimiter);
    const keyBuffer = Buffer.from(key ?? '', 'hex');
    if (!salt || keyBuffer.length !== this.keyLength) {
      return false;
    }
    const derivedKey = await this.derive(plainText, salt);
    return timingSafeEqual(keyBuffer, derivedKey);
  }

  private derive(plainText: BinaryLike, salt: BinaryLike): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(plainText, salt, this.keyLength, (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)));
    });
  }
}
