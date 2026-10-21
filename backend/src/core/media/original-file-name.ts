import { MAX_ORIGINAL_NAME_LENGTH } from './media.constants';

/**
 * Original file name of an upload, for display only (never part of a storage key): no directories,
 * no control characters, NFC, at most MAX_ORIGINAL_NAME_LENGTH characters (the end is kept).
 */
export class OriginalFileName {
  private static readonly FALLBACK = 'image';
  // oxlint-disable-next-line eslint/no-control-regex -- stripping control characters is the point
  private static readonly UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f<>:"|?*]/g;

  private constructor(private readonly value: string) {}

  static fromUpload(name: string): OriginalFileName {
    const cleaned = OriginalFileName.clean(OriginalFileName.baseName(name));
    const limited = cleaned.slice(Math.max(0, cleaned.length - MAX_ORIGINAL_NAME_LENGTH));
    return new OriginalFileName(limited.length > 0 ? limited : OriginalFileName.FALLBACK);
  }

  private static baseName(name: string): string {
    return name.split(/[\\/]/).pop() ?? '';
  }

  private static clean(name: string): string {
    return name.normalize('NFC').replace(OriginalFileName.UNSAFE_CHARACTERS, '').replace(/\s+/g, ' ').trim();
  }

  toString(): string {
    return this.value;
  }
}
