import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRange,
  selectedPages,
  verifyCitations,
  generationSchema,
  setSchema,
  workspaceSchema,
  isDue,
  latestAttempt,
  type Source,
} from "../lib/study/model";
import { generateFromSources } from "../lib/study/generator";
import { demoSet } from "../lib/study/demo";
import { publicUrl, publicIPv4, publicIPv6 } from "../lib/study/url";
const source: Source = {
  id: "s",
  title: "Memoization",
  range: "2",
  use: "both",
  pages: [
    {
      number: 1,
      text: "Photosynthesis allows plants to convert light energy into chemical energy using carbon dioxide and water.",
    },
    {
      number: 2,
      text: "Memoization stores the results of computations so repeated calls with equivalent inputs can reuse cached outputs. A cache needs invalidation when dependencies change, because a cached result may no longer describe the current state. Cache maintenance has overhead, which may exceed the cost of recomputation for cheap operations.",
    },
  ],
};
const input = (level = 3) =>
  generationSchema.parse({
    course: "COMP",
    title: "Test 1",
    scope: "Selected pages",
    due: "",
    level,
    count: 8,
    sources: [source],
    useAI: false,
  });
test("page ranges deduplicate, sort, and reject malformed or out-of-bounds input", () => {
  assert.deepEqual(parseRange("3, 1-2, 2", 3), [1, 2, 3]);
  for (const range of ["0", "4", "2-1", "1,", "1.5", "all"])
    assert.throws(() => parseRange(range, 3));
  assert.deepEqual(
    selectedPages(source).map((p) => p.number),
    [2],
  );
});
test("generation honors selected pages, uses actual counts and verified evidence", () => {
  const set = generateFromSources(input());
  assert.equal(set.cards.length, 3);
  assert.equal(set.questions.length, 3);
  assert.ok(set.cards.every((c) => c.citations.every((x) => x.page === 2)));
  assert.ok(!JSON.stringify(set.cards).includes("Photosynthesis"));
  verifyCitations(set);
  setSchema.parse(set);
});
test("difficulty changes the cognitive task and highest level includes transfer", () => {
  const low = generateFromSources(input(0)),
    high = generateFromSources(input(3));
  assert.ok(low.cards.every((c) => c.tag === "RECALL"));
  assert.ok(high.cards.some((c) => c.tag === "TRANSFER"));
  assert.ok(high.questions.every((q) => q.kind === "written"));
  assert.notEqual(low.cards[0].prompt, high.cards[0].prompt);
});
test("separate source roles cannot leak into the other study mode", () => {
  const data = input();
  data.sources = [
    { ...source, id: "cards", use: "cards" },
    { ...source, id: "quiz", use: "quiz" },
  ];
  const set = generateFromSources(data);
  assert.ok(
    set.cards.every((c) => c.citations.every((x) => x.sourceId === "cards")),
  );
  assert.ok(
    set.questions.every((c) => c.citations.every((x) => x.sourceId === "quiz")),
  );
  set.cards[0].citations[0].sourceId = "quiz";
  assert.throws(() => verifyCitations(set));
});
test("fabricated or excluded evidence is rejected", () => {
  const set = generateFromSources(input());
  set.cards[0].citations[0].quote = "Invented statement.";
  assert.throws(() => verifyCitations(set));
  set.cards[0].citations[0] = {
    sourceId: "s",
    page: 1,
    quote: source.pages[0].text,
  };
  assert.throws(() => verifyCitations(set));
});
test("thin material does not fabricate sets", () => {
  const data = input();
  data.sources[0] = {
    ...source,
    pages: [{ number: 1, text: "Scanned page" }],
    range: "",
  };
  assert.throws(() => generateFromSources(data));
});
test("authored demo citations and quiz indices are valid", () => {
  const set = demoSet();
  setSchema.parse(set);
  verifyCitations(set);
  assert.equal(set.questions[0].correctIndex, 2);
  assert.equal(set.questions[1].correctIndex, 0);
});
test("backups reject malformed quizzes and duplicate set IDs", () => {
  const set = demoSet();
  assert.throws(() =>
    workspaceSchema.parse({ sets: [set, set], attempts: [] }),
  );
  set.questions[0].correctIndex = 5;
  assert.throws(() => setSchema.parse(set));
});
test("review scheduling follows the latest attempt for the right mode", () => {
  const now = Date.now(),
    at = new Date(now).toISOString();
  assert.equal(isDue(), true);
  assert.equal(
    isDue(
      {
        itemId: "a",
        setId: "s",
        kind: "card",
        rating: "again",
        at,
        answer: "",
      },
      now,
    ),
    true,
  );
  assert.equal(
    isDue(
      { itemId: "a", setId: "s", kind: "card", rating: "hard", at, answer: "" },
      now + 86400000,
    ),
    true,
  );
  assert.equal(
    isDue(
      { itemId: "a", setId: "s", kind: "card", rating: "good", at, answer: "" },
      now + 86400000,
    ),
    false,
  );
  assert.equal(
    latestAttempt(
      [
        {
          itemId: "a",
          setId: "s",
          kind: "quiz",
          rating: "good",
          at,
          answer: "",
        },
      ],
      "s",
      "a",
      "card",
    ),
    undefined,
  );
});
test("URL ingestion rejects private hosts, credentials, ports and reserved IP ranges", () => {
  assert.equal(
    publicUrl("https://example.edu/chapter").hostname,
    "example.edu",
  );
  for (const url of [
    "http://example.edu",
    "https://127.0.0.1",
    "https://[::1]",
    "https://x.local",
    "https://user:pass@example.edu",
    "https://example.edu:444",
    "https://localhost",
  ])
    assert.throws(() => publicUrl(url));
  for (const ip of [
    "10.0.0.1",
    "127.0.0.1",
    "172.16.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "198.18.0.1",
    "224.0.0.1",
  ])
    assert.equal(publicIPv4(ip), false);
  assert.equal(publicIPv4("8.8.8.8"), true);
  assert.equal(publicIPv6("::1"), false);
  assert.equal(publicIPv6("2001:db8::1"), false);
});
