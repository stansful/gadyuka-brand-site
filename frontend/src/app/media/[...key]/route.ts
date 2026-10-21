import { proxyMediaRequest } from '@/lib/api/media-proxy';

/**
 * Media files: GET|HEAD /media/<key> streamed from the backend (${BACKEND_URL}/media/<key>, which
 * reads the private bucket) — src/lib/api/media-proxy.ts. Same origin, so next/image optimizes
 * Media.url without remotePatterns (next.config.ts → images.localPatterns /media/**).
 */

type MediaRouteContext = RouteContext<'/media/[...key]'>;

export async function GET(request: Request, { params }: MediaRouteContext): Promise<Response> {
  return proxyMediaRequest(request, (await params).key);
}

/** HEAD without a body (Next would otherwise run GET and drop the body). */
export async function HEAD(request: Request, { params }: MediaRouteContext): Promise<Response> {
  return proxyMediaRequest(request, (await params).key);
}
