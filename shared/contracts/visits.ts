export type VisitGranularity = 'day' | 'hour';

export interface VisitsStatsQuery {
  readonly from: string;
  readonly to: string;
  readonly granularity: VisitGranularity;
}

export interface VisitsStatsPoint {
  readonly bucket: string;
  readonly count: number;
}

export interface VisitsStatsResponse {
  readonly points: readonly VisitsStatsPoint[];
  readonly total: number;
}

export interface VisitRecentItem {
  readonly firstAt: string;
  readonly lastAt: string;
  readonly path: string | null;
  readonly userAgent: string | null;
}

export interface VisitsRecentResponse {
  readonly visits: readonly VisitRecentItem[];
}
