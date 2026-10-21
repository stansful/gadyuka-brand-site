import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

/** Columns a test sets on its lead (the rest: a CONTACT lead in ru, created at `createdAt`). */
export interface LeadFixture {
  readonly type?: LeadType;
  readonly status?: LeadStatus;
  readonly name?: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly message?: string;
  readonly locale?: string;
  readonly telegramSent?: boolean;
  readonly telegramError?: string | null;
  readonly meta?: Prisma.InputJsonValue;
  /** Default: 2020-01-01 — outside the 10-minute windows of the lead limits */
  readonly createdAt?: Date;
}

/** Leads written straight into the test database for one e2e file, removed by `remove()`. */
export class LeadFixtures {
  private static readonly DEFAULTS = {
    type: LeadType.CONTACT,
    name: 'E2E',
    message: '',
    locale: 'ru',
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
  } as const;
  private readonly ids: string[] = [];

  constructor(private readonly database: DatabaseService) {}

  async create(fixture: LeadFixture = {}): Promise<string> {
    const lead = await this.database.client.lead.create({
      data: { ...LeadFixtures.DEFAULTS, ...fixture },
      select: { id: true },
    });
    this.ids.push(lead.id);
    return lead.id;
  }

  async remove(): Promise<void> {
    await this.database.client.lead.deleteMany({ where: { id: { in: this.ids } } });
  }
}
