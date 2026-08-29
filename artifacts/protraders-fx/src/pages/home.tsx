import { useEffect } from "react"
import { Activity, ArrowDownRight, ArrowRight, BarChart3, BookOpen, Bot, Check, CircleAlert, LineChart, LockKeyhole, Radio, ShieldCheck } from "lucide-react"
import { Link } from "wouter"
import { useGetMarketCandles, getGetMarketCandlesQueryKey, useGetMarketTicker, getGetMarketTickerQueryKey, useGetSessionStatus, getGetSessionStatusQueryKey, useTrackEvent } from "@workspace/api-client-react"
import { Skeleton } from "@/components/ui/skeleton"
import { VOLATILITY_SYMBOLS } from "@/lib/markets"

const tickerSymbols = VOLATILITY_SYMBOLS

const toolCards = [
  { title: "Analysis Tools", eyebrow: "Context", description: "Inspect live quotes, candles, and advisory signals before you decide.", href: "/analysis", icon: Activity },
  { title: "Practice in Demo", eyebrow: "Execution", description: "Test a setup with a controlled stake and a clear review step.", href: "/dashboard", icon: BarChart3 },
  { title: "Use free bots", eyebrow: "Automation", description: "Observe no-cost templates without pretending automation removes risk.", href: "/bots", icon: Bot },
]

const principles = [
  { icon: LineChart, number: "01", title: "Context before clicks", text: "One live quote is useful. A quote with its recent movement and a written reason is more useful." },
  { icon: ShieldCheck, number: "02", title: "Boundaries stay visible", text: "Demo-first practice, bounded stakes, and pause points are part of the workspace—not footnotes." },
  { icon: LockKeyhole, number: "03", title: "Your account, your call", text: "ProTraders FX surfaces information and controlled tools. It never promises an outcome or trades without your direction." },
]

const traderNotes = [
  { label: "Clarity", quote: "I can review the market context before I touch an order.", detail: "Live quotes and a visible review step keep the decision in view." },
  { label: "Discipline", quote: "Demo practice gives me room to learn without rushing the next move.", detail: "Start with a controlled environment and keep the boundaries visible." },
  { label: "Control", quote: "The useful part is knowing when not to trade.", detail: "Advisory tools inform the decision; they never take it away from you." },
]

export default function Home() {
  const { data: session, isLoading: loadingSession } = useGetSessionStatus({
    query: { queryKey: getGetSessionStatusQueryKey() },
  })
  const trackEvent = useTrackEvent()
  const pulseTicker = useGetMarketTicker("R_100", { query: { queryKey: getGetMarketTickerQueryKey("R_100"), staleTime: 30000, refetchInterval: 5000 } })
  const pulseCandles = useGetMarketCandles("R_100", { count: 36, granularity: 60 }, {
    query: { queryKey: getGetMarketCandlesQueryKey("R_100", { count: 36, granularity: 60 }), staleTime: 30000, refetchInterval: 30000 },
  })
  const pulseData = pulseCandles.data as any
  const pulseCloses = Array.isArray(pulseData?.candles) ? pulseData.candles.map((point: any) => Number(point.close)).filter(Number.isFinite) : []
  const pulsePrice = (pulseTicker.data as any)?.quote ?? (pulseTicker.data as any)?.price
  const pulseChange = pulseCloses.length > 1 && pulseCloses[0] !== 0 ? ((pulseCloses.at(-1) - pulseCloses[0]) / pulseCloses[0]) * 100 : null

  useEffect(() => {
    document.title = "ProTraders FX · Trade like a pro."
    trackEvent.mutate({ data: { type: "page_view", path: "/" } })
    return () => { document.title = "ProTraders FX" }
  }, [])

  const tradeHref = session?.authenticated ? "/dashboard" : "/api/deriv/login"

  return (
    <div className="noise-layer flex min-h-full w-full flex-col overflow-hidden bg-background">
      <MarketTicker />

      <main>
        <section className="relative isolate border-b border-white/[.07] px-5 pb-20 pt-14 md:px-10 md:pb-28 md:pt-20">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -right-32 -top-24 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-accent/[.06] blur-3xl" />
            <div className="absolute inset-0 opacity-[.13]" style={{ backgroundImage: "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "5rem 5rem", maskImage: "linear-gradient(to bottom, black, transparent 78%)" }} />
          </div>
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:gap-8">
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[.07] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.24em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
                Deriv trading workspace
              </div>
              <h1 className="mt-7 max-w-3xl text-balance text-5xl font-bold leading-[.98] tracking-[-.05em] text-foreground md:text-7xl lg:text-[5.7rem]">
                 Trade <span className="text-primary">like a pro.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground md:text-xl">
                A focused place for everyday traders to understand live movement, practice in Demo, and use free automation without the hype.
              </p>
              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <a href={tradeHref} className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_30px_hsl(var(--primary)/.16)] transition-transform hover:-translate-y-0.5" data-testid="link-hero-trade">
                   {session?.authenticated ? "Open workspace" : "Log In and Trade"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a href="/api/deriv/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[.03] px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[.06]" data-testid="link-hero-get-started">
                  Create Free Account
                </a>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[.17em] text-muted-foreground/75">
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> Demo-first</span>
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> No profit promises</span>
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary" /> You stay in control</span>
              </div>
            </div>

            <div className="relative animate-in fade-in slide-in-from-right-3 duration-1000">
              <div className="absolute -inset-5 rounded-[2rem] border border-primary/10 bg-primary/[.025] blur-sm" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/80 shadow-2xl shadow-black/20 backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/[.08] px-5 py-4">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /><span className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Market pulse / R_100</span></div>
                  <span className="rounded-full bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary">LIVE</span>
                </div>
                <div className="p-5 md:p-7">
                  <div className="flex items-end justify-between">
                     <div><div className="font-mono text-xs text-muted-foreground">Volatility Index 100</div><div className="mt-2 font-display text-4xl font-bold tracking-tight text-foreground">{pulsePrice ?? "—"}</div></div>
                     <div className="text-right"><div className="font-mono text-xs text-primary">{pulseChange == null ? "LIVE" : `${pulseChange >= 0 ? "+" : ""}${pulseChange.toFixed(2)}%`}</div><div className="mt-1 text-[10px] text-muted-foreground">{pulseChange == null ? "live quote" : "last 36 candles"}</div></div>
                  </div>
                  <div className="relative mt-8 h-40 overflow-hidden rounded-xl border border-white/[.07] bg-background/70">
                    <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-white/[.08]" /><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/[.08]" /><div className="absolute inset-x-0 top-3/4 border-t border-dashed border-white/[.08]" />
                     <PulseChart candles={pulseData?.candles} />
                    <div className="absolute bottom-3 left-3 font-mono text-[9px] text-muted-foreground">12:00</div><div className="absolute bottom-3 right-3 font-mono text-[9px] text-muted-foreground">NOW</div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 divide-x divide-white/[.08] border-y border-white/[.08] py-4 text-center">
                     <div><div className="font-mono text-[10px] text-muted-foreground">BIAS</div><div className="mt-1 text-sm font-semibold text-primary">{pulseChange == null ? "OBSERVE" : pulseChange > 0 ? "UP" : pulseChange < 0 ? "DOWN" : "FLAT"}</div></div>
                     <div><div className="font-mono text-[10px] text-muted-foreground">MODE</div><div className="mt-1 text-sm font-semibold text-foreground">SAFE</div></div>
                    <div><div className="font-mono text-[10px] text-muted-foreground">RISK</div><div className="mt-1 text-sm font-semibold text-accent">VISIBLE</div></div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 hidden rounded-xl border border-accent/20 bg-card px-4 py-3 shadow-xl sm:block"><div className="font-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground">Decision status</div><div className="mt-1 flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full bg-accent" /> Review before entry</div></div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.07] bg-secondary/25 px-5 py-8 md:px-10">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-[.8fr_2fr] md:items-center">
            <div className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">What is in the workspace</div>
            <div className="grid gap-4 sm:grid-cols-3">
              {toolCards.map(({ title, description, href, icon: Icon }) => <Link key={title} href={href} className="group flex gap-3 rounded-lg p-2 transition-colors hover:bg-white/[.04]" data-testid={`link-tool-${title.toLowerCase().replaceAll(" ", "-")}`}><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><span className="block text-sm font-semibold text-foreground">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span></Link>)}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-10 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl"><div className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">A different trading rhythm</div><h2 className="mt-4 text-3xl font-bold leading-tight tracking-[-.04em] md:text-5xl">Less noise between a signal and a decision.</h2><p className="mt-5 text-base leading-7 text-muted-foreground">The point is not to make trading feel effortless. It is to make the important parts harder to miss.</p></div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">{principles.map(({ icon: Icon, number, title, text }) => <article key={number} className="group border-t border-white/15 pt-5 transition-colors hover:border-primary"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-primary" /><span className="font-mono text-xs text-muted-foreground">{number}</span></div><h3 className="mt-10 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></article>)}</div>
          </div>
        </section>

        <section className="border-y border-white/[.07] bg-secondary/15 px-5 py-20 md:px-10 md:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.22em] text-primary">What traders value</div>
                <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-.04em] md:text-5xl">A calmer way to build a trading routine.</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">Original perspective-led messages inspired by the questions traders ask every day—not paid testimonials or performance promises.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {traderNotes.map(note => (
                <article key={note.label} className="rounded-xl border border-white/[.08] bg-card/55 p-6 transition-colors hover:border-primary/30">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> {note.label}</div>
                  <blockquote className="mt-6 text-lg font-semibold leading-8 tracking-tight">“{note.quote}”</blockquote>
                  <p className="mt-5 border-t border-white/[.08] pt-4 text-xs leading-5 text-muted-foreground">{note.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/[.07] bg-sidebar px-5 py-20 text-sidebar-foreground md:px-10 md:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_auto] md:items-end">
            <div><div className="font-mono text-[10px] uppercase tracking-[.22em] text-sidebar-primary">Start with the fundamentals</div><h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-[-.04em] md:text-5xl">Build a process you can explain.</h2><p className="mt-5 max-w-xl leading-7 text-sidebar-foreground/65">The free course walks through the same sequence the workspace encourages: observe, frame the risk, practice, then review.</p></div>
            <Link href="/course" className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-sidebar-primary px-5 text-sm font-semibold text-sidebar-primary-foreground transition-transform hover:-translate-y-0.5" data-testid="link-explore-course">Explore the course <BookOpen className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </div>
        </section>

        <section className="px-5 py-20 md:px-10 md:py-24">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 rounded-2xl border border-accent/20 bg-accent/[.06] p-7 md:flex-row md:items-center md:justify-between md:p-10">
            <div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-accent"><CircleAlert className="h-3.5 w-3.5" /> Clear by design</div><h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">No premium bots. No payments. No promises.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Use the free tools, keep Demo enabled while you learn, and treat every result as information—not an instruction.</p></div>
            <a href="/api/deriv/signup" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-accent/40 px-5 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground" data-testid="link-final-signup">Get Started <ArrowDownRight className="h-4 w-4" /></a>
          </div>
        </section>
      </main>
    </div>
  )
}

function MarketTicker() {
  const liveQuote = useGetMarketTicker("R_100", { query: { queryKey: getGetMarketTickerQueryKey("R_100"), staleTime: 60000, refetchInterval: 60000 } })
  return <div className="relative z-20 flex w-full items-center justify-center overflow-hidden border-b border-white/[.07] bg-card/60 py-2.5 font-mono text-[10px] shadow-sm" aria-label="Live market ticker"><div className="flex min-w-max items-center gap-7 px-4">{tickerSymbols.map((symbol, index) => { const value = index === 0 ? ((liveQuote.data as any)?.quote ?? (liveQuote.data as any)?.price) : undefined; const unavailable = index === 0 && ((liveQuote.data as any)?.available === false || liveQuote.isError); return <div key={symbol} className="flex items-center gap-2"><Radio className={`h-3 w-3 ${unavailable ? "text-accent" : "text-primary/75"}`} /><span className="text-muted-foreground">{symbol}</span><span className={unavailable ? "text-accent" : "font-medium text-foreground"}>{unavailable ? "offline" : value ?? (index === 0 ? "—" : "watch")}</span></div> })}</div></div>
}

function PulseChart({ candles }: { candles?: any[] }) {
  const points = Array.isArray(candles) ? candles : []
  const closes = points.map(point => Number(point.close)).filter(Number.isFinite)
  if (closes.length < 2) return <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">Waiting for candle history</div>
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const polyline = points.map((point, index) => `${(index / (points.length - 1)) * 600},${165 - ((Number(point.close) - min) / range) * 135}`).join(" ")
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 180" preserveAspectRatio="none" aria-label="Live R_100 candle movement">
      <defs><linearGradient id="chart-fill-live" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="hsl(var(--primary))" stopOpacity=".22" /><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" /></linearGradient></defs>
      <polyline points={polyline} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}