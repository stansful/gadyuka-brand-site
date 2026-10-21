/**
 * Message keys of the admin «Тексты сайта» (slice S3) in shared/messages/admin/ru.json — the admin
 * translates them (src/test/message-keys.test.ts checks that every key exists).
 */
export enum SiteTextsMessageKey {
  ERRORS_REQUIRED = 'admin.siteTexts.errors.required',
  ERRORS_LINK = 'admin.siteTexts.errors.link',
  ERRORS_SYNTAX_TAG = 'admin.siteTexts.errors.syntaxTag',
  ERRORS_SYNTAX_OTHER = 'admin.siteTexts.errors.syntaxOther',
  ERRORS_SYNTAX_PLURAL = 'admin.siteTexts.errors.syntaxPlural',
  ERRORS_SYNTAX_ARGUMENT = 'admin.siteTexts.errors.syntaxArgument',
  ERRORS_UNKNOWN_ARGUMENT = 'admin.siteTexts.errors.unknownArgument',
  ERRORS_NO_ARGUMENTS = 'admin.siteTexts.errors.noArguments',
  ERRORS_UNKNOWN_TAG = 'admin.siteTexts.errors.unknownTag',
  ERRORS_NO_TAGS = 'admin.siteTexts.errors.noTags',
  ERRORS_MISSING_TAG = 'admin.siteTexts.errors.missingTag',
  ERRORS_MISSING_ARGUMENT = 'admin.siteTexts.errors.missingArgument',
  ERRORS_TEMPLATE_FORMAT = 'admin.siteTexts.errors.templateFormat',
  ERRORS_TEMPLATE_TOKEN = 'admin.siteTexts.errors.templateToken',
  ERRORS_TEMPLATE_REPEAT = 'admin.siteTexts.errors.templateRepeat',
  ERRORS_TEMPLATE_QUOTE = 'admin.siteTexts.errors.templateQuote',
  ERRORS_FORMAT = 'admin.siteTexts.errors.format',
  ERRORS_UNKNOWN_KEY = 'admin.siteTexts.errors.unknownKey',
  ERRORS_UNKNOWN_IMAGE = 'admin.siteTexts.errors.unknownImage',
  ERRORS_CONFLICT = 'admin.siteTexts.errors.conflict',
  ERRORS_FIX_ERRORS = 'admin.siteTexts.errors.fixErrors',
  ERRORS_MISSING_MEDIA = 'admin.errors.missingMedia',
  VALIDATION_KEY_REQUIRED = 'admin.validation.keyRequired',
  VALIDATION_TOO_MANY_TEXTS = 'admin.validation.tooManyTexts',
  VALIDATION_TEXTS_DUPLICATE = 'admin.validation.textsDuplicate',
  VALIDATION_IMAGES_DUPLICATE = 'admin.validation.imagesDuplicate',
}
