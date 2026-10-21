import { API_VERSION } from '~usecases/usecase.interfaces';

/** Two segments after /leads: never taken for a lead id (GET /admin/leads/:id). */
export const LEAD_TELEGRAM_STATUS_ROUTE = `${API_VERSION}/admin/leads/telegram/status`;
