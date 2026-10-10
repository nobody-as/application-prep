import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { readWorkspace, saveWorkspace } from "../lib/study/storage";
import { demoSet } from "../lib/study/demo";
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../drizzle/0000_aromatic_guardian.sql", import.meta.url),
      "utf8",
    ).replaceAll("--> statement-breakpoint", ""),
  );
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: (string | number)[]) {
          return {
            async first() {
              return sqlite.prepare(sql).get(...args) || null;
            },
            async run() {
              const r = sqlite.prepare(sql).run(...args);
              return { meta: { changes: Number(r.changes) } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, sqlite };
}
test("a saved study set and attempt round trip through the migration schema", async () => {
  const { db, sqlite } = database();
  try {
    const set = demoSet();
    const workspace = {
      sets: [set],
      attempts: [
        {
          setId: set.id,
          itemId: set.cards[0].id,
          kind: "card" as const,
          rating: "hard" as const,
          at: new Date().toISOString(),
          answer: "Test reasoning",
        },
      ],
    };
    assert.equal(await saveWorkspace(db, "user-a", workspace, 0), 1);
    const read = await readWorkspace(db, "user-a");
    assert.deepEqual(read.workspace, workspace);
    assert.equal(read.revision, 1);
  } finally {
    sqlite.close();
  }
});
test("user isolation and stale-device conflict rejection protect data", async () => {
  const { db, sqlite } = database();
  try {
    const original = { sets: [demoSet()], attempts: [] };
    assert.equal(await saveWorkspace(db, "user-a", original, 0), 1);
    assert.deepEqual(await readWorkspace(db, "user-b"), {
      workspace: { sets: [], attempts: [] },
      revision: 0,
    });
    assert.equal(
      await saveWorkspace(db, "user-a", { sets: [], attempts: [] }, 0),
      null,
    );
    assert.equal(
      await saveWorkspace(db, "user-a", { sets: [], attempts: [] }, 2),
      null,
    );
    assert.deepEqual((await readWorkspace(db, "user-a")).workspace, original);
    assert.equal(
      await saveWorkspace(db, "user-a", { sets: [], attempts: [] }, 1),
      2,
    );
    assert.equal(await saveWorkspace(db, "user-a", original, 1), null);
    assert.equal((await readWorkspace(db, "user-a")).revision, 2);
  } finally {
    sqlite.close();
  }
});
