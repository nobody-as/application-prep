import { env } from "cloudflare:workers";
import { identity, jsonBody, fail, HttpError } from "@/lib/study/server";
import { workspaceSchema } from "@/lib/study/model";
import { readWorkspace, saveWorkspace } from "@/lib/study/storage";
export async function GET(request: Request) {
  try {
    const user = await identity(request);
    if (!env.DB) throw new HttpError(503, "Workspace storage is unavailable.");
    return Response.json(await readWorkspace(env.DB, user.userId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function PUT(request: Request) {
  try {
    const user = await identity(request);
    if (!env.DB) throw new HttpError(503, "Workspace storage is unavailable.");
    const body = await jsonBody(request);
    const workspace = workspaceSchema.parse(body.workspace);
    const revision = body.revision;
    if (!Number.isInteger(revision) || revision < 0)
      throw new HttpError(400, "Invalid revision.");
    const nextRevision = await saveWorkspace(
      env.DB,
      user.userId,
      workspace,
      revision,
    );
    if (nextRevision === null)
      throw new HttpError(
        409,
        "This workspace changed on another device. Reload the latest workspace before saving again.",
      );
    return Response.json(
      { revision: nextRevision },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
