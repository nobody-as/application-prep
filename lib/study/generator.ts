import {
  type GenerationInput,
  type Citation,
  type Card,
  type Question,
  type StudySet,
  selectedPages,
  normalize,
  verifyCitations,
} from "./model";
const stops = new Set(
  "a an the and or is are was were be been being in on at of to for from with without that this these those it its as by can could should would will may might have has had not than then when where which who what how why also into through each any all some more most only their there they you your we our if but so does do such".split(
    " ",
  ),
);
export function concepts(text: string) {
  return [
    ...new Set(
      (text.match(/[A-Za-z][A-Za-z-]{4,}/g) || [])
        .map((x) => x.toLowerCase())
        .filter((w) => !stops.has(w)),
    ),
  ];
}
function claims(input: GenerationInput, kind: "cards" | "quiz") {
  const result: { citation: Citation; topic: string }[] = [];
  const seen = new Set<string>();
  // Round-robin pages prevents early chapters monopolizing a set.
  const buckets = input.sources
    .filter((s) => s.use === "both" || s.use === kind)
    .flatMap((s) =>
      selectedPages(s).map((p) => {
        const units = normalize(p.text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
        return units
          .map((t) => normalize(t))
          .filter(
            (t) => t.length >= 45 && t.length <= 900 && concepts(t).length >= 2,
          )
          .map((t) => ({
            citation: { sourceId: s.id, page: p.number, quote: t },
            topic: concepts(t).slice(0, 3).join(" / "),
          }));
      }),
    );
  const max = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < max; i++)
    for (const bucket of buckets)
      if (bucket[i] && !seen.has(bucket[i].citation.quote)) {
        seen.add(bucket[i].citation.quote);
        result.push(bucket[i]);
      }
  return result;
}
function reasoning(quote: string, level: number, i: number) {
  const variants = [
    {
      tag: "CONCEPT" as const,
      prompt: `Explain the relationship in this claim in your own words. What does it establish, and what does it leave unstated?\n\n“${quote}”`,
      rubric: [
        "Preserve the exact relationship and qualifiers in the claim.",
        "Explain the connection rather than simply repeating the words.",
        "Separate what the text establishes from your own inference.",
      ],
    },
    {
      tag: "EDGE CASE" as const,
      prompt: `Pressure-test this claim: identify its scope or an unstated assumption, then construct a boundary case. Does the case actually refute it?\n\n“${quote}”`,
      rubric: [
        "Name the scope or assumption and state whether it is explicit or inferred.",
        "Construct a concrete boundary case and explain the mechanism.",
        "Decide whether it is a counterexample or outside the claim’s scope.",
      ],
    },
    {
      tag: "TRANSFER" as const,
      prompt: `Apply this claim in a new situation. Change one important condition, predict what changes, and defend what still holds.\n\n“${quote}”`,
      rubric: [
        "Use a concrete example beyond the source.",
        "Identify the changed condition and its consequences.",
        "Defend the conclusion using the source; label unsupported extensions.",
      ],
    },
  ];
  return variants[level === 1 ? 0 : level === 2 ? i % 2 : i % 3];
}
export function generateFromSources(input: GenerationInput): StudySet {
  const forCards = claims(input, "cards"),
    forQuiz = claims(input, "quiz");
  if (!forCards.length && !forQuiz.length)
    throw new Error(
      "The selected pages need readable sentences. Check extraction, or paste the text of scanned pages.",
    );
  const cards: Card[] = forCards.slice(0, input.count).map((c, i) => {
    const prompt =
      input.level === 0
        ? `What does the source say about ${c.topic}? State its claim precisely, including any qualifications.`
        : reasoning(c.citation.quote, input.level, i).prompt;
    const r =
      input.level === 0
        ? [
            "Recover the main claim accurately.",
            "Include its qualifications and conditions.",
          ]
        : reasoning(c.citation.quote, input.level, i).rubric;
    return {
      id: crypto.randomUUID(),
      tag:
        input.level === 0
          ? "RECALL"
          : reasoning(c.citation.quote, input.level, i).tag,
      prompt,
      answer: c.citation.quote,
      rubric: r,
      citations: [c.citation],
    };
  });
  const questions: Question[] = forQuiz.slice(0, input.count).map((c, i) => {
    if (input.level === 0) {
      const terms = concepts(c.citation.quote);
      const term = terms.reduce(
        (a, b) => (a.length > b.length ? a : b),
        terms[0],
      );
      const candidates = [
        ...new Set(forQuiz.flatMap((x) => concepts(x.citation.quote))),
      ].filter(
        (w) =>
          w !== term && !new RegExp(`\\b${w}\\b`, "i").test(c.citation.quote),
      );
      if (candidates.length >= 3) {
        const options = [
          term,
          ...candidates
            .slice(i % Math.max(1, candidates.length - 2))
            .slice(0, 3),
        ];
        if (options.length === 4) {
          const correctIndex = i % 4;
          [options[0], options[correctIndex]] = [
            options[correctIndex],
            options[0],
          ];
          return {
            id: crypto.randomUUID(),
            tag: "RECALL",
            kind: "choice",
            prompt: `Which term completes the source statement?\n\n${c.citation.quote.replace(new RegExp(`\\b${term}\\b`, "gi"), "_____")}`,
            options,
            correctIndex,
            answer: term,
            explanation: c.citation.quote,
            rubric: [],
            citations: [c.citation],
          };
        }
      }
    }
    const r = reasoning(c.citation.quote, Math.max(1, input.level), i);
    return {
      id: crypto.randomUUID(),
      tag: input.level === 0 ? "RECALL" : r.tag,
      kind: "written",
      prompt:
        input.level === 0
          ? `Reconstruct the source’s claim about ${c.topic}, including qualifications.`
          : r.prompt,
      options: [],
      correctIndex: -1,
      answer: c.citation.quote,
      explanation:
        "This is a source anchor, not a worked solution. Use the rubric to assess your reasoning. The source may not settle every extension.",
      rubric: r.rubric,
      citations: [c.citation],
    };
  });
  return verifyCitations({
    id: crypto.randomUUID(),
    course: input.course,
    title: input.title,
    scope: input.scope,
    due: input.due,
    level: input.level,
    createdAt: new Date().toISOString(),
    mode: "source",
    sources: input.sources,
    cards,
    questions,
  });
}
