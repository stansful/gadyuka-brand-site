import { LEAD_META_LIMITS, LEAD_SOURCE_SITE } from './lead.constants';

export interface LeadRequestContext {
  /** When the form (with the consent checkbox) was received */
  readonly receivedAt: Date;
  readonly userAgent: string | undefined;
  readonly referer: string | undefined;
}

/** Lead.meta of a site form: the 152-ФЗ consent time and where the form came from. */
export interface LeadMetaRecord {
  readonly [key: string]: string | null;
  /** ISO time the consent checkbox was submitted */
  readonly consentAt: string;
  readonly userAgent: string | null;
  readonly referer: string | null;
  readonly source: string;
}

export class LeadMeta {
  static of({ receivedAt, userAgent, referer }: LeadRequestContext): LeadMetaRecord {
    return {
      consentAt: receivedAt.toISOString(),
      userAgent: LeadMeta.clip(userAgent, LEAD_META_LIMITS.userAgent),
      referer: LeadMeta.clip(referer, LEAD_META_LIMITS.referer),
      source: LEAD_SOURCE_SITE,
    };
  }

  private static clip(value: string | undefined, max: number): string | null {
    return value === undefined ? null : value.slice(0, max);
  }
}
