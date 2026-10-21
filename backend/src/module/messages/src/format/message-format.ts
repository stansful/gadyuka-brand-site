/** Arguments ("count", "min") and rich-text tags ("lang") a message uses. */
export interface MessageFormat {
  readonly arguments: readonly string[];
  readonly tags: readonly string[];
}
