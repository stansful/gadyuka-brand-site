import { ApiProperty } from '@nestjs/swagger';

import type { SiteTextEntry } from '~shared/contracts/site-texts';

import { Locale } from '~core/locales/locale.enum';
import { SiteTextKind } from '~core/site-texts/site-text-kind.enum';
import { SiteTextEntryState } from '~usecases/admin/site-texts/common/site-text-entries.builder';

const PER_LOCALE = { type: 'object', additionalProperties: { type: 'string' } } as const;

/** One site text in the editor (the admin names it: admin.siteTexts.labels.<key>). */
export class SiteTextEntryResponse implements SiteTextEntry {
  @ApiProperty({ example: 'hero.title' })
  key: string;

  @ApiProperty({ enum: SiteTextKind })
  kind: SiteTextKind;

  @ApiProperty({ description: 'The Russian text must not be empty' })
  required: boolean;

  @ApiProperty({ ...PER_LOCALE, description: 'What the site shows: the row, or the default while it is missing' })
  values: Record<Locale, string>;

  @ApiProperty({ ...PER_LOCALE, description: 'shared/messages/<locale>.json' })
  defaults: Record<Locale, string>;

  @ApiProperty({ ...PER_LOCALE, description: 'ISO 8601 Message.editedAt of the locales edited in the admin' })
  edited: Partial<Record<Locale, string>>;

  @ApiProperty({ enum: Locale, isArray: true, description: 'Locales without a row (the default is shown)' })
  missing: Locale[];

  @ApiProperty({ type: [String], description: '{arguments} of the default' })
  placeholders: string[];

  @ApiProperty({ type: [String], description: '<tags> of the default' })
  tags: string[];

  static of(state: SiteTextEntryState): SiteTextEntryResponse {
    const { key, kind, required } = state.definition;
    const stored = { values: { ...state.values }, edited: { ...state.edited }, missing: [...state.missing] };
    return Object.assign(new SiteTextEntryResponse(), {
      key,
      kind,
      required,
      ...stored,
      ...SiteTextEntryResponse.defaultsOf(state),
    });
  }

  /** The default texts and the {arguments} / <tags> they use. */
  private static defaultsOf(state: SiteTextEntryState): Pick<SiteTextEntry, 'defaults' | 'placeholders' | 'tags'> {
    const { defaults, format } = state.definition;
    return { defaults: { ...defaults }, placeholders: [...format.arguments], tags: [...format.tags] };
  }
}
