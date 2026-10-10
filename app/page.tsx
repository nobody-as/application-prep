"use client"

import { useState } from "react"
import {
  ArrowUpRight,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  Layers3,
  Link2,
  Menu,
  Plus,
  Sparkles,
  Target,
  X,
} from "lucide-react"

const difficulty = [
  { name: "Recall", note: "Core facts", level: "01" },
  { name: "Connect", note: "Patterns & links", level: "02" },
  { name: "Pressure test", note: "Edge cases & transfer", level: "03" },
]

const sampleCards = [
  { tag: "CONCEPT", title: "What problem does memoization solve?", body: "It avoids repeating expensive computations by caching a function's output for a given set of inputs.", accent: "blue" },
  { tag: "EDGE CASE", title: "When can memoization make performance worse?", body: "When cache management costs more than recomputing, inputs are unstable, or the cache grows without bounds.", accent: "coral" },
  { tag: "TRANSFER", title: "How would you test a memoized function?", body: "Test equivalent inputs, changed dependencies, cache invalidation, and behavior under memory pressure.", accent: "ink" },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState<"cards" | "quiz">("cards")
  const [selectedDifficulty, setSelectedDifficulty] = useState(2)
  const [source, setSource] = useState("")
  const [generated, setGenerated] = useState(false)

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#17191c]">
      <header className="border-b border-[#d9d8d2] bg-[#f7f6f2]/95">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center bg-[#17191c] text-[#f7f6f2]"><Brain className="size-5" /></div>
            <span className="font-mono text-[13px] font-bold uppercase tracking-[0.16em]">application-prep</span>
          </div>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#70716d] md:flex">
            <a className="text-[#17191c]" href="#create">Create</a><a href="#library">Library</a><a href="#method">Method</a>
          </nav>
          <button aria-label="Open menu" className="rounded-md p-2 hover:bg-[#e8e7e1] md:hidden"><Menu className="size-5" /></button>
          <button className="hidden items-center gap-2 border border-[#c9c8c2] px-3 py-2 text-[12px] font-semibold md:flex"><span className="size-2 rounded-full bg-[#e36f57]" /> Your workspace <ChevronDown className="size-3.5" /></button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-10 md:grid-cols-[minmax(0,1fr)_330px] md:px-10 md:py-16">
        <section id="create" className="min-w-0">
          <div className="mb-12 max-w-3xl">
            <p className="mb-5 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#3566d4]">Study system / 01</p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl">Learn the edges,<br /><span className="text-[#3566d4]">not just the middle.</span></h1>
            <p className="mt-6 max-w-xl text-[16px] leading-7 text-[#676862]">Turn any reading into rigorous flashcards and quizzes. We look for the exceptions, hidden assumptions, and connections most summaries miss.</p>
          </div>

          <div className="border border-[#d9d8d2] bg-white shadow-[0_10px_30px_rgba(23,25,28,0.04)]">
            <div className="flex items-center justify-between border-b border-[#e6e5df] px-5 py-4"><div className="flex items-center gap-2"><Link2 className="size-4 text-[#3566d4]" /><span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">Source material</span></div><span className="font-mono text-[10px] text-[#989994]">01 / 02</span></div>
            <div className="p-5">
              <label htmlFor="source" className="mb-3 block text-[13px] font-medium text-[#676862]">Paste a URL or the text of a page</label>
              <textarea id="source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://... or paste your notes here" className="min-h-32 w-full resize-y border border-[#d9d8d2] bg-[#fcfcfa] p-4 text-[14px] outline-none transition placeholder:text-[#aaa9a3] focus:border-[#3566d4] focus:ring-2 focus:ring-[#3566d4]/10" />
              <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p className="flex items-center gap-2 text-[12px] text-[#898a84]"><FileText className="size-3.5" /> PDFs and pages work best with clear headings.</p><button onClick={() => setSource("https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map")} className="flex items-center gap-1.5 self-start text-[12px] font-semibold text-[#3566d4] hover:underline">Use an example <ArrowUpRight className="size-3.5" /></button></div>
            </div>

            <div className="border-t border-[#e6e5df] px-5 py-5">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[13px] font-semibold">Challenge level</p><p className="mt-1 text-[12px] text-[#898a84]">Always pushes beyond surface-level recall.</p></div><Target className="size-4 text-[#e36f57]" /></div>
              <div className="grid gap-2 sm:grid-cols-3">{difficulty.map((item, index) => <button key={item.name} onClick={() => setSelectedDifficulty(index)} className={`group border p-3 text-left transition ${selectedDifficulty === index ? "border-[#3566d4] bg-[#eef3ff]" : "border-[#d9d8d2] hover:border-[#a7a8a3]"}`}><div className="mb-5 flex items-start justify-between"><span className={`font-mono text-[10px] font-bold ${selectedDifficulty === index ? "text-[#3566d4]" : "text-[#a4a59f]"}`}>{item.level}</span>{selectedDifficulty === index && <Check className="size-3.5 text-[#3566d4]" />}</div><p className="text-[13px] font-semibold">{item.name}</p><p className="mt-1 text-[11px] text-[#898a84]">{item.note}</p></button>)}</div>
            </div>
            <div className="flex flex-col items-start justify-between gap-4 border-t border-[#e6e5df] bg-[#fbfbf8] px-5 py-4 sm:flex-row sm:items-center"><p className="max-w-md text-[11px] leading-5 text-[#898a84]">At level 03, expect adversarial questions, counterexamples, and “what changes if...” prompts.</p><button onClick={() => setGenerated(true)} className="flex w-full items-center justify-center gap-2 bg-[#3566d4] px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-[#2854b8] sm:w-auto"><Sparkles className="size-4" /> Generate study set <ArrowUpRight className="size-3.5" /></button></div>
          </div>

          <div id="library" className="mt-16">
            <div className="mb-5 flex items-end justify-between border-b border-[#d9d8d2] pb-4"><div><p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#898a84]">Your output</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{generated ? "JavaScript · Array.map()" : "A preview of your study set"}</h2></div><span className="font-mono text-[11px] text-[#898a84]">{generated ? "12 cards · 8 questions" : "Ready when you are"}</span></div>
            <div className="mb-6 flex gap-1 border-b border-[#e2e1db]"><button onClick={() => setActiveTab("cards")} className={`flex items-center gap-2 border-b-2 px-3 py-3 text-[12px] font-semibold ${activeTab === "cards" ? "border-[#3566d4] text-[#3566d4]" : "border-transparent text-[#898a84]"}`}><Layers3 className="size-4" /> Flashcards <span className="font-mono text-[10px]">12</span></button><button onClick={() => setActiveTab("quiz")} className={`flex items-center gap-2 border-b-2 px-3 py-3 text-[12px] font-semibold ${activeTab === "quiz" ? "border-[#3566d4] text-[#3566d4]" : "border-transparent text-[#898a84]"}`}><CircleHelp className="size-4" /> Quiz <span className="font-mono text-[10px]">08</span></button></div>
            {activeTab === "cards" ? <div className="grid gap-3">{sampleCards.map((card, index) => <article key={card.title} className="group flex gap-4 border border-[#d9d8d2] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"><div className={`mt-1 h-10 w-1 shrink-0 ${card.accent === "blue" ? "bg-[#3566d4]" : card.accent === "coral" ? "bg-[#e36f57]" : "bg-[#17191c]"}`} /><div className="min-w-0 flex-1"><div className="mb-3 flex items-center justify-between"><span className="font-mono text-[10px] font-bold tracking-[0.15em] text-[#898a84]">{String(index + 1).padStart(2, "0")} · {card.tag}</span><button aria-label={`Remove card ${index + 1}`} className="text-[#c0c0ba] opacity-0 transition group-hover:opacity-100 hover:text-[#e36f57]"><X className="size-4" /></button></div><h3 className="text-[15px] font-semibold leading-6">{card.title}</h3><p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#676862]">{card.body}</p></div></article>)}</div> : <div className="border border-[#d9d8d2] bg-white p-7"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#3566d4]">Question 01 / 08</p><h3 className="mt-5 max-w-2xl text-xl font-semibold leading-8">What is the key difference between map() and forEach(), and why does that distinction matter in functional code?</h3><div className="mt-7 grid gap-2 sm:grid-cols-2"><button className="border border-[#d9d8d2] p-3 text-left text-[12px] hover:border-[#3566d4]">map() returns a new array</button><button className="border border-[#d9d8d2] p-3 text-left text-[12px] hover:border-[#3566d4]">forEach() is always faster</button><button className="border border-[#d9d8d2] p-3 text-left text-[12px] hover:border-[#3566d4]">They are identical</button><button className="border border-[#d9d8d2] p-3 text-left text-[12px] hover:border-[#3566d4]">map() mutates the source</button></div></div>}
          </div>
        </section>

        <aside id="method" className="border-t border-[#d9d8d2] pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0"><div className="sticky top-8"><p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#898a84]">The method</p><h2 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.035em]">Built for the moment you think you know it.</h2><div className="mt-8 space-y-7">{[{icon: BookOpen, n: "01", title: "Extract", body: "We map the source into claims, definitions, examples, and assumptions."}, {icon: Brain, n: "02", title: "Stress-test", body: "We probe edge cases, trade-offs, and what breaks when context changes."}, {icon: Target, n: "03", title: "Retrieve", body: "You answer from memory, then get a concise explanation of the gap."}].map((item) => <div key={item.n} className="flex gap-4"><div className="flex size-9 shrink-0 items-center justify-center border border-[#d9d8d2] bg-white"><item.icon className="size-4 text-[#3566d4]" /></div><div><p className="font-mono text-[10px] font-bold text-[#a1a29c]">{item.n}</p><h3 className="mt-1 text-[14px] font-semibold">{item.title}</h3><p className="mt-1 text-[12px] leading-5 text-[#898a84]">{item.body}</p></div></div>)}</div><div className="mt-10 border-l-2 border-[#e36f57] bg-[#fff5f1] p-4"><p className="text-[12px] font-semibold leading-5">The hard setting is not more trivia.</p><p className="mt-2 text-[11px] leading-5 text-[#8f7168]">It is more precision: knowing where a rule stops working and why.</p></div><button className="mt-8 flex items-center gap-2 text-[12px] font-semibold text-[#3566d4] hover:underline">Read the approach <ArrowUpRight className="size-3.5" /></button></div></aside>
      </div>
      <footer className="border-t border-[#d9d8d2] px-5 py-6 md:px-10"><div className="mx-auto flex max-w-[1440px] items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a1a29c]">Study with intent</span><button className="flex items-center gap-2 text-[12px] font-medium text-[#676862]"><Plus className="size-3.5" /> New workspace</button></div></footer>
    </main>
  )
}
