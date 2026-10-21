/** Why an upload was refused (the admin shows admin.media.errors.<code>). */
export enum ImageValidationCode {
  EMPTY = 'empty',
  TOO_LARGE = 'tooLarge',
  UNSUPPORTED = 'unsupported',
  PROCESSING_FAILED = 'processingFailed',
}
