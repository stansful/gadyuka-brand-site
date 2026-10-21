/**
 * Message keys of the leads slice (S2): the lead form's errors are site messages (forms.errors.* of
 * shared/messages/<locale>.json — the site shows them in the visitor's language), the admin's ones
 * admin copy. src/test/message-keys.test.ts checks that every key exists.
 */
export enum LeadsMessageKey {
  REQUIRED = 'forms.errors.required',
  INVALID_EMAIL = 'forms.errors.invalidEmail',
  INVALID_PHONE = 'forms.errors.invalidPhone',
  CONTACT_REQUIRED = 'forms.errors.contactRequired',
  TOO_SHORT = 'forms.errors.tooShort',
  TOO_LONG = 'forms.errors.tooLong',
  CONSENT_REQUIRED = 'forms.errors.consentRequired',
  INVALID_TYPE = 'forms.errors.invalidType',
  INVALID = 'forms.errors.invalid',
  RATE_LIMITED = 'forms.errors.rateLimited',
  ADMIN_NOT_FOUND = 'admin.leads.notFound',
}
