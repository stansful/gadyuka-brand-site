/**
 * Bounded request body reading for Route Handlers. `request.formData()` / `.json()` buffer
 * the whole body (also when Content-Length is absent, e.g. chunked uploads) before any size
 * check could run; this reader counts bytes while streaming and aborts at the limit.
 */

export class BodyTooLargeError extends Error {
  constructor() {
    super("Request body too large");
    this.name = "BodyTooLargeError";
  }
}

/** Reads the whole body, throwing BodyTooLargeError as soon as it exceeds `maxBytes`. */
export async function readBodyBytes(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Reads the body as UTF-8 text with the same limit. */
export async function readBodyText(request: Request, maxBytes: number): Promise<string> {
  return new TextDecoder("utf-8").decode(await readBodyBytes(request, maxBytes));
}

/**
 * Parses a multipart/form-data (or urlencoded) body read with a hard byte limit.
 * Throws BodyTooLargeError (limit) or TypeError (malformed body).
 */
export async function readFormData(request: Request, maxBytes: number): Promise<FormData> {
  const bytes = await readBodyBytes(request, maxBytes);
  const contentType = request.headers.get("content-type") ?? "";
  return new Response(bytes, { headers: { "content-type": contentType } }).formData();
}
