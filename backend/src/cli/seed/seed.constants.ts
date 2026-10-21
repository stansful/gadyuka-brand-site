/**
 * Fixed id of the seeded ADMIN user: the S3 keys of the seed media ("admin/<id>/…") stay the same
 * after a database reset, so objects already in the bucket are reused.
 */
export const SEED_ADMIN_USER_ID = '0199f2c4-0000-7000-8000-00000000ad01';

/** Display name when admin.common.adminUserName is missing from shared/messages. */
export const FALLBACK_ADMIN_NAME = 'Administrator';

/** DI token of the ordered seed steps (SeedStep[], built from SEED_STEPS). */
export const SEED_STEP_LIST = Symbol('seed-step-list');
