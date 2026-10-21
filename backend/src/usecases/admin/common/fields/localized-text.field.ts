import { applyDecorators, Type as ClassType } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength, ValidateNested, ValidationOptions } from 'class-validator';

import { AdminMessageKey } from '~core/constants/admin-message-key.enum';
import { LocaleMap } from '~core/locales/locale-map';
import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { ValidationMessage } from '~exception';

import { TextValidators } from './text-validators';

/** What a LocalizedText field allows. */
export interface LocalizedTextRules {
  /** Longest translation once trimmed */
  readonly max: number;
  /** Swagger description of the field */
  readonly description?: string;
}

interface TranslationRules {
  readonly max: number;
  /** The locale that must be filled in (none: every translation may be empty) */
  readonly requiredLocale?: Locale;
}

/**
 * A LocalizedText body field of an admin form ({ ru?: string, en?: string }) — port of the admin's zod
 * schemas (localizedTextSchema / requiredLocalizedTextSchema + the per-field length limit):
 *
 *   @LocalizedTextField.required({ max: 200, description: 'Headline' })
 *   title: LocalizedText;
 *
 * - the field is an object; each key is a site locale (another key → "<field>.<key>": unknownField);
 * - each translation is a string of at most 20 000 characters, and at most `max` once trimmed
 *   (tooLong {max}) — errors at "<field>.<locale>", so the admin marks that language's tab;
 * - `required`: the default locale (ru) is not blank — requiredText {locale} at "<field>.ru".
 * The value is stored normalized (LocalizedTextValue.normalize: trimmed, empty translations dropped).
 *
 * The translations are validated as a nested object of a class built per rule set (cached), since
 * class-validator rules are declared per class.
 */
export class LocalizedTextField {
  private static readonly inputClasses = new Map<string, ClassType>();

  static required({ max, description }: LocalizedTextRules): PropertyDecorator {
    const inputClass = LocalizedTextField.inputClassOf({ max, requiredLocale: DEFAULT_LOCALE });
    return LocalizedTextField.fieldOf(inputClass, description);
  }

  static optional({ max, description }: LocalizedTextRules): PropertyDecorator {
    return LocalizedTextField.fieldOf(LocalizedTextField.inputClassOf({ max }), description);
  }

  private static fieldOf(inputClass: ClassType, description: string | undefined): PropertyDecorator {
    return applyDecorators(
      ApiProperty({ type: () => inputClass, description }),
      IsObject(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID)),
      ValidateNested(),
      Type(() => inputClass),
    );
  }

  private static inputClassOf(rules: TranslationRules): ClassType {
    const name = `LocalizedText${rules.requiredLocale === undefined ? '' : 'Required'}${rules.max}`;
    const known = LocalizedTextField.inputClasses.get(name);
    if (known !== undefined) {
      return known;
    }
    const inputClass = LocalizedTextField.buildInputClass(name, rules);
    LocalizedTextField.inputClasses.set(name, inputClass);
    return inputClass;
  }

  /** A class named `name` (Swagger schema name) with one validated property per site locale. */
  private static buildInputClass(name: string, rules: TranslationRules): ClassType {
    const inputClass = { [name]: class {} }[name];
    for (const locale of LocaleMap.LOCALES) {
      LocalizedTextField.translationOf(locale, rules)(inputClass.prototype, locale);
    }
    return inputClass;
  }

  private static translationOf(locale: Locale, rules: TranslationRules): PropertyDecorator {
    return locale === rules.requiredLocale
      ? LocalizedTextField.requiredTranslation(locale, rules.max)
      : LocalizedTextField.optionalTranslation(rules.max);
  }

  /** Rules in the order they run (the pipe stops at the first failure of a property). */
  private static requiredTranslation(locale: Locale, max: number): PropertyDecorator {
    const required = ValidationMessage.of(AdminMessageKey.VALIDATION_REQUIRED_TEXT, { locale });
    return applyDecorators(
      ApiProperty({ type: String, maxLength: max }),
      IsString(required),
      LocalizedTextField.rawLength(),
      TextValidators.maxTrimmedLength(max, LocalizedTextField.tooLong(max)),
      TextValidators.isNotBlank(required),
    );
  }

  private static optionalTranslation(max: number): PropertyDecorator {
    return applyDecorators(
      ApiPropertyOptional({ type: String, maxLength: max }),
      IsOptional(),
      IsString(ValidationMessage.of(AdminMessageKey.VALIDATION_INVALID)),
      LocalizedTextField.rawLength(),
      TextValidators.maxTrimmedLength(max, LocalizedTextField.tooLong(max)),
    );
  }

  /** The raw translation (before trimming) fits the database guard of every LocalizedText field. */
  private static rawLength(): PropertyDecorator {
    const max = LocalizedTextValue.MAX_TRANSLATION_LENGTH;
    return MaxLength(max, LocalizedTextField.tooLong(max));
  }

  private static tooLong(max: number): ValidationOptions {
    return ValidationMessage.of(AdminMessageKey.VALIDATION_TOO_LONG, { max });
  }
}
