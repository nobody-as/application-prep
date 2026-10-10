"use client";
import { useState, useRef } from "react";
import { Upload, Plus, FileText, X, Link2, ChevronDown } from "lucide-react";
import { type Source, selectedPages } from "@/lib/study/model";
import { readSourceFile } from "@/lib/study/files";
export default function SourcePanel({
  sources,
  onChange,
  signedIn,
  disabled,
  onBusy,
}: {
  sources: Source[];
  onChange: (s: Source[]) => void;
  signedIn: boolean;
  disabled: boolean;
  onBusy: (value: boolean) => void;
}) {
  const [tab, setTab] = useState<"text" | "file" | "url">("text"),
    [text, setText] = useState(""),
    [title, setTitle] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const add = (s: Source) => {
    if (sources.length >= 12)
      throw new Error("A set supports up to 12 sources.");
    onChange([...sources, s]);
    setText("");
    setTitle("");
    setUrl("");
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setBusy("Reading file…");
    onBusy(true);
    try {
      const added: Source[] = [];
      for (const file of Array.from(files)) {
        added.push(await readSourceFile(file, setBusy));
      }
      if (sources.length + added.length > 12)
        throw new Error("A set supports up to 12 sources.");
      onChange([...sources, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    } finally {
      setBusy("");
      onBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const addText = () => {
    setError("");
    try {
      if (text.trim().length < 100)
        throw new Error("Paste at least 100 characters of study material.");
      if (text.length > 1500000)
        throw new Error("Split this material into smaller passages.");
      add({
        id: crypto.randomUUID(),
        title: title.trim() || "Pasted notes",
        pages: text.split("\f").map((text, i) => ({ number: i + 1, text })),
        range: "",
        use: "both",
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const importUrl = async () => {
    setError("");
    setBusy("Reading page…");
    onBusy(true);
    try {
      const r = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d: { error?: string; content: string; html: boolean; url: string } =
        await r.json();
      if (!r.ok) throw new Error(d.error);
      let content = d.content,
        pageTitle = title.trim();
      if (d.html) {
        const doc = new DOMParser().parseFromString(content, "text/html");
        pageTitle = pageTitle || doc.title;
        doc
          .querySelectorAll(
            "script,style,nav,footer,header,aside,form,noscript,svg",
          )
          .forEach((n) => n.remove());
        const main = doc.querySelector("main,article") || doc.body;
        main
          .querySelectorAll("p,h1,h2,h3,h4,li,br,pre")
          .forEach((n) => n.appendChild(doc.createTextNode("\n")));
        content = main.textContent || "";
      }
      if (content.trim().length < 100)
        throw new Error(
          "This page needs JavaScript or sign-in. Paste the text instead.",
        );
      add({
        id: crypto.randomUUID(),
        title: pageTitle || new URL(d.url).hostname,
        pages: [{ number: 1, text: content.slice(0, 60000) }],
        range: "",
        use: "both",
        url: d.url,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      onBusy(false);
    }
  };
  return (
    <section className="panel source-panel">
      <div className="panel-head">
        <span>
          <FileText size={16} /> Source material
        </span>
        <span className="muted mono">01 / 02</span>
      </div>
      <div className="panel-body">
        <div
          className="segmented"
          role="tablist"
          aria-label="Source input type"
        >
          {(["text", "file", "url"] as const).map((t) => (
            <button
              role="tab"
              aria-selected={tab === t}
              key={t}
              onClick={() => setTab(t)}
              disabled={!!busy || disabled}
            >
              {t === "text"
                ? "Paste text"
                : t === "file"
                  ? "Upload files"
                  : "Web page"}
            </button>
          ))}
        </div>
        {tab === "text" && (
          <>
            <label className="field">
              Source title <span className="muted">optional</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Chapter 1 · Lecture notes"
                disabled={disabled || !!busy}
              />
            </label>
            <label className="field">
              Page text or notes
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the material you need to know. Add each chapter, slide deck, or reading as a separate source."
                rows={5}
                disabled={disabled || !!busy}
              />
            </label>
            <div className="row split">
              <span className="small muted">
                {text.length.toLocaleString()} characters
              </span>
              <button
                className="button small-button secondary"
                onClick={addText}
                disabled={disabled || !!busy || !text.trim()}
              >
                <Plus size={14} />
                Add source
              </button>
            </div>
          </>
        )}
        {tab === "file" && (
          <>
            <input
              ref={input}
              type="file"
              accept=".pdf,.txt,.md"
              multiple
              hidden
              onChange={(e) => upload(e.target.files)}
            />
            <button
              className="dropzone"
              disabled={disabled || !!busy}
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!disabled && !busy) void upload(e.dataTransfer.files);
              }}
            >
              <Upload size={24} />
              <strong>Add your course material</strong>
              <span>Choose or drop PDF, TXT, and Markdown files</span>
              <small>20 MB per file · Select specific PDF pages below</small>
            </button>
            <p className="small muted">
              Text is extracted on your device. Scanned PDFs require OCR;
              diagrams and images are not extracted.
            </p>
          </>
        )}
        {tab === "url" && (
          <>
            <label className="field">
              Public page URL
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                disabled={disabled || !!busy}
              />
            </label>
            <div className="row split">
              <p className="small muted">
                Public text pages only. For course portals, paste the text.
              </p>
              <button
                className="button secondary small-button"
                disabled={!signedIn || disabled || !!busy || !url.trim()}
                onClick={importUrl}
              >
                <Link2 size={14} />
                Read page
              </button>
            </div>
            {!signedIn && (
              <p className="small muted">Sign in to import web pages.</p>
            )}
          </>
        )}
        {busy && (
          <p className="notice" role="status">
            {busy}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!!sources.length && (
          <div className="source-list">
            {sources.map((s) => {
              let count = 0,
                rangeError = "";
              try {
                count = selectedPages(s).length;
              } catch (e) {
                rangeError = (e as Error).message;
              }
              return (
                <div className="source-row" key={s.id}>
                  <div className="row split">
                    <div className="row">
                      <FileText size={16} />
                      <strong>{s.title}</strong>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${s.title}`}
                      disabled={disabled || !!busy}
                      onClick={() =>
                        onChange(sources.filter((x) => x.id !== s.id))
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="source-controls">
                    <label>
                      Use for
                      <select
                        value={s.use}
                        disabled={disabled || !!busy}
                        onChange={(e) =>
                          onChange(
                            sources.map((x) =>
                              x.id === s.id
                                ? { ...x, use: e.target.value as Source["use"] }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="both">Cards + quiz</option>
                        <option value="cards">Flashcards only</option>
                        <option value="quiz">Quiz only</option>
                      </select>
                    </label>
                    <label>
                      Pages{" "}
                      <span className="muted">{s.pages.length} total</span>
                      <input
                        value={s.range}
                        placeholder="All, or 1-5, 8"
                        disabled={disabled || !!busy}
                        onChange={(e) =>
                          onChange(
                            sources.map((x) =>
                              x.id === s.id
                                ? { ...x, range: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <p className={rangeError ? "error small" : "small muted"}>
                    {rangeError ||
                      `${count} readable page${count === 1 ? "" : "s"} selected`}
                  </p>
                  <details>
                    <summary className="small">
                      Inspect extracted text <ChevronDown size={12} />
                    </summary>
                    <pre className="source-preview">
                      {s.pages
                        .map((p) => `PAGE ${p.number}\n${p.text}`)
                        .join("\n\n")}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
