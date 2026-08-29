import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, BookOpen, Check, Circle, Clock3, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react"
import { Link } from "wouter"

type Lesson = { id: string; index: string; title: string; duration: string; kicker: string; summary: string; points: string[] }

const lessons: Lesson[] = [
  { id: "context", index: "01", title: "Start with context", duration: "06 min", kicker: "Observe", summary: "Before a setup becomes a trade, it is a market moving through a specific moment. Learn what to notice first.", points: ["Name the market and the current session", "Separate movement from meaning", "Write one sentence before opening an order"] },
  { id: "risk", index: "02", title: "Put a boundary on it", duration: "08 min", kicker: "Protect", summary: "A plan is incomplete until it can tell you when to pause. This lesson turns risk from a warning into a visible decision.", points: ["Choose a Demo stake you can review", "Define the invalidation point", "Use a pause after a loss or a rushed entry"] },
  { id: "practice", index: "03", title: "Practice the sequence", duration: "07 min", kicker: "Execute", summary: "Use the ProTraders flow deliberately: scan, frame, review, then take a controlled Demo action only if it still makes sense.", points: ["Read the live ticker and open the market view", "Review the action before confirming", "Treat the result as a data point, not a verdict"] },
  { id: "review", index: "04", title: "Review without drama", duration: "05 min", kicker: "Learn", summary: "A useful review asks better questions than “did I win?” Build a short record you can use on the next session.", points: ["Record what you saw and what you expected", "Note whether you followed your boundary", "Change one part of the process—not everything"] },
]

export default function Course() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [completed, setCompleted] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("protraders-course-progress") || "[]") } catch { return [] }
  })
  const active = lessons[activeIndex]
  const progress = Math.round((completed.length / lessons.length) * 100)

  useEffect(() => {
    document.title = "The Focused Trader Course · ProTraders FX"
    return () => { document.title = "ProTraders FX" }
  }, [])

  const markComplete = () => {
    setCompleted((current) => {
      const next = current.includes(active.id) ? current : [...current, active.id]
      localStorage.setItem("protraders-course-progress", JSON.stringify(next))
      return next
    })
  }

  const resetProgress = () => { localStorage.removeItem("protraders-course-progress"); setCompleted([]); setActiveIndex(0) }
  const isComplete = completed.includes(active.id)
  const completedLabel = useMemo(() => `${completed.length} of ${lessons.length} lessons complete`, [completed.length])

  return (
    <div className="noise-layer min-h-full overflow-hidden bg-background">
      <section className="border-b border-white/[.07] bg-secondary/25 px-5 py-14 md:px-10 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground transition-colors hover:text-primary" data-testid="link-course-back"><ArrowLeft className="h-3.5 w-3.5" /> Back to ProTraders FX</Link>
          <div className="mt-12 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
            <div><div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-primary"><BookOpen className="h-3.5 w-3.5" /> Free guided course</div><h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-.05em] md:text-6xl">The focused trader<br /><span className="text-primary">starts with a process.</span></h1><p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Four short lessons for building a calmer sequence around live market context, Demo practice, and visible risk boundaries.</p></div>
            <div className="w-full max-w-xs rounded-xl border border-primary/20 bg-card p-5"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Your progress</span><span className="font-mono text-sm text-primary">{progress}%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span data-testid="text-course-progress">{completedLabel}</span><button type="button" onClick={resetProgress} className="inline-flex items-center gap-1 transition-colors hover:text-foreground" data-testid="button-reset-progress"><RotateCcw className="h-3 w-3" /> Reset</button></div></div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[280px_1fr] md:px-10 md:py-16">
        <aside>
          <div className="sticky top-24"><div className="mb-4 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Course map</div><div className="space-y-2">{lessons.map((lesson, index) => { const done = completed.includes(lesson.id); const selected = activeIndex === index; return <button key={lesson.id} type="button" onClick={() => setActiveIndex(index)} className={`group flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all ${selected ? "border-primary/40 bg-primary/[.08]" : "border-transparent hover:border-white/10 hover:bg-white/[.03]"}`} data-testid={`button-lesson-${lesson.id}`}><span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${done ? "border-primary bg-primary text-primary-foreground" : selected ? "border-primary text-primary" : "border-white/20 text-muted-foreground"}`}>{done ? <Check className="h-3.5 w-3.5" /> : lesson.index}</span><span className="min-w-0"><span className={`block text-sm font-semibold ${selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>{lesson.title}</span><span className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground/70"><Clock3 className="h-3 w-3" /> {lesson.duration}</span></span></button> })}</div><div className="mt-8 border-t border-white/[.08] pt-5 text-xs leading-5 text-muted-foreground"><div className="flex items-center gap-2 font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Practice stays in Demo</div><p className="mt-2">This course is educational. It does not provide financial advice or promise results.</p></div></div>
        </aside>

        <article className="min-w-0 rounded-2xl border border-white/[.09] bg-card/60 p-6 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-6"><div className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">{active.kicker} / lesson {active.index}</div><div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {active.duration}</div></div>
          <div className="max-w-3xl py-10"><h2 className="text-3xl font-bold tracking-[-.04em] md:text-5xl">{active.title}</h2><p className="mt-5 text-lg leading-8 text-muted-foreground">{active.summary}</p><div className="mt-10 space-y-3">{active.points.map((point, index) => <div key={point} className="flex items-start gap-3 rounded-lg border border-white/[.08] bg-background/35 p-4"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">{String(index + 1).padStart(2, "0")}</span><span className="text-sm leading-6 text-foreground/85">{point}</span></div>)}</div></div>
          <div className="flex flex-col gap-3 border-t border-white/[.08] pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={markComplete} className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors ${isComplete ? "border border-primary/30 bg-primary/10 text-primary" : "bg-primary text-primary-foreground hover:bg-primary/90"}`} data-testid="button-complete-lesson">{isComplete ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{isComplete ? "Lesson complete" : "Mark lesson complete"}</button><div className="flex gap-2"><button type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(index - 1, 0))} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 text-sm text-muted-foreground transition-colors hover:bg-white/[.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35" data-testid="button-previous-lesson"><ArrowLeft className="h-4 w-4" /> Previous</button><button type="button" disabled={activeIndex === lessons.length - 1} onClick={() => setActiveIndex((index) => Math.min(index + 1, lessons.length - 1))} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 text-sm text-muted-foreground transition-colors hover:bg-white/[.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35" data-testid="button-next-lesson">Next <ArrowRight className="h-4 w-4" /></button></div></div>
          {activeIndex === lessons.length - 1 && isComplete && <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/[.06] p-4 text-sm text-foreground/85"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>You have completed the guided sequence. When you are ready, <Link href="/dashboard" className="font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-course-workspace">open the workspace</Link> and keep your first sessions in Demo.</span></div>}
        </article>
      </main>
    </div>
  )
}