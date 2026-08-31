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

  const resetProgress = () => {
    localStorage.removeItem("protraders-course-progress")
    setCompleted([])
    setActiveIndex(0)
  }
  const isComplete = completed.includes(active.id)
  const completedLabel = useMemo(() => `${completed.length} of ${lessons.length} lessons complete`, [completed.length])

  return (
    <div className="min-h-full overflow-hidden bg-[#fcfaf8]">
      <section className="relative overflow-hidden border-b border-white/10 bg-[#091a2d] px-5 py-14 text-white md:px-10 md:py-20">
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-[#e96751]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-[#194d70]/35 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-6xl">
          <Link href="/" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-white/55 transition-colors hover:text-white" data-testid="link-course-back">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to ProTraders FX
          </Link>
          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[.95fr_1.05fr] lg:gap-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#eb907e]/50 bg-[#e96751]/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-[#ffb2a1]">
                <BookOpen className="h-3.5 w-3.5" /> Free guided course
              </div>
              <h1 className="mt-6 max-w-2xl font-display text-5xl font-semibold leading-[.98] tracking-[-.04em] md:text-7xl">
                The focused trader <br /><span className="text-[#e96751]">starts with a process.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
                Four short lessons for building a calmer sequence around live market context, Demo practice, and visible risk boundaries.
              </p>
              <div className="mt-7 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-white/55">
                <span className="rounded-full border border-white/15 px-3 py-1.5">4 lessons</span>
                <span className="rounded-full border border-white/15 px-3 py-1.5">26 minutes</span>
                <span className="rounded-full border border-white/15 px-3 py-1.5">Demo first</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="absolute -inset-4 rounded-[2rem] bg-[#e96751]/15" aria-hidden="true" />
              <div className="relative aspect-[1.12/1] overflow-hidden rounded-[1.7rem] border-[8px] border-white/10 bg-[#102945] shadow-[0_25px_70px_rgba(0,0,0,.3)]">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(21,152,132,.18),transparent_42%),linear-gradient(315deg,rgba(233,103,81,.2),transparent_48%)]" aria-hidden="true" />
                <div className="absolute inset-6 rounded-2xl border border-white/10" aria-hidden="true" />
                <div className="relative flex h-full flex-col justify-between p-7">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-white/20 bg-[#081c32]/70 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.16em] text-white/80">Learn the sequence</span>
                    <span className="rounded-full bg-[#e96751] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-white">01 / 04</span>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#6ee2cb]">Your next move</div>
                    <div className="mt-2 font-display text-3xl tracking-tight text-white">Observe before<br />you act.</div>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[.18em] text-white/55">
                    <span className="h-2 w-2 rounded-full bg-[#ff9f8c]" /> Lesson 01 · Observe
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-4 w-60 rounded-2xl border border-[#dce6e7] bg-white p-4 text-[#14243a] shadow-[0_14px_35px_rgba(0,0,0,.18)]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[.18em] text-[#748092]">Your progress</span>
                  <span className="font-mono text-sm font-semibold text-[#e96751]">{progress}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf0f1]">
                  <div className="h-full rounded-full bg-[#e96751] transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-[#748092]">
                  <span data-testid="text-course-progress">{completedLabel}</span>
                  <button type="button" onClick={resetProgress} className="inline-flex items-center gap-1 transition-colors hover:text-[#e96751]" data-testid="button-reset-progress">
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-[280px_1fr] md:px-10 md:py-20">
        <aside>
          <div className="sticky top-24">
            <div className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-[#c84c3d]">Course map</div>
            <div className="space-y-2">
              {lessons.map((lesson, index) => {
                const done = completed.includes(lesson.id)
                const selected = activeIndex === index
                return (
                  <button key={lesson.id} type="button" onClick={() => setActiveIndex(index)} className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all ${selected ? "border-[#e96751]/45 bg-[#fff0ec] shadow-sm" : "border-transparent hover:border-[#dfe3e8] hover:bg-white"}`} data-testid={`button-lesson-${lesson.id}`}>
                    <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${done ? "border-[#159884] bg-[#159884] text-white" : selected ? "border-[#e96751] text-[#e96751]" : "border-[#cfd7dd] text-[#84909e]"}`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : lesson.index}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${selected ? "text-[#14243a]" : "text-[#687689] group-hover:text-[#14243a]"}`}>{lesson.title}</span>
                      <span className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.14em] text-[#8a96a2]"><Clock3 className="h-3 w-3" /> {lesson.duration}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-8 rounded-xl border border-[#dce3e7] bg-white p-4 text-xs leading-5 text-[#748092]">
              <div className="flex items-center gap-2 font-semibold text-[#14243a]"><ShieldCheck className="h-4 w-4 text-[#159884]" /> Practice stays in Demo</div>
              <p className="mt-2">This course is educational. It does not provide financial advice or promise results.</p>
            </div>
          </div>
        </aside>

        <article className="min-w-0 rounded-2xl border border-[#dce3e7] bg-white p-6 shadow-[0_12px_35px_rgba(20,36,58,.05)] md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebed] pb-6">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-[#c84c3d]">{active.kicker} / lesson {active.index}</div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dce3e7] px-3 py-1.5 font-mono text-[10px] text-[#748092]"><Clock3 className="h-3.5 w-3.5" /> {active.duration}</div>
          </div>
          <div className="max-w-3xl py-10">
            <h2 className="font-display text-3xl font-semibold tracking-[-.04em] text-[#14243a] md:text-5xl">{active.title}</h2>
            <p className="mt-5 text-lg leading-8 text-[#687689]">{active.summary}</p>
            <div className="mt-10 space-y-3">
              {active.points.map((point, index) => (
                <div key={point} className="flex items-start gap-3 rounded-xl border border-[#e2e8ea] bg-[#f8fbfb] p-4">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#fff0ec] font-mono text-[10px] text-[#e96751]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-sm leading-6 text-[#32445a]">{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-[#e7ebed] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={markComplete} className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${isComplete ? "border border-[#159884]/30 bg-[#e9f8f4] text-[#159884]" : "bg-[#e96751] text-white hover:bg-[#d95743]"}`} data-testid="button-complete-lesson">
              {isComplete ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />} {isComplete ? "Lesson complete" : "Mark lesson complete"}
            </button>
            <div className="flex gap-2">
              <button type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(index - 1, 0))} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#dce3e7] px-4 text-sm text-[#748092] transition-colors hover:bg-[#f7f9fa] hover:text-[#14243a] disabled:cursor-not-allowed disabled:opacity-35" data-testid="button-previous-lesson"><ArrowLeft className="h-4 w-4" /> Previous</button>
              <button type="button" disabled={activeIndex === lessons.length - 1} onClick={() => setActiveIndex((index) => Math.min(index + 1, lessons.length - 1))} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#dce3e7] px-4 text-sm text-[#748092] transition-colors hover:bg-[#f7f9fa] hover:text-[#14243a] disabled:cursor-not-allowed disabled:opacity-35" data-testid="button-next-lesson">Next <ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
          {activeIndex === lessons.length - 1 && isComplete && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#159884]/25 bg-[#e9f8f4] p-4 text-sm text-[#32445a]">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#159884]" />
              <span>You have completed the guided sequence. When you are ready, <Link href="/dashboard" className="font-semibold text-[#159884] underline-offset-4 hover:underline" data-testid="link-course-workspace">open the workspace</Link> and keep your first sessions in Demo.</span>
            </div>
          )}
        </article>
      </main>
    </div>
  )
}