import { Injectable } from '@nestjs/common';

import { SiteTextCounters } from '~core/site-texts/site-text-counters';
import { SiteTextOverview } from '~usecases/admin/site-texts/common/site-text-overview';
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
    private readonly texts: SiteTextOverview,
  ) {}

  async execute(): Promise<DashboardResponse> {
    const [entities, media, leads, latestLeads, texts] = await Promise.all([
      this.repository.countEntities(),
      this.repository.countMedia(),
      this.repository.countLeads(),
      this.repository.findLatestLeads(DashboardUsecase.LATEST_LEADS),
      this.texts.findEntries(),
    ]);
    return DashboardResponse.of({ entities, media, leads, latestLeads, texts: SiteTextCounters.of(texts) });
  }
}
