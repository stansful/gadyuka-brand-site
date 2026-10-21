import type { MessageRef } from '~shared/contracts/errors';

import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { MessageFormat, MessageIssueCode, MessageValueIssue } from '~module/messages';

type IssueMessage = (issue: MessageValueIssue, allowed: MessageFormat) => MessageRef;

/**
 * An ICU issue of an admin-edited text → the admin's explanation (admin.siteTexts.errors.* with
 * {token} / {allowed}). `allowed` = the arguments and tags of the key's defaults.
 */
export class SiteTextIssueMapper {
  /** Parser error kinds (@formatjs/icu-messageformat-parser ErrorKind) → the explanation; else syntaxArgument. */
  private static readonly SYNTAX_KEYS: ReadonlyArray<readonly [RegExp, SiteTextsMessageKey]> = [
    [/TAG/, SiteTextsMessageKey.ERRORS_SYNTAX_TAG],
    [/OTHER_CLAUSE/, SiteTextsMessageKey.ERRORS_SYNTAX_OTHER],
    [/PLURAL|SELECT|SELECTOR|OFFSET/, SiteTextsMessageKey.ERRORS_SYNTAX_PLURAL],
  ];

  private readonly messages: Readonly<Record<MessageIssueCode, IssueMessage>> = {
    [MessageIssueCode.SYNTAX]: issue => ({ key: this.syntaxKeyOf(issue) }),
    [MessageIssueCode.UNKNOWN_ARGUMENT]: (issue, allowed) => this.unknownArgument(this.nameOf(issue), allowed),
    [MessageIssueCode.UNKNOWN_TAG]: (issue, allowed) => this.unknownTag(this.nameOf(issue), allowed),
    [MessageIssueCode.MISSING_TAG]: issue =>
      this.withToken(SiteTextsMessageKey.ERRORS_MISSING_TAG, this.tagBody(issue)),
    [MessageIssueCode.TEMPLATE_FORMAT]: issue =>
      this.withToken(SiteTextsMessageKey.ERRORS_TEMPLATE_FORMAT, this.argumentToken(this.nameOf(issue))),
    [MessageIssueCode.TEMPLATE_TOKEN]: issue =>
      this.withToken(SiteTextsMessageKey.ERRORS_TEMPLATE_TOKEN, this.tokenOf(issue)),
    [MessageIssueCode.TEMPLATE_REPEAT]: issue =>
      this.withToken(SiteTextsMessageKey.ERRORS_TEMPLATE_REPEAT, this.tokenOf(issue)),
    [MessageIssueCode.TEMPLATE_QUOTE]: () => ({ key: SiteTextsMessageKey.ERRORS_TEMPLATE_QUOTE }),
    [MessageIssueCode.FORMAT]: issue => this.withToken(SiteTextsMessageKey.ERRORS_FORMAT, this.tokenOf(issue)),
  };

  toMessage(issue: MessageValueIssue, allowed: MessageFormat): MessageRef {
    return this.messages[issue.code](issue, allowed);
  }

  /** "{name}" */
  argumentToken(name: string): string {
    return `{${name}}`;
  }

  private unknownArgument(name: string, allowed: MessageFormat): MessageRef {
    const token = this.argumentToken(name);
    if (allowed.arguments.length === 0) {
      return this.withToken(SiteTextsMessageKey.ERRORS_NO_ARGUMENTS, token);
    }
    const list = allowed.arguments.map(argument => this.argumentToken(argument)).join(', ');
    return { key: SiteTextsMessageKey.ERRORS_UNKNOWN_ARGUMENT, values: { token, allowed: list } };
  }

  private unknownTag(name: string, allowed: MessageFormat): MessageRef {
    const token = this.tagToken(name);
    if (allowed.tags.length === 0) {
      return this.withToken(SiteTextsMessageKey.ERRORS_NO_TAGS, token);
    }
    const list = allowed.tags.map(tag => this.tagToken(tag)).join(', ');
    return { key: SiteTextsMessageKey.ERRORS_UNKNOWN_TAG, values: { token, allowed: list } };
  }

  private syntaxKeyOf(issue: MessageValueIssue): SiteTextsMessageKey {
    const error = 'error' in issue ? issue.error : '';
    const match = SiteTextIssueMapper.SYNTAX_KEYS.find(([pattern]) => pattern.test(error));
    return match === undefined ? SiteTextsMessageKey.ERRORS_SYNTAX_ARGUMENT : match[1];
  }

  private withToken(key: SiteTextsMessageKey, token: string): MessageRef {
    return { key, values: { token } };
  }

  /** "<name>" */
  private tagToken(name: string): string {
    return `<${name}>`;
  }

  /** "<name>…</name>" */
  private tagBody(issue: MessageValueIssue): string {
    const name = this.nameOf(issue);
    return `<${name}>…</${name}>`;
  }

  private nameOf(issue: MessageValueIssue): string {
    return 'name' in issue ? issue.name : '';
  }

  private tokenOf(issue: MessageValueIssue): string {
    return 'token' in issue ? issue.token : '';
  }
}
