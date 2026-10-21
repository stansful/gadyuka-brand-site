import { SiteMessageDefault, SiteMessageSeedPlan } from './site-message-seed.interfaces';

/** Collects the decisions of SiteMessageSeedPlanner, one key × locale at a time. */
export class SiteMessageSeedPlanBuilder {
  private readonly creates: SiteMessageDefault[] = [];
  private readonly updates: SiteMessageDefault[] = [];
  private keptEdited = 0;

  addCreate(value: SiteMessageDefault): void {
    this.creates.push(value);
  }

  addUpdate(value: SiteMessageDefault): void {
    this.updates.push(value);
  }

  countKeptEdit(): void {
    this.keptEdited += 1;
  }

  build(orphans: readonly string[]): SiteMessageSeedPlan {
    return { creates: [...this.creates], updates: [...this.updates], keptEdited: this.keptEdited, orphans };
  }
}
