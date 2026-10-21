import { ILeadDeliveryRepository, LeadDelivery } from '../lead-delivery';

/** Unit tests: the stored outcomes by lead id; `failWith` makes every write fail. */
export class InMemoryLeadDeliveryRepository implements ILeadDeliveryRepository {
  readonly deliveries = new Map<string, LeadDelivery>();
  private failure: Error | undefined;

  failWith(error: Error): void {
    this.failure = error;
  }

  async saveDelivery(leadId: string, delivery: LeadDelivery): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.deliveries.set(leadId, delivery);
  }
}
