export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "Request origin was rejected.");
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof HttpError
          ? e.message
          : e instanceof Error && e.name === "ZodError"
            ? "Invalid study data. Check your inputs."
            : "The request could not be completed. Please try again.",
    },
    { status: e instanceof HttpError ? e.status : 400 },
  );
}
export async function jsonBody(request: Request, max = 4_000_000) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new HttpError(
      413,
      "This workspace is too large. Export old sets and remove them before saving.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(
        413,
        "The submitted material is too large. Select fewer pages.",
      );
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(combined));
}
