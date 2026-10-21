/**
 * Keys of shared/messages/admin/ru.json the media library answers with (slice S5), besides the
 * admin.media.errors.* keys of the upload pipeline in AdminMessageKey (foundation).
 */
export enum MediaMessageKey {
  NO_FILE = 'admin.media.errors.noFile',
  UNREADABLE = 'admin.media.errors.unreadable',
  BAD_CURSOR = 'admin.media.errors.badCursor',
  NOT_FOUND_DELETED = 'admin.media.errors.notFoundDeleted',
  IN_USE = 'admin.media.errors.inUse',
}
