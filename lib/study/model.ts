import { z } from "zod";
export const levels = [
  { name: "Recall", note: "Precise definitions & facts" },
  { name: "Connect", note: "Relationships & reasoning" },
  { name: "Pressure test", note: "Assumptions & exceptions" },
  { name: "Cross-examine", note: "Counterexamples & transfer" },
] as const;
export const pageSchema = z.object({
  number: z.number().int().min(1),
  text: z.string(),
});
export const sourceSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1),
  pages: z.array(pageSchema).min(1),
  range: z.string(),
  use: z.enum(["both", "cards", "quiz"]),
  url: z.string().max(2000).optional(),
});
export const citationSchema = z.object({
  sourceId: z.string(),
  page: z.number().int().min(1),
  quote: z.string().min(1).max(1200),
});
export const cardSchema = z.object({
  id: z.string(),
  tag: z.enum(["RECALL", "CONCEPT", "EDGE CASE", "TRANSFER"]),
  prompt: z.string().min(1).max(2000),
  answer: z.string().min(1).max(5000),
  rubric: z.array(z.string().max(1000)).max(8),
  citations: z.array(citationSchema).min(1).max(8),
});
export const questionSchema = z
  .object({
    id: z.string(),
    tag: z.enum(["RECALL", "CONCEPT", "EDGE CASE", "TRANSFER"]),
    kind: z.enum(["choice", "written"]),
    prompt: z.string().min(1).max(2000),
    options: z.array(z.string().max(1000)).max(6),
    correctIndex: z.number().int().min(-1).max(5),
    answer: z.string().min(1).max(5000),
    explanation: z.string().max(5000),
    rubric: z.array(z.string().max(1000)).max(8),
    citations: z.array(citationSchema).min(1).max(8),
  })
  .superRefine((q, ctx) => {
    if (
      q.kind === "choice" &&
      (q.options.length < 2 ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.options.length ||
        new Set(q.options).size !== q.options.length)
    )
      ctx.addIssue({ code: "custom", message: "Invalid choice question" });
    if (q.kind === "written" && (q.options.length || q.correctIndex !== -1))
      ctx.addIssue({ code: "custom", message: "Invalid written question" });
  });
export const setSchema = z.object({
  id: z.string(),
  course: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  scope: z.string().max(2000),
  due: z.string().max(20),
  level: z.number().int().min(0).max(3),
  createdAt: z.string(),
  mode: z.enum(["source", "ai", "demo"]),
  sources: z.array(sourceSchema),
  cards: z.array(cardSchema).max(100),
  questions: z.array(questionSchema).max(100),
});
export const attemptSchema = z.object({
  itemId: z.string(),
  setId: z.string(),
  kind: z.enum(["card", "quiz"]),
  rating: z.enum(["again", "hard", "good"]),
  at: z.string(),
  answer: z.string().max(10000),
});
export const workspaceSchema = z
  .object({
    sets: z.array(setSchema).max(100),
    attempts: z.array(attemptSchema).max(10000),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.sets.map((s) => s.id)).size !== v.sets.length)
      ctx.addIssue({ code: "custom", message: "Duplicate set IDs" });
  });
export const generationSchema = z.object({
  course: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  scope: z.string().max(2000),
  due: z.string().max(20),
  level: z.number().int().min(0).max(3),
  count: z.number().int().min(4).max(40),
  sources: z.array(sourceSchema).min(1),
  useAI: z.boolean().default(false),
});
export type Source = z.infer<typeof sourceSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Question = z.infer<typeof questionSchema>;
export type StudySet = z.infer<typeof setSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type GenerationInput = z.infer<typeof generationSchema>;
export const emptyWorkspace = (): Workspace => ({ sets: [], attempts: [] });

export function parseRange(range: string, max: number): number[] {
  if (!range.trim()) return Array.from({ length: max }, (_, i) => i + 1);
  const pages = new Set<number>();
  for (const part of range.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error("Use page numbers such as 1-5, 8, 12-14.");
    const a = Number(m[1]),
      b = Number(m[2] || m[1]);
    if (a < 1 || b < a || b > max)
      throw new Error(`Page range must stay between 1 and ${max}.`);
    for (let n = a; n <= b; n++) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}
export function selectedPages(s: Source) {
  if (!s.range.trim()) return s.pages.filter((p) => p.text.trim());
  const allowed = new Set(
    parseRange(s.range, Math.max(...s.pages.map((p) => p.number))),
  );
  return s.pages.filter((p) => allowed.has(p.number) && p.text.trim());
}
export function normalize(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
export function verifyCitations(set: StudySet) {
  const sourceMap = new Map(set.sources.map((s) => [s.id, s]));
  for (const item of [...set.cards, ...set.questions])
    for (const c of item.citations) {
      const source = sourceMap.get(c.sourceId);
      const page =
        source && selectedPages(source).find((p) => p.number === c.page);
      if (!page || !normalize(page.text).includes(normalize(c.quote)))
        throw new Error(
          "Generated evidence could not be verified against the selected pages. Try again with clearer source text.",
        );
    }
  for (const card of set.cards)
    if (card.citations.some((c) => sourceMap.get(c.sourceId)?.use === "quiz"))
      throw new Error("Flashcard uses quiz-only material.");
  for (const q of set.questions)
    if (q.citations.some((c) => sourceMap.get(c.sourceId)?.use === "cards"))
      throw new Error("Quiz uses flashcard-only material.");
  return set;
}
export function latestAttempt(
  attempts: Attempt[],
  setId: string,
  itemId: string,
  kind: Attempt["kind"],
) {
  return attempts
    .filter((a) => a.setId === setId && a.itemId === itemId && a.kind === kind)
    .at(-1);
}
export function isDue(a?: Attempt, now = Date.now()) {
  if (!a || a.rating === "again") return true;
  const days = a.rating === "hard" ? 1 : 3;
  return Date.parse(a.at) + days * 86400000 <= now;
}
