"use client";
import { useState, useEffect, useRef } from "react";
import {
  Brain,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Target,
  BookOpen,
  Layers3,
  CircleHelp,
  Check,
  Search,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  ChevronDown,
  Sparkles,
  Clock,
} from "lucide-react";
import SourcePanel from "./source-panel";
import Session from "./session";
import {
  levels,
  type Source,
  type Workspace,
  type StudySet,
  type Attempt,
  type GenerationInput,
  emptyWorkspace,
  workspaceSchema,
  generationSchema,
  selectedPages,
  latestAttempt,
  isDue,
} from "@/lib/study/model";
import { generateFromSources } from "@/lib/study/generator";
import { demoSet } from "@/lib/study/demo";
const DRAFT_KEY = "application-prep-recovery-v1";
export default function WorkspaceApp() {
  const [view, setView] = useState<"create" | "library" | "progress">("create"),
    [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [unsaved, setUnsaved] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [course, setCourse] = useState(""),
    [title, setTitle] = useState(""),
    [scope, setScope] = useState(""),
    [due, setDue] = useState(""),
    [level, setLevel] = useState(3),
    [count, setCount] = useState(12),
    [sources, setSources] = useState<Source[]>([]),
    [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState(""),
    [courseFilter, setCourseFilter] = useState("all"),
    [activeSet, setActiveSet] = useState<StudySet | null>(null);
  const stateRef = useRef(workspace),
    lock = useRef(false),
    importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    stateRef.current = workspace;
  }, [workspace]);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const saved = localStorage.getItem(DRAFT_KEY + ":local");
      const ws = saved ? workspaceSchema.parse(JSON.parse(saved)) : emptyWorkspace();
      stateRef.current = ws;
      setWorkspace(ws);
      setReady(true);
      setUnsaved(false);
    } catch {
      setError("Saved data could not be read. Export your current work before clearing browser storage.");
      setReady(false);
    } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  const persist = async (ws: Workspace) => {
    if (!ready) throw new Error("Load your workspace before saving.");
    if (lock.current) throw new Error("A save is already in progress.");
    lock.current = true;
    setSaving(true);
    stateRef.current = ws;
    setWorkspace(ws);
    setUnsaved(true);
    try {
      localStorage.setItem(DRAFT_KEY + ":local", JSON.stringify(ws));
      setUnsaved(false);
    } catch {
      const message = "Browser storage is full or unavailable. Export your workspace to protect your work.";
      setError(message);
      throw new Error(message);
    } finally { lock.current = false; setSaving(false); }
  };
  const input = (): GenerationInput =>
    generationSchema.parse({
      course,
      title,
      scope,
      due,
      level,
      count,
      sources,
      useAI: false,
    });
  const create = async () => {
    setError("");
    setNotice("");
    setGenerating(true);
    try {
      const data = input();
      const hasMaterial = data.sources.some((source) =>
        selectedPages(source).some((page) => page.text.trim().length >= 30),
      );
      if (!hasMaterial)
        throw new Error("Select readable study material before generating.");
      const set = generateFromSources(data);
      await persist({
        ...stateRef.current,
        sets: [set, ...stateRef.current.sets],
      });
      setActiveSet(set);
      setView("library");
      setNotice(
        `${set.cards.length} flashcards and ${set.questions.length} questions created. ${set.mode === "source" ? "Source-based exercises use self-assessment for written reasoning." : ""}`,
      );
    } catch (e) {
      setError(
        (e as Error).message.includes("[")
          ? "Add a course, assessment title, and at least one source."
          : (e as Error).message,
      );
    } finally {
      setGenerating(false);
    }
  };
  const demo = async () => {
    setError("");
    const set = demoSet();
    try {
      await persist({
        ...stateRef.current,
        sets: [set, ...stateRef.current.sets],
      });
      setActiveSet(set);
    } catch {}
  };
  const record = async (a: Attempt) => {
    await persist({
      ...stateRef.current,
      attempts: [...stateRef.current.attempts, a].slice(-10000),
    });
  };
  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ version: 1, workspace: stateRef.current }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `application-prep-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const data = JSON.parse(await file.text());
      const incoming = workspaceSchema.parse(data.workspace || data);
      const existing = stateRef.current;
      const ids = new Set(existing.sets.map((s) => s.id));
      const sets = [
        ...incoming.sets.filter((s) => !ids.has(s.id)),
        ...existing.sets,
      ];
      const merged = [...existing.attempts, ...incoming.attempts];
      const seen = new Set<string>();
      const attempts = merged
        .filter((a) => {
          const key = JSON.stringify(a);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      await persist(workspaceSchema.parse({ sets, attempts }));
      setNotice("Backup imported. Existing sets were retained.");
      setView("library");
    } catch (e) {
      setError(
        (e as Error).name === "ZodError"
          ? "This file is not a valid application-prep backup."
          : (e as Error).message,
      );
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };
  const remove = async (set: StudySet) => {
    if (!window.confirm(`Delete “${set.title}” and its saved reviews?`)) return;
    try {
      await persist({
        sets: stateRef.current.sets.filter((s) => s.id !== set.id),
        attempts: stateRef.current.attempts.filter((a) => a.setId !== set.id),
      });
    } catch {}
  };
  const filtered = workspace.sets.filter(
    (s) =>
      (courseFilter === "all" || s.course === courseFilter) &&
      `${s.course} ${s.title}`.toLowerCase().includes(query.toLowerCase()),
  );
  const stat = (s: StudySet) => {
    const items = [
      ...s.cards.map((c) => ({ id: c.id, kind: "card" as const })),
      ...s.questions.map((q) => ({ id: q.id, kind: "quiz" as const })),
    ];
    const current = items.map((i) =>
      latestAttempt(workspace.attempts, s.id, i.id, i.kind),
    );
    return {
      total: items.length,
      secure: current.filter((a) => a?.rating === "good").length,
      due: current.filter((a) => isDue(a)).length,
      weak: current.filter((a) => a && a.rating !== "good").length,
      reviewed: current.filter(Boolean).length,
    };
  };
  const totals = workspace.sets.reduce(
    (a, s) => {
      const b = stat(s);
      return {
        total: a.total + b.total,
        secure: a.secure + b.secure,
        due: a.due + b.due,
        weak: a.weak + b.weak,
      };
    },
    { total: 0, secure: 0, due: 0, weak: 0 },
  );
  const blocked = loading || saving || generating || sourceBusy || !ready;
  return (
    <main>
      <header className="app-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setView("create");
            }}
          >
            <span className="brand-mark">
              <Brain size={21} />
            </span>
            <span>application-prep</span>
          </a>
          <nav aria-label="Workspace navigation">
            {(["create", "library", "progress"] as const).map((v) => (
              <button
                className={view === v ? "active" : ""}
                key={v}
                onClick={() => setView(v)}
              >
                {v === "create"
                  ? "Create"
                  : v === "library"
                    ? "Library"
                    : "Progress"}
              </button>
            ))}
          </nav>
          <div className="connection">
            <span
              className={
                "status-dot " +
                (unsaved ? "pending" : ready ? "online" : "")
              }
            />
            <span>
              {loading
                ? "Connecting…"
                : saving
                  ? "Saving…"
                  : unsaved
                    ? "Unsaved changes"
                    : "Saved on this device"}
            </span>

          </div>
        </div>
      </header>
      <div className="workspace-layout">
        <section className="main-column">
          {error && (
            <div className="banner error" role="alert">
              <span>{error}</span>
              <div className="row">
                {unsaved && (
                  <button className="text-button" onClick={exportData}>
                    Export unsaved work
                  </button>
                )}
                {!ready && (
                  <button className="text-button" onClick={load}>
                    Retry loading
                  </button>
                )}
                <button className="text-button" onClick={() => setError("")}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {notice && (
            <div className="banner" role="status">
              <span>{notice}</span>
              <button className="text-button" onClick={() => setNotice("")}>
                Dismiss
              </button>
            </div>
          )}
          {view === "create" ? (
            <>
              <div className="hero">
                <p className="eyebrow">Assessment workspace / 01</p>
                <h1>
                  Learn the edges,
                  <br />
                  <span>not just the middle.</span>
                </h1>
                <p>
                  One place for every reading, every concept, and every
                  assessment. Build a study set, retrieve from memory, and find
                  the gaps before exam day.
                </p>
                <div className="row hero-meta">
                  <span>
                    <BookOpen size={14} />
                    Source-grounded
                  </span>
                  <span>
                    <Target size={14} />
                    Depth over trivia
                  </span>
                  <span>
                    <Layers3 size={14} />
                    Across your devices
                  </span>
                </div>
              </div>
              <section className="assessment-fields">
                <label className="field">
                  Course
                  <input
                    value={course}
                    maxLength={100}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="COURSE 101"
                    disabled={blocked}
                  />
                </label>
                <label className="field">
                  Assessment
                  <input
                    value={title}
                    maxLength={200}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Test 1 · Chapter 1"
                    disabled={blocked}
                  />
                </label>
                <label className="field date-field">
                  Assessment date <span className="muted">optional</span>
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                    disabled={blocked}
                  />
                </label>
                <label className="field scope-field">
                  What is in scope? <span className="muted">optional</span>
                  <textarea
                    value={scope}
                    maxLength={2000}
                    onChange={(e) => setScope(e.target.value)}
                    rows={2}
                    placeholder="Learning outcomes, topics, question types, and exclusions. AI uses this to focus the set; source-based mode follows the selected pages."
                    disabled={blocked}
                  />
                </label>
              </section>
              <SourcePanel
                sources={sources}
                onChange={setSources}
                onBusy={setSourceBusy}
                disabled={blocked}
              />
              <section className="panel challenge-panel">
                <div className="panel-head">
                  <span>
                    <Target size={16} />
                    Challenge level
                  </span>
                  <span className="muted mono">02 / 02</span>
                </div>
                <div className="panel-body">
                  <div className="row split">
                    <p className="small muted">
                      Maximum depth is the default. Choose a lower level to
                      build the foundations.
                    </p>
                    <Target size={18} className="coral" />
                  </div>
                  <div className="difficulty-grid">
                    {levels.map((l, i) => (
                      <button
                        key={l.name}
                        disabled={blocked}
                        className={
                          "difficulty " + (level === i ? "selected" : "")
                        }
                        aria-pressed={level === i}
                        onClick={() => setLevel(i)}
                      >
                        <div className="row split">
                          <span className="mono">0{i + 1}</span>
                          {level === i && <Check size={14} />}
                        </div>
                        <strong>{l.name}</strong>
                        <small>{l.note}</small>
                      </button>
                    ))}
                  </div>
                  <div className="generation-controls">
                    <label className="field">
                      Items per mode
                      <select
                        value={count}
                        disabled={blocked}
                        onChange={(e) => setCount(Number(e.target.value))}
                      >
                        {[8, 12, 20, 30, 40].map((n) => (
                          <option key={n} value={n}>
                            {n} cards + {n} questions
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="field">Generation<span className="small muted">Source-based exercises</span></div>
                  </div>
                  <p className="small muted">Creates retrieval cards and reasoning prompts from your exact text. Written reasoning is self-assessed against a rubric. AI generation is not connected.</p>
                </div>
                <div className="panel-foot">
                  <p className="small muted">
                    Use the source settings to give flashcards and quizzes their
                    own page selections.
                  </p>
                  <button
                    className="button primary"
                    disabled={
                      blocked ||
                      !course.trim() ||
                      !title.trim() ||
                      !sources.length
                    }
                    onClick={create}
                  >
                    <Sparkles size={16} />
                    {generating
                      ? "Creating your set…"
                      : saving
                        ? "Saving…"
                        : "Generate study set"}
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </section>
              <div className="demo-strip">
                <div>
                  <p className="eyebrow">Try the complete flow</p>
                  <h3>What happens when the obvious answer is wrong?</h3>
                  <p className="small muted">
                    A short critical-thinking demo with worked edge cases.
                  </p>
                </div>
                <button
                  className="button secondary"
                  disabled={blocked}
                  onClick={demo}
                >
                  Open demo <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="section-heading">
                <p className="eyebrow">
                  Your workspace / {view === "library" ? "02" : "03"}
                </p>
                <div className="row split">
                  <h1>
                    {view === "library"
                      ? "Your study library."
                      : "Know where you stand."}
                  </h1>
                  <button
                    className="button primary"
                    onClick={() => setView("create")}
                  >
                    <Plus size={16} />
                    New set
                  </button>
                </div>
                <p className="muted">
                  {view === "library"
                    ? "Every source and assessment, ready when you are."
                    : "Confidence comes from retrieval. Track what is secure and what needs another pass."}
                </p>
              </div>
              <div className="stats-grid">
                <div>
                  <span className="eyebrow">Study sets</span>
                  <strong>{workspace.sets.length}</strong>
                </div>
                <div>
                  <span className="eyebrow">Secure items</span>
                  <strong>
                    {totals.secure}
                    <small> / {totals.total}</small>
                  </strong>
                </div>
                <div>
                  <span className="eyebrow">Due for review</span>
                  <strong>{totals.due}</strong>
                </div>
                <div>
                  <span className="eyebrow">Weak spots</span>
                  <strong className="coral">{totals.weak}</strong>
                </div>
              </div>
              <div className="library-tools">
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Search study sets"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search courses and assessments"
                  />
                </label>
                <select
                  aria-label="Filter by course"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                >
                  <option value="all">All courses</option>
                  {[...new Set(workspace.sets.map((s) => s.course))]
                    .sort()
                    .map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                </select>
              </div>
              {!filtered.length ? (
                <div className="empty-state">
                  <Layers3 size={32} />
                  <h3>
                    {workspace.sets.length
                      ? "No matching sets."
                      : "Your next assessment starts here."}
                  </h3>
                  <p className="muted">
                    {workspace.sets.length
                      ? "Try another search or course filter."
                      : "Add readings, choose the depth, and create your first set."}
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => setView("create")}
                  >
                    Create a study set <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="sets-list">
                  {filtered.map((s) => {
                    const t = stat(s);
                    return (
                      <article className="set-row" key={s.id}>
                        <div className="row split">
                          <span className="eyebrow">{s.course}</span>
                          <span className="mode-label">
                            {s.mode === "ai"
                              ? "AI-generated"
                              : s.mode === "demo"
                                ? "Demo · worked answers"
                                : "Source-based"}
                          </span>
                        </div>
                        <h3>{s.title}</h3>
                        <p className="small muted">
                          {s.cards.length} cards · {s.questions.length}{" "}
                          questions · {levels[s.level].name}
                          {s.due ? ` · Assessment ${s.due}` : ""}
                        </p>
                        {view === "progress" && (
                          <>
                            <div className="track">
                              <span
                                style={{
                                  width: `${t.total ? (t.secure / t.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <p className="small muted">
                              {t.secure} secure · {t.reviewed} reviewed ·{" "}
                              {t.weak} weak · {t.due} due
                            </p>
                          </>
                        )}
                        <div className="row split">
                          <div className="row">
                            <button
                              className="button secondary small-button"
                              onClick={() => setActiveSet(s)}
                            >
                              Study set <ArrowRight size={14} />
                            </button>
                            <span className="small muted">{t.due} due</span>
                          </div>
                          <button
                            className="icon-button"
                            disabled={blocked}
                            onClick={() => remove(s)}
                            aria-label={`Delete ${s.title}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {view === "progress" && (
                <p className="notice small">
                  “Secure” means the latest rating was Got it. Flashcards and
                  written answers are self-assessed; multiple-choice answers are
                  auto-graded. Ratings schedule review after 1 or 3 days and do
                  not guarantee exam readiness.
                </p>
              )}
              <div className="backup-bar">
                <button className="text-button" onClick={exportData}>
                  <Download size={15} />
                  Export workspace
                </button>
                <button
                  className="text-button"
                  disabled={blocked}
                  onClick={() => importInput.current?.click()}
                >
                  <Upload size={15} />
                  Import backup
                </button>
                {unsaved && (
                  <button
                    className="text-button"
                    disabled={saving}
                    onClick={() => {
                      void persist(stateRef.current).catch(() => {});
                    }}
                  >
                    <Layers3 size={15} />
                    Retry save
                  </button>
                )}
                <input
                  ref={importInput}
                  type="file"
                  accept=".json"
                  hidden
                  onChange={(e) => void importData(e.target.files?.[0])}
                />
              </div>
            </>
          )}
        </section>
        <aside className="method-sidebar">
          <div className="sticky">
            <p className="eyebrow muted">The method</p>
            <h2>
              Built for the moment
              <br />
              you think you know it.
            </h2>
            <div className="method-steps">
              {[
                {
                  icon: BookOpen,
                  title: "Compile",
                  body: "Bring the chapters, notes, and readings for one assessment together.",
                },
                {
                  icon: Brain,
                  title: "Stress-test",
                  body: "Move from precise recall to assumptions, boundaries, and unfamiliar cases.",
                },
                {
                  icon: Target,
                  title: "Retrieve",
                  body: "Answer before revealing. Review the evidence. Return to weak spots.",
                },
              ].map((m, i) => (
                <div className="method-step" key={m.title}>
                  <span className="method-icon">
                    <m.icon size={17} />
                  </span>
                  <div>
                    <p className="mono muted small">0{i + 1}</p>
                    <h3>{m.title}</h3>
                    <p>{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="callout">
              <strong>The hard setting is not more trivia.</strong>
              <p>
                It is more precision: knowing where a rule stops working and
                being able to defend why.
              </p>
            </div>
            <div className="sidebar-status">
              <p className="eyebrow muted">Workspace status</p>
              <p><Layers3 size={15} /> Saved on this device</p>
              <p><Sparkles size={15} /> Source-based mode ready</p>
              <p className="small muted">Export and import a backup to continue on another device.</p>
            </div>
            <p className="sidebar-note">
              Keep official course material as your authority. Source quotes
              help you check generated questions and answers.
            </p>
          </div>
        </aside>
      </div>
      <footer className="app-footer">
        <span className="eyebrow muted">Study with intent</span>
        <span className="small muted">Recall → reason → defend.</span>
      </footer>
      {activeSet && (
        <Session
          key={activeSet.id}
          set={activeSet}
          attempts={workspace.attempts}
          onAttempt={record}
          onClose={() => setActiveSet(null)}
          saving={saving}
        />
      )}
    </main>
  );
}
