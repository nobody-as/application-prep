"use client";
import { useState, useEffect, useRef } from "react";
import {
  X,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Check,
  Timer,
  Layers3,
  CircleHelp,
} from "lucide-react";
import {
  type StudySet,
  type Attempt,
  type Citation,
  latestAttempt,
  isDue,
  levels,
} from "@/lib/study/model";
function Evidence({
  set,
  citations,
}: {
  set: StudySet;
  citations: Citation[];
}) {
  return (
    <details className="evidence">
      <summary>
        <BookOpen size={14} />
        Source evidence · {citations.length} reference
        {citations.length === 1 ? "" : "s"}
      </summary>
      {citations.map((c, i) => (
        <blockquote key={i}>
          <p>{c.quote}</p>
          <cite>
            {set.sources.find((s) => s.id === c.sourceId)?.title || "Source"} ·
            page {c.page}
          </cite>
        </blockquote>
      ))}
    </details>
  );
}
export default function Session({
  set,
  attempts,
  onAttempt,
  onClose,
  saving,
}: {
  set: StudySet;
  attempts: Attempt[];
  onAttempt: (a: Attempt) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const shell = useRef<HTMLDivElement>(null);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    shell.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const [tab, setTab] = useState<"cards" | "quiz" | "sources">("cards"),
    [filter, setFilter] = useState<"all" | "due" | "weak">("all");
  const [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false),
    [answer, setAnswer] = useState(""),
    [choice, setChoice] = useState<number | null>(null),
    [graded, setGraded] = useState(false),
    [checked, setChecked] = useState(false);
  const [queue, setQueue] = useState<string[]>(set.cards.map((c) => c.id)),
    [results, setResults] = useState<
      { id: string; rating: Attempt["rating"]; auto: boolean }[]
    >([]),
    [minutes, setMinutes] = useState(15),
    [endsAt, setEndsAt] = useState<number | null>(null),
    [remaining, setRemaining] = useState<number | null>(null);
  const reset = (nextTab: typeof tab, nextFilter: typeof filter) => {
    setTab(nextTab);
    setFilter(nextFilter);
    setIndex(0);
    setRevealed(false);
    setAnswer("");
    setChoice(null);
    setChecked(false);
    setGraded(false);
    setResults([]);
    setEndsAt(null);
    setRemaining(null);
    const kind = nextTab === "quiz" ? "quiz" : "card";
    const items = nextTab === "quiz" ? set.questions : set.cards;
    setQueue(
      items
        .filter((item) => {
          const a = latestAttempt(attempts, set.id, item.id, kind);
          return (
            nextFilter === "all" ||
            (nextFilter === "due" && isDue(a)) ||
            (nextFilter === "weak" && a && a.rating !== "good")
          );
        })
        .map((i) => i.id),
    );
  };
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  const expired = remaining === 0,
    done = index >= queue.length;
  const card = set.cards.find((c) => c.id === queue[index]),
    question = set.questions.find((q) => q.id === queue[index]);
  const rate = async (rating: Attempt["rating"], auto = false) => {
    const id = queue[index];
    if (!id || graded || saving) return;
    setSaveError("");
    try {
      await onAttempt({
        itemId: id,
        setId: set.id,
        kind: tab === "quiz" ? "quiz" : "card",
        rating,
        at: new Date().toISOString(),
        answer:
          tab === "quiz"
            ? question?.kind === "choice"
              ? question.options[choice ?? -1] || ""
              : answer
            : "",
      });
      setResults((r) => [...r, { id, rating, auto }]);
      setGraded(true);
      return true;
    } catch (e) {
      setSaveError((e as Error).message);
      return false;
    }
  };
  const next = () => {
    setIndex((i) => i + 1);
    setRevealed(false);
    setChecked(false);
    setGraded(false);
    setChoice(null);
    setAnswer("");
  };
  const submit = async () => {
    if (!question || checked) return;
    if (question.kind === "choice") {
      const saved = await rate(
        choice === question.correctIndex ? "good" : "again",
        true,
      );
      if (!saved) return;
    }
    setChecked(true);
  };
  const retry = () => {
    const ids = results.filter((r) => r.rating !== "good").map((r) => r.id);
    setQueue(ids);
    setIndex(0);
    setResults([]);
    setRevealed(false);
    setChecked(false);
    setGraded(false);
    setAnswer("");
    setChoice(null);
    setEndsAt(null);
    setRemaining(null);
  };
  const rubric = (items: string[]) =>
    items.length ? (
      <ul className="rubric">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    ) : null;
  const ratings = () => (
    <div className="rating-row">
      <button
        disabled={saving || graded}
        onClick={() => rate("again")}
        className="button again"
      >
        Again <small>Needs work</small>
      </button>
      <button
        disabled={saving || graded}
        onClick={() => rate("hard")}
        className="button secondary"
      >
        Hard <small>Review tomorrow</small>
      </button>
      <button
        disabled={saving || graded}
        onClick={() => rate("good")}
        className="button good"
      >
        Got it <small>Review in 3 days</small>
      </button>
    </div>
  );
  return (
    <div
      className="session-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Study ${set.title}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const nodes = shell.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary",
          );
          if (nodes?.length) {
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === shell.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === shell.current)
            ) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }}
    >
      <div className="session-shell" ref={shell} tabIndex={-1}>
        <header className="session-header">
          <div>
            <p className="eyebrow">
              {set.course} / {levels[set.level].name}
            </p>
            <h2>{set.title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close study session"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <nav className="study-tabs" aria-label="Study mode">
          <button
            className={tab === "cards" ? "active" : ""}
            onClick={() => reset("cards", "all")}
          >
            <Layers3 size={16} />
            Flashcards <span>{set.cards.length}</span>
          </button>
          <button
            className={tab === "quiz" ? "active" : ""}
            onClick={() => reset("quiz", "all")}
          >
            <CircleHelp size={16} />
            Quiz <span>{set.questions.length}</span>
          </button>
          <button
            className={tab === "sources" ? "active" : ""}
            onClick={() => reset("sources", "all")}
          >
            <BookOpen size={16} />
            Sources
          </button>
        </nav>
        <div className="session-body">
          {saveError && (
            <p className="banner error" role="alert">
              {saveError} Your answer is preserved. Retry the rating to save.
            </p>
          )}
          {tab === "sources" ? (
            <>
              {set.scope && (
                <p className="notice">Assessment scope: {set.scope}</p>
              )}
              {set.sources.map((s) => (
                <article key={s.id} className="panel source-article">
                  <h3>{s.title}</h3>
                  <p className="small muted">
                    {s.use === "both"
                      ? "Cards and quiz"
                      : s.use === "cards"
                        ? "Flashcards only"
                        : "Quiz only"}{" "}
                    · Selected pages: {s.range || "all"}
                  </p>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      Open original page
                    </a>
                  )}
                  {s.pages.map((p) => (
                    <details key={p.number}>
                      <summary>Page {p.number}</summary>
                      <pre className="source-preview">{p.text}</pre>
                    </details>
                  ))}
                </article>
              ))}
            </>
          ) : (
            <>
              <div className="row split session-controls">
                <div className="segmented" aria-label="Review filter">
                  {(["all", "due", "weak"] as const).map((f) => (
                    <button
                      className={filter === f ? "selected" : ""}
                      key={f}
                      disabled={saving}
                      onClick={() => reset(tab, f)}
                    >
                      {f === "all"
                        ? "All items"
                        : f === "due"
                          ? "Due for review"
                          : "Weak spots"}
                    </button>
                  ))}
                </div>
                {tab === "quiz" && !endsAt && !done && (
                  <div className="row timer-controls">
                    <label className="small">
                      Minutes{" "}
                      <input
                        aria-label="Quiz timer minutes"
                        type="number"
                        min={1}
                        max={180}
                        value={minutes}
                        onChange={(e) =>
                          setMinutes(
                            Math.min(
                              180,
                              Math.max(1, Number(e.target.value) || 1),
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className="button secondary small-button"
                      onClick={() => setEndsAt(Date.now() + minutes * 60000)}
                    >
                      <Timer size={14} />
                      Start timer
                    </button>
                  </div>
                )}
                {tab === "quiz" && remaining !== null && (
                  <span className={"timer " + (expired ? "error" : "")}>
                    <Timer size={16} />
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, "0")}
                    {expired ? " · Time is up" : ""}
                  </span>
                )}
              </div>
              {set.mode === "source" && (
                <p className="notice small">
                  Source-based practice. Open answers use source anchors and a
                  rubric; review is self-assessed. Fully worked AI questions
                  require a connected model.
                </p>
              )}
              {!done && (
                <div className="row split progress-line">
                  <span className="mono muted small">
                    {tab === "cards" ? "CARD" : "QUESTION"}{" "}
                    {String(index + 1).padStart(2, "0")} /{" "}
                    {String(queue.length).padStart(2, "0")}
                  </span>
                  <span className="small muted">
                    {results.filter((r) => r.rating === "good").length} secure
                    this session
                  </span>
                </div>
              )}
              {!done && (
                <div className="track">
                  <span style={{ width: `${(index / queue.length) * 100}%` }} />
                </div>
              )}
              {done ? (
                <div className="session-complete">
                  <div className="complete-icon">
                    <Check size={28} />
                  </div>
                  <p className="eyebrow">
                    {queue.length
                      ? "Session complete"
                      : "Nothing in this queue"}
                  </p>
                  <h3>
                    {queue.length
                      ? "You’ve found the gaps."
                      : "You’re clear for now."}
                  </h3>
                  <p className="muted">
                    {queue.length
                      ? `${results.filter((r) => r.rating === "good").length} secure · ${results.filter((r) => r.rating !== "good").length} to revisit`
                      : "Choose all items to keep practicing, or come back when reviews are due."}
                  </p>
                  {results.some((r) => r.auto) && (
                    <p className="small muted">
                      Auto-graded choices:{" "}
                      {
                        results.filter((r) => r.auto && r.rating === "good")
                          .length
                      }{" "}
                      / {results.filter((r) => r.auto).length}. Written answers
                      and flashcards are self-assessed.
                    </p>
                  )}
                  <div className="row center">
                    {results.some((r) => r.rating !== "good") && (
                      <button className="button primary" onClick={retry}>
                        <RotateCcw size={16} />
                        Retry weak spots
                      </button>
                    )}
                    <button
                      className="button secondary"
                      onClick={() => reset(tab, "all")}
                    >
                      Study again
                    </button>
                  </div>
                </div>
              ) : tab === "cards" && card ? (
                <article className="study-card">
                  <span
                    className={
                      "tag " + card.tag.toLowerCase().replace(" ", "-")
                    }
                  >
                    {card.tag}
                  </span>
                  <h3>{card.prompt}</h3>
                  {!revealed ? (
                    <>
                      <p className="muted small">
                        Answer from memory before revealing the source.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => setRevealed(true)}
                      >
                        Reveal answer <ArrowRight size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="answer-block">
                        <p className="eyebrow">
                          {set.mode === "source"
                            ? "Source anchor"
                            : "Model answer"}
                        </p>
                        <p>{card.answer}</p>
                        {rubric(card.rubric)}
                      </div>
                      <Evidence set={set} citations={card.citations} />
                      <p className="small muted">
                        Rate your recall honestly. These ratings are
                        self-assessed.
                      </p>
                      {ratings()}
                      {graded && (
                        <button
                          className="button primary next-button"
                          onClick={next}
                        >
                          Next card <ArrowRight size={16} />
                        </button>
                      )}
                    </>
                  )}
                </article>
              ) : tab === "quiz" && question ? (
                <article className="study-card">
                  <div className="row split">
                    <span
                      className={
                        "tag " + question.tag.toLowerCase().replace(" ", "-")
                      }
                    >
                      {question.tag}
                    </span>
                    <span className="small muted">
                      {question.kind === "choice"
                        ? "Multiple choice"
                        : "Written · self-assessed"}
                    </span>
                  </div>
                  <h3>{question.prompt}</h3>
                  {expired && !checked ? (
                    <>
                      <p className="error">
                        Time is up. Your current answer is preserved.
                      </p>
                      <button
                        className="button secondary"
                        onClick={() => {
                          setEndsAt(null);
                          setRemaining(null);
                        }}
                      >
                        Continue untimed
                      </button>
                    </>
                  ) : null}
                  {question.kind === "choice" ? (
                    <div className="quiz-options">
                      {question.options.map((option, i) => (
                        <button
                          key={i}
                          disabled={checked || saving || expired}
                          aria-pressed={choice === i}
                          className={
                            "quiz-option " +
                            (choice === i ? "chosen " : "") +
                            (checked && i === question.correctIndex
                              ? "correct "
                              : "") +
                            (checked &&
                            choice === i &&
                            i !== question.correctIndex
                              ? "incorrect"
                              : "")
                          }
                          onClick={() => setChoice(i)}
                        >
                          <span>{String.fromCharCode(65 + i)}</span>
                          {option}
                          {checked && i === question.correctIndex && (
                            <Check size={16} />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <label className="field">
                      Your reasoning
                      <textarea
                        rows={6}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        disabled={checked || expired}
                        maxLength={10000}
                        placeholder="Make the claim, justify it, and deal with the edge case."
                      />
                    </label>
                  )}
                  {!checked && (
                    <button
                      className="button primary"
                      disabled={
                        saving ||
                        expired ||
                        (question.kind === "choice"
                          ? choice === null
                          : !answer.trim())
                      }
                      onClick={submit}
                    >
                      Submit answer <ArrowRight size={16} />
                    </button>
                  )}
                  {checked && (
                    <>
                      <div className="answer-block">
                        <p className="eyebrow">
                          {question.kind === "choice"
                            ? choice === question.correctIndex
                              ? "Correct"
                              : "Revisit this concept"
                            : set.mode === "source"
                              ? "Source anchor & review"
                              : "Model answer & review"}
                        </p>
                        <p>{question.answer}</p>
                        <p className="small">{question.explanation}</p>
                        {rubric(question.rubric)}
                      </div>
                      <Evidence set={set} citations={question.citations} />
                      {question.kind === "written" && !graded && (
                        <>
                          <p className="small muted">
                            Compare your reasoning with the rubric, then rate
                            it. This is self-assessment.
                          </p>
                          {ratings()}
                        </>
                      )}
                      {graded && (
                        <button
                          className="button primary next-button"
                          disabled={saving}
                          onClick={next}
                        >
                          Next question <ArrowRight size={16} />
                        </button>
                      )}
                    </>
                  )}
                </article>
              ) : null}
            </>
          )}
        </div>
        <footer className="session-footer">
          <span className="small muted">
            {saving
              ? "Saving progress…"
              : "Progress records each completed review."}
          </span>
          <button className="text-button" onClick={onClose}>
            Back to workspace
          </button>
        </footer>
      </div>
    </div>
  );
}
