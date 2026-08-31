import { useEffect } from "react"
import { ArrowRight, BarChart3, Code2, HeartPulse, LineChart, ShieldCheck } from "lucide-react"
import { Link } from "wouter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const journey = [
  {
    step: "01",
    icon: HeartPulse,
    title: "Nursing",
    text: "A foundation in care, observation, calm decision-making, and respect for the person behind every outcome.",
  },
  {
    step: "02",
    icon: BarChart3,
    title: "MT5 trading",
    text: "Learning the rhythm of charts, price movement, technical structure, and the discipline required to follow a plan.",
  },
  {
    step: "03",
    icon: LineChart,
    title: "Binary & forex",
    text: "Exploring faster markets while becoming more deliberate about timing, exposure, evidence, and responsible risk.",
  },
  {
    step: "04",
    icon: Code2,
    title: "Web design",
    text: "Turning those lessons into focused digital tools that make information easier to understand and decisions easier to review.",
  },
]

export default function About() {
  useEffect(() => {
    document.title = "About the Author · ProTraders FX"
    return () => {
      document.title = "ProTraders FX"
    }
  }, [])

  return (
    <div className="relative overflow-hidden bg-[#fcfaf8]">
      <section className="relative overflow-hidden border-b border-white/10 bg-[#091a2d] px-4 py-16 text-white md:px-8 md:py-24">
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-[#df6653]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#174b70]/40 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[.95fr_1.05fr] lg:gap-20">
          <div>
            <Badge variant="outline" className="border-[#eb907e]/50 bg-[#e96751]/10 text-[#ffb2a1]">About ProTraders FX</Badge>
            <h1 className="mt-7 max-w-2xl font-display text-5xl font-semibold leading-[.98] tracking-[-.04em] md:text-7xl">
              Built for traders who want to <span className="text-[#e96751]">see clearly.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-white/65">
              I’m Linus Nyaga Ndambiri. My journey has moved from nursing, to MT5,
              to binary and forex trading, and into web design—bringing together
              care, pattern recognition, risk awareness, and a love of building useful tools.
            </p>
            <Link href="/course" className="mt-8 inline-flex h-11 items-center gap-3 rounded-full bg-[#e96751] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(233,103,81,.18)] transition-colors hover:bg-[#d95743]">
              Explore the process <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -inset-4 rounded-[2rem] bg-[#e96751]/15" aria-hidden="true" />
            <div className="relative aspect-[1.05/1] overflow-hidden rounded-[1.7rem] border-[8px] border-white/10 bg-[#102945] shadow-[0_25px_70px_rgba(0,0,0,.3)]">
              <img src="/images/protraders-trader-hero.jpg" alt="Trader studying live market charts" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#061525]/90 via-transparent to-[#102945]/10" />
              <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
                <span className="rounded-full border border-white/20 bg-[#081c32]/70 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.16em] text-white/80 backdrop-blur">The builder</span>
                <span className="rounded-full bg-[#e96751] px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-white">Issay-KE</span>
              </div>
              <div className="absolute bottom-5 left-5 max-w-xs">
                <div className="font-mono text-[9px] uppercase tracking-[.18em] text-white/55">A practical point of view</div>
                <div className="mt-1 font-display text-2xl tracking-tight text-white">Calm decisions compound.</div>
              </div>
            </div>
            <Card className="absolute -bottom-6 -left-4 hidden w-56 border-[#dce6e7] bg-white text-[#14243a] shadow-[0_14px_35px_rgba(0,0,0,.18)] sm:block">
              <CardContent className="p-4">
                <ShieldCheck className="h-5 w-5 text-[#159884]" />
                <div className="mt-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[#748092]">The principle</div>
                <p className="mt-1 text-sm font-semibold leading-5">Slow down. Read the evidence. Protect the downside.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#c84c3d]">The journey</div>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[#14243a] md:text-4xl">Different disciplines. One way of working.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Each chapter shaped how I think about ProTraders FX: observe clearly,
              make the next step understandable, and never hide the risk.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {journey.map(({ step, icon: Icon, title, text }) => (
              <Card key={title} className="group border-[#dce3e7] bg-white transition-all hover:-translate-y-1 hover:border-[#e96751]/45 hover:shadow-[0_14px_30px_rgba(20,36,58,.08)]">
                <CardContent className="flex gap-5 p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff0ec] text-[#e96751]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-mono text-xs text-[#c84c3d]">{step}</div>
                    <h3 className="mt-1 text-lg font-semibold text-[#14243a]">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#091a2d] px-4 py-16 text-white md:px-8 md:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#ff9f8c]">Why I built this</div>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Trading tools should clarify, not pressure.</h2>
            <p className="mt-4 leading-7 text-white/60">
              ProTraders FX is an independent project. It is designed to make market
              data and controlled actions visible in one place—not to
              promise returns or replace personal judgment.
            </p>
          </div>
          <Link href="/course" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:border-[#e96751] hover:bg-[#e96751]">
            Read the course <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="border-t border-[#dce3e7] px-4 py-10 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 rounded-2xl border border-[#dce3e7] bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#c84c3d]">Copyright</div>
            <p className="mt-2 text-sm text-muted-foreground">Copyright © 2026 Linus Nyaga Ndambiri. All rights reserved.</p>
          </div>
          <p className="text-sm font-medium text-[#14243a]">Site identifier: Issay-KE</p>
        </div>
      </section>
    </div>
  )
}