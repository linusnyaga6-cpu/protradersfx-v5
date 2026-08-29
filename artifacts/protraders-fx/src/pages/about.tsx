import { useEffect } from "react"
import { BarChart3, Code2, HeartPulse, LineChart, ShieldCheck } from "lucide-react"
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
    <div className="relative overflow-hidden">
      <section className="border-b bg-secondary/35 px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-5xl">
          <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">About & credits</Badge>
          <div className="mt-7 grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
                From caring for people to reading the market.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                I’m Linus Nyaga Ndambiri. My journey has moved from nursing, to MT5,
                to binary and forex trading, and into web design—bringing together
                care, pattern recognition, risk awareness, and a love of building useful tools.
              </p>
            </div>
            <Card className="border-primary/20 bg-background/80">
              <CardContent className="p-6">
                <ShieldCheck className="h-7 w-7 text-primary" />
                <div className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">The principle</div>
                <p className="mt-3 text-xl font-medium leading-8">
                  Slow down. Read the evidence. Protect the downside.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[.22em] text-primary">The journey</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Different disciplines. One way of working.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Each chapter shaped how I think about ProTraders FX: observe clearly,
              make the next step understandable, and never hide the risk.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {journey.map(({ step, icon: Icon, title, text }) => (
              <Card key={title} className="group transition-colors hover:border-primary/35">
                <CardContent className="flex gap-5 p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-mono text-xs text-primary">{step}</div>
                    <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-sidebar px-4 py-16 text-sidebar-foreground md:px-8 md:py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[.22em] text-sidebar-primary">Why I built this</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Trading tools should clarify, not pressure.</h2>
            <p className="mt-4 leading-7 text-sidebar-foreground/65">
              ProTraders FX is an independent project. It is designed to make market
              data and controlled actions visible in one place—not to
              promise returns or replace personal judgment.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t px-4 py-10 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 rounded-xl border bg-card p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[.22em] text-primary">Copyright</div>
            <p className="mt-2 text-sm text-muted-foreground">Copyright © 2026 Linus Nyaga Ndambiri. All rights reserved.</p>
          </div>
          <p className="text-sm font-medium text-foreground">Site identifier: Issay-KE</p>
        </div>
      </section>
    </div>
  )
}