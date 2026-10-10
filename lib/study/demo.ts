import type { StudySet, Source, Citation } from "./model";
export function demoSet(): StudySet {
  const source: Source = {
    id: "demo-source",
    title: "Critical thinking · demonstration notes",
    range: "",
    use: "both",
    pages: [
      {
        number: 1,
        text: "An argument is a set of statements in which some statements, called premises, are offered as reasons to accept another statement, called the conclusion. An explanation attempts to show why an accepted event occurred, while an argument attempts to establish that a claim is true. Indicator words such as because and therefore are clues to argumentative structure, but context determines their role.",
      },
      {
        number: 2,
        text: "A deductive argument is valid when it is impossible for all its premises to be true and its conclusion false. Validity concerns the relation between premises and conclusion, rather than the actual truth of the premises. A deductive argument is sound when it is valid and all of its premises are true. In a linked argument, premises work together to support a conclusion. In a convergent argument, premises offer independent support.",
      },
    ],
  };
  const cite = (page: number, quote: string): Citation[] => [
    { sourceId: source.id, page, quote },
  ];
  const validity = cite(
    2,
    "Validity concerns the relation between premises and conclusion, rather than the actual truth of the premises.",
  );
  const explanation = cite(
    1,
    "An explanation attempts to show why an accepted event occurred, while an argument attempts to establish that a claim is true.",
  );
  const sound = cite(
    2,
    "A deductive argument is sound when it is valid and all of its premises are true.",
  );
  return {
    id: crypto.randomUUID(),
    course: "PHIL 1290 · Demo",
    title: "Arguments, explanations & validity",
    scope: "Identify arguments and test conceptual boundaries.",
    due: "",
    level: 3,
    createdAt: new Date().toISOString(),
    mode: "demo",
    sources: [source],
    cards: [
      {
        id: "demo-c1",
        tag: "EDGE CASE",
        prompt:
          "Can an argument have false premises and a true conclusion, yet still be valid? Defend your answer.",
        answer:
          "Yes. Validity asks whether true premises would force a true conclusion. Actual premise truth does not determine validity. Example: all cats are reptiles; all reptiles are mammals; therefore all cats are mammals. The form is valid, the premises are false, and the conclusion is true.",
        rubric: [
          "Distinguish logical form from actual truth.",
          "Give a valid form rather than merely a true conclusion.",
        ],
        citations: validity,
      },
      {
        id: "demo-c2",
        tag: "CONCEPT",
        prompt:
          "“The street is wet because it rained.” Is this necessarily an argument?",
        answer:
          "No. If street wetness is already accepted, rainfall can explain it. If the speaker uses rainfall as evidence to establish wetness, it functions as an argument. “Because” alone does not settle the classification.",
        rubric: [
          "Identify what the speaker is trying to establish.",
          "Explain why context matters.",
        ],
        citations: explanation,
      },
      {
        id: "demo-c3",
        tag: "TRANSFER",
        prompt:
          "A valid argument uses a premise that nobody has checked. What can you conclude about soundness?",
        answer:
          "Its soundness is not established. Unverified is not the same as false. It is sound only if all premises are actually true, but validity alone cannot establish that.",
        rubric: [
          "Avoid treating uncertainty as falsity.",
          "State both requirements for soundness.",
        ],
        citations: sound,
      },
    ],
    questions: [
      {
        id: "demo-q1",
        tag: "EDGE CASE",
        kind: "choice",
        prompt:
          "Every premise is true, and the conclusion is true. Which claim is justified?",
        options: [
          "The argument must be valid.",
          "The argument must be sound.",
          "Its validity cannot be determined from truth values alone.",
          "It must be invalid.",
        ],
        correctIndex: 2,
        answer: "Its validity cannot be determined from truth values alone.",
        explanation:
          "A true conclusion can occur even when it does not follow from the premises. Validity requires that true premises and a false conclusion be impossible in the argument’s form. Soundness also requires validity.",
        rubric: [],
        citations: validity,
      },
      {
        id: "demo-q2",
        tag: "CONCEPT",
        kind: "choice",
        prompt:
          "Someone accepts that the server crashed and asks why. “It crashed because it ran out of memory.” In that context, this is primarily:",
        options: [
          "An explanation.",
          "A deductive proof that the crash occurred.",
          "A conclusion indicator.",
          "A necessarily sound argument.",
        ],
        correctIndex: 0,
        answer: "An explanation.",
        explanation:
          "The crash is accepted. The speaker explains its cause rather than establishing that it occurred. This does not establish deductive validity or soundness.",
        rubric: [],
        citations: explanation,
      },
      {
        id: "demo-q3",
        tag: "TRANSFER",
        kind: "written",
        prompt:
          "Construct a valid but unsound argument with a true conclusion. Explain why the true conclusion does not make it sound.",
        options: [],
        correctIndex: -1,
        answer:
          "All cats are reptiles. All reptiles are mammals. Therefore all cats are mammals. The categorical form is valid, and the conclusion is true, but the premises are false. Soundness requires both validity and true premises.",
        explanation:
          "A good answer separates the form, the actual truth of each premise, and the conclusion. Any correct example meeting all three conditions earns full credit.",
        rubric: [
          "The conclusion follows deductively from the premises.",
          "At least one premise is actually false.",
          "The conclusion is actually true.",
          "Explain why validity plus a true conclusion is insufficient for soundness.",
        ],
        citations: sound,
      },
    ],
  };
}
