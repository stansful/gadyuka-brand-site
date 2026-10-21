/** What happened to the stored file. */
export enum MediaObjectRemoval {
  REMOVED = 'removed',
  /** The storage failed: the file stays in the bucket, unreferenced (logged) */
  FAILED = 'failed',
  /** The row points into another bucket than the media disk's: nothing is deleted (logged) */
  OTHER_BUCKET = 'otherBucket',
}
