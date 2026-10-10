import { type Workspace, emptyWorkspace } from "./model";
export async function readWorkspace(db: D1Database, userId: string) {
  const row = await db
    .prepare("SELECT payload, revision FROM workspaces WHERE user_id = ?")
    .bind(userId)
    .first<{ payload: string; revision: number }>();
  return {
    workspace: row ? (JSON.parse(row.payload) as Workspace) : emptyWorkspace(),
    revision: row?.revision || 0,
  };
}
export async function saveWorkspace(
  db: D1Database,
  userId: string,
  workspace: Workspace,
  revision: number,
) {
  const payload = JSON.stringify(workspace),
    now = new Date().toISOString();
  const result =
    revision === 0
      ? await db
          .prepare(
            "INSERT INTO workspaces (user_id, payload, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING",
          )
          .bind(userId, payload, now)
          .run()
      : await db
          .prepare(
            "UPDATE workspaces SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?",
          )
          .bind(payload, now, userId, revision)
          .run();
  return result.meta.changes ? revision + 1 : null;
}
