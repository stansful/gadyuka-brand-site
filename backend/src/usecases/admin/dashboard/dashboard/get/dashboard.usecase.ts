import { Injectable } from '@nestjs/common';

import { SiteTextCounters } from '~core/site-texts/site-text-counters';
import { SiteTextOverview } from '~usecases/admin/site-texts/common/site-text-overview';
import { VisitRepository } from '~usecases/public/content/common/visit.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { DashboardRepository } from './dashboard.repository';
import { DashboardResponse } from './dashboard.response';

/** The admin home page: every list with its published count, the media, the site texts, the leads. */
@Injectable()
export class DashboardUsecase implements Usecase<void, DashboardResponse> {
  /** Leads of «Последние заявки». */
  private static readonly LATEST_LEADS = 5;

  constructor(
    private readonly repository: DashboardRepository,
    private readonly visits: VisitRepository,
    private readonly texts: SiteTextOverview,
  ) {}

  async execute(): Promise<DashboardResponse> {
    const [entities, media, leads, latestLeads, texts, visits] = await Promise.all([
      this.repository.countEntities(),
      this.repository.countMedia(),
      this.repository.countLeads(),
      this.repository.findLatestLeads(DashboardUsecase.LATEST_LEADS),
      this.texts.findEntries(),
      this.countVisits(),
    ]);
    return DashboardResponse.of({ entities, media, leads, latestLeads, texts: SiteTextCounters.of(texts), visits });
  }

  private async countVisits(): Promise<{ today: number; yesterday: number }> {
    const [today, yesterday] = await Promise.all([
      this.visits.countUniqueTotal(dayStart(0), dayEnd(0)),
      this.visits.countUniqueTotal(dayStart(-1), dayEnd(-1)),
    ]);
    return { today, yesterday };
  }
}

function dayStart(offsetDays: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function dayEnd(offsetDays: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}
