/** Problems of an admin-entered message value (the admin maps each code to its own text). */
export enum MessageIssueCode {
  /** Not valid ICU (unbalanced braces, an unclosed tag …); `error` is the parser's error kind. */
  SYNTAX = 'syntax',
  /** `{name}` that the code never passes — the message would fail to render. */
  UNKNOWN_ARGUMENT = 'unknownArgument',
  /** `<name>` that the default does not use — nothing renders it. */
  UNKNOWN_TAG = 'unknownTag',
  /** A tag of the default is missing (the code splits the text on it, e.g. `<lang>`). */
  MISSING_TAG = 'missingTag',
  /** Template: a plural / select / number / date argument — the site inserts the value as it is. */
  TEMPLATE_FORMAT = 'templateFormat',
  /** Template: `{ name }`, or a tag not written exactly as in the default — the site would not find it. */
  TEMPLATE_TOKEN = 'templateToken',
  /** Template: an argument or tag used twice — the site inserts each value once. */
  TEMPLATE_REPEAT = 'templateRepeat',
  /** Template: ICU apostrophe quoting ('' or '{…}') — the site would show the apostrophes. */
  TEMPLATE_QUOTE = 'templateQuote',
  /** Valid ICU that throws when formatted; `token` is its source ("{count, number, ::currency/XY}"). */
  FORMAT = 'format',
}

export type MessageValueIssue =
  | { readonly code: MessageIssueCode.SYNTAX; readonly error: string }
  | { readonly code: MessageIssueCode.UNKNOWN_ARGUMENT; readonly name: string }
  | { readonly code: MessageIssueCode.UNKNOWN_TAG; readonly name: string }
  | { readonly code: MessageIssueCode.MISSING_TAG; readonly name: string }
  | { readonly code: MessageIssueCode.TEMPLATE_FORMAT; readonly name: string }
  | { readonly code: MessageIssueCode.TEMPLATE_TOKEN; readonly token: string }
  | { readonly code: MessageIssueCode.TEMPLATE_REPEAT; readonly token: string }
  | { readonly code: MessageIssueCode.TEMPLATE_QUOTE }
  | { readonly code: MessageIssueCode.FORMAT; readonly token: string; readonly error: string };
