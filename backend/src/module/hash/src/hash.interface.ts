export interface IHash {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, hash: string): Promise<boolean>;
}

export interface IHashOptions {
  delimiter?: string;
  saltSize?: number;
  keyLength?: number;
}
