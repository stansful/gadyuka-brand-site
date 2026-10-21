/**
 * Admin dashboard (owner: slice S3).
 *
 * - GET /admin/dashboard            → 200 DashboardResponse (counters of the home page, latest leads)
 * - GET /admin/dashboard/new-leads  → 200 DashboardNewLeadsResponse (the new-leads badge of the sidebar)
 */

import type { IsoDateTime, Uuid } from './common';
import type { PublishableEntityKind } from './entities';
import type { LeadStatus, LeadType } from './leads';

/** Rows of an admin list and how many of them the site shows. */
export interface DashboardEntityCount {
  readonly total: number;
  readonly published: number;
}

/** «Тексты сайта» counters (the same rules as the section tabs). */
export interface DashboardTextsSummary {
  readonly total: number;
  readonly edited: number;
  readonly gaps: number;
  readonly unsaved: number;
}

export interface DashboardLeadsSummary {
  readonly total: number;
  /** Status NEW */
  readonly fresh: number;
  /** Not delivered to Telegram (spam excluded) */
  readonly telegramFailed: number;
}

/** A lead of the «Последние заявки» list. */
export interface DashboardLeadItem {
  readonly id: Uuid;
  readonly type: LeadType;
  readonly status: LeadStatus;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  /** The message with collapsed whitespace, cut at 140 characters (+ «…») */
  readonly preview: string;
  readonly locale: string;
  readonly telegramSent: boolean;
  readonly createdAt: IsoDateTime;
}

export interface DashboardResponse {
  /** Every admin list with a publish toggle */
  readonly entities: Readonly<Record<PublishableEntityKind, DashboardEntityCount>>;
  /** Files in the media library */
  readonly media: number;
  readonly texts: DashboardTextsSummary;
  readonly leads: DashboardLeadsSummary;
  /** The 5 newest leads, newest first */
  readonly latestLeads: readonly DashboardLeadItem[];
}

export interface DashboardNewLeadsResponse {
  /** Leads with status NEW */
  readonly count: number;
}
