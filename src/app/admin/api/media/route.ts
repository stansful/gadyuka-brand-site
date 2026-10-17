import { requireAdminRoute } from "@/lib/admin/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/admin/media-constants";
import { createMediaFromUpload, listMedia } from "@/lib/admin/media-service";
import { idSchema } from "@/lib/admin/schemas";
import { BodyTooLargeError, readFormData } from "@/lib/http/read-body";
import { MediaValidationError } from "@/lib/media";

/**
 * Admin media API (Route Handler: uploads exceed the 1 MB Server Action body limit).
 *
 *   GET  /admin/api/media?cursor=<id>&q=<text>  → { items: AdminMedia[], nextCursor }
 *   POST /admin/api/media  (multipart, field "file", one image per request)
 *        → 201 { media: AdminMedia } | 4xx { error: "<русское сообщение>" }
 */

/** Multipart overhead allowance on top of the file limit (hard cap, enforced while streaming). */
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 512 * 1024;
const TOO_LARGE_MESSAGE = `Файл больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ`;

const noStore = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request): Promise<Response> {
  const denied = await requireAdminRoute(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const cursorParam = url.searchParams.get("cursor");
  const cursor = cursorParam ? idSchema.safeParse(cursorParam) : null;
  if (cursor && !cursor.success) return Response.json({ error: "Некорректный курсор" }, { status: 400, headers: noStore });
  const query = url.searchParams.get("q") ?? undefined;

  const page = await listMedia({ cursor: cursor?.data ?? null, query });
  return Response.json(page, { headers: noStore });
}

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdminRoute(request);
  if (denied) return denied;

  // Never request.formData(): it buffers bodies of any size (chunked uploads have no
  // Content-Length). readFormData counts bytes while streaming and stops at the limit.
  let form: FormData;
  try {
    form = await readFormData(request, MAX_BODY_BYTES);
  } catch (error: unknown) {
    if (error instanceof BodyTooLargeError) {
      return Response.json({ error: TOO_LARGE_MESSAGE }, { status: 413, headers: noStore });
    }
    return Response.json({ error: "Не удалось прочитать файл из запроса" }, { status: 400, headers: noStore });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Файл не передан" }, { status: 400, headers: noStore });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: TOO_LARGE_MESSAGE }, { status: 413, headers: noStore });
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const media = await createMediaFromUpload({ data, originalName: file.name });
    return Response.json({ media }, { status: 201, headers: noStore });
  } catch (error: unknown) {
    if (error instanceof MediaValidationError) {
      return Response.json({ error: error.message }, { status: 422, headers: noStore });
    }
    console.error("[admin] media upload failed:", error);
    return Response.json({ error: "Не удалось сохранить файл. Попробуйте ещё раз." }, { status: 500, headers: noStore });
  }
}
