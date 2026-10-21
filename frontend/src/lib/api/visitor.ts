import 'server-only';
import { headers } from 'next/headers';

import type { VisitorInfo } from './client';

import { clientIpFromHeaders } from './client-ip';

/** Longest user agent forwarded (the backend stores at most 512 characters). */
const MAX_USER_AGENT_LENGTH = 512;

/**
 * The visitor of the current request, for backend calls made on their behalf (sign-in, the lead
 * form, admin actions): `apiRequest(path, { visitor: await getVisitor() })`. A request-time API —
 * never inside "use cache" (cached public reads are made for everyone, not for a visitor).
 */
export async function getVisitor(): Promise<VisitorInfo> {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get('user-agent')?.trim().slice(0, MAX_USER_AGENT_LENGTH) || null;
  return { clientIp: clientIpFromHeaders(requestHeaders), userAgent };
}
