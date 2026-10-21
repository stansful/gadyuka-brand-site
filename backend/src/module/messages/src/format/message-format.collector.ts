import {
  DateElement,
  MessageFormatElement,
  NumberElement,
  TimeElement,
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
} from '@formatjs/icu-messageformat-parser';

import { ArgumentType } from './argument-type.enum';
import { MessageFormat } from './message-format';

export type FormattedElement = NumberElement | DateElement | TimeElement;

/** Walks parsed ICU elements (every plural / select branch and tag body included). */
export class MessageFormatCollector {
  /** Arguments and tags used anywhere in `elements`. */
  formatOf(elements: readonly MessageFormatElement[]): MessageFormat {
    const names = { arguments: new Set<string>(), tags: new Set<string>() };
    this.collectNames(elements, names);
    return { arguments: [...names.arguments], tags: [...names.tags] };
  }

  /** Arguments used as numbers (plural, number) or dates (date, time); others are text. */
  argumentTypes(elements: readonly MessageFormatElement[], types: Map<string, ArgumentType>): void {
    for (const element of elements) {
      this.recordType(element, types);
      this.childrenOf(element).forEach(children => this.argumentTypes(children, types));
    }
  }

  /** Every number / date / time argument. */
  formattedElements(elements: readonly MessageFormatElement[]): FormattedElement[] {
    return elements.flatMap((element): FormattedElement[] => {
      if (isNumberElement(element) || isDateElement(element) || isTimeElement(element)) {
        return [element];
      }
      return this.childrenOf(element).flatMap(children => this.formattedElements(children));
    });
  }

  private collectNames(
    elements: readonly MessageFormatElement[],
    names: { arguments: Set<string>; tags: Set<string> },
  ): void {
    for (const element of elements) {
      if (isTagElement(element)) {
        names.tags.add(element.value);
      } else if (this.isArgumentLike(element)) {
        names.arguments.add(element.value);
      }
      this.childrenOf(element).forEach(children => this.collectNames(children, names));
    }
  }

  private isArgumentLike(element: MessageFormatElement): element is MessageFormatElement & { value: string } {
    return [isArgumentElement, isNumberElement, isDateElement, isTimeElement, isPluralElement, isSelectElement].some(
      guard => guard(element),
    );
  }

  private recordType(element: MessageFormatElement, types: Map<string, ArgumentType>): void {
    if (isNumberElement(element) || isPluralElement(element)) {
      types.set(element.value, ArgumentType.NUMBER);
    } else if (isDateElement(element) || isTimeElement(element)) {
      types.set(element.value, ArgumentType.DATE);
    }
  }

  /** Nested element lists: the branches of a plural / select, the body of a tag. */
  childrenOf(element: MessageFormatElement): MessageFormatElement[][] {
    if (isPluralElement(element) || isSelectElement(element)) {
      return Object.values(element.options).map(option => option.value);
    }
    return isTagElement(element) ? [element.children] : [];
  }
}
