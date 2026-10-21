import {
  MessageFormatElement,
  isArgumentElement,
  isLiteralElement,
  isTagElement,
} from '@formatjs/icu-messageformat-parser';

import { IcuMessageParser } from './icu-message.parser';
import { MessageIssueCode, MessageValueIssue } from './message-issue';

/** What the template check of one value needs: its text, the default's tags as written there. */
export interface TemplateCheckInput {
  readonly value: string;
  readonly elements: readonly MessageFormatElement[];
  /** "lang" → ["<lang>{language}</lang>"]: the tags of the defaults as written (what the site splits on) */
  readonly defaultTagSources: ReadonlyMap<string, readonly string[]>;
}

/**
 * Template rules (MessageSyntax.TEMPLATE): literal text written as it shows (no apostrophe
 * quoting), bare `{name}` arguments and the default's tags written exactly as in the default, each
 * at most once. Such a value reads the same to ICU and to a plain search-and-replace of its tokens.
 */
export class TemplateRulesChecker {
  constructor(private readonly parser: IcuMessageParser) {}

  check(input: TemplateCheckInput): MessageValueIssue[] {
    const run = new TemplateCheckRun(input, this.parser);
    run.visit(input.elements);
    return run.issues();
  }
}

/** One pass over the elements of one value (collects issues and the tokens already seen). */
class TemplateCheckRun {
  private readonly seen = new Set<string>();
  private readonly found: MessageValueIssue[] = [];

  constructor(
    private readonly input: TemplateCheckInput,
    private readonly parser: IcuMessageParser,
  ) {}

  issues(): MessageValueIssue[] {
    return this.found;
  }

  visit(elements: readonly MessageFormatElement[]): void {
    for (const element of elements) {
      this.visitElement(element, this.parser.sourceOf(this.input.value, element));
    }
  }

  private visitElement(element: MessageFormatElement, source: string): void {
    if (isLiteralElement(element)) {
      this.checkLiteral(element.value, source);
    } else if (isArgumentElement(element)) {
      this.checkArgument(element.value, source);
    } else if (isTagElement(element)) {
      this.checkTag(element.value, source, element.children);
    } else if ('value' in element && typeof element.value === 'string') {
      this.found.push({ code: MessageIssueCode.TEMPLATE_FORMAT, name: element.value });
    }
  }

  private checkLiteral(text: string, source: string): void {
    if (source !== text) {
      this.found.push({ code: MessageIssueCode.TEMPLATE_QUOTE });
    }
  }

  private checkArgument(name: string, source: string): void {
    const token = `{${name}}`;
    if (source === token) {
      this.useOnce(token);
      return;
    }
    this.found.push({ code: MessageIssueCode.TEMPLATE_TOKEN, token });
  }

  private checkTag(name: string, source: string, children: readonly MessageFormatElement[]): void {
    const allowed = this.input.defaultTagSources.get(name) ?? [];
    if (!allowed.includes(source)) {
      this.found.push({ code: MessageIssueCode.TEMPLATE_TOKEN, token: allowed[0] ?? `<${name}>…</${name}>` });
      return;
    }
    this.useOnce(`<${name}>`);
    this.visit(children);
  }

  private useOnce(token: string): void {
    if (this.seen.has(token)) {
      this.found.push({ code: MessageIssueCode.TEMPLATE_REPEAT, token });
    }
    this.seen.add(token);
  }
}
