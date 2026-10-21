import type { AdminPartnerInput } from '~shared/contracts/content-entities';

import { HttpUrl } from '~core/content-entities/http-url';
import { LocalizedTextValue } from '~core/locales/localized-text-value';

import { PartnerFields } from './partner.records';

/** A validated partner form → what is stored (the link and the description normalized). */
export class PartnerFieldsFactory {
  static fromInput(input: AdminPartnerInput): PartnerFields {
    return {
      name: input.name,
      url: input.url === null ? null : HttpUrl.normalize(input.url),
      logoId: input.logoId,
      description: LocalizedTextValue.normalize(input.description),
      published: input.published,
    };
  }
}
