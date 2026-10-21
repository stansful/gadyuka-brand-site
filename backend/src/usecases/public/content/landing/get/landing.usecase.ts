import { Injectable } from '@nestjs/common';

import { Locale } from '~core/locales/locale.enum';
import { Clock } from '~module/common';
import { Usecase } from '~usecases/usecase.interfaces';

import { LandingRowsLoader } from './landing-rows.loader';
import { LandingPresenter } from './landing.presenter';
import { LandingResponse } from './landing.response';

export interface LandingQuery {
  readonly locale: Locale;
}

/** Everything the landing renders for one locale (port of the frontend's getLanding). */
@Injectable()
export class LandingUsecase implements Usecase<LandingQuery, LandingResponse> {
  constructor(
    private readonly loader: LandingRowsLoader,
    private readonly presenter: LandingPresenter,
    private readonly clock: Clock,
  ) {}

  async execute({ locale }: LandingQuery): Promise<LandingResponse> {
    const now = new Date(this.clock.now());
    const rows = await this.loader.load(locale, now);
    return this.presenter.toResponse(rows, locale, now);
  }
}
