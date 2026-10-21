import { LEADS_PAGE_SIZE } from './lead.constants';

/**
 * A page of the admin's leads list: the requested page clamped to 1…pageCount (an empty list has one
 * empty page), LEADS_PAGE_SIZE rows each.
 */
export class LeadListPage {
  static readonly FIRST = 1;

  readonly size = LEADS_PAGE_SIZE;
  readonly count: number;
  readonly number: number;

  private constructor(requested: number, total: number) {
    this.count = Math.max(LeadListPage.FIRST, Math.ceil(total / LEADS_PAGE_SIZE));
    this.number = Math.min(Math.max(LeadListPage.FIRST, requested), this.count);
  }

  static of(requested: number, total: number): LeadListPage {
    return new LeadListPage(requested, total);
  }

  /** Rows before this page. */
  get offset(): number {
    return (this.number - LeadListPage.FIRST) * LEADS_PAGE_SIZE;
  }
}
