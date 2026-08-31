import { useEffect } from "react"
import { Activity, ArrowRight, Bot, CheckCircle2, ChevronRight, Crosshair, LineChart, LockKeyhole, Radio, ShieldCheck, TerminalSquare } from "lucide-react"
import { Link } from "wouter"
import { useGetMarketCandles, getGetMarketCandlesQueryKey, useGetMarketTicker, getGetMarketTickerQueryKey, useGetSessionStatus, getGetSessionStatusQueryKey, useTrackEvent } from "@workspace/api-client-react"
import { DEFAULT_MARKET_SYMBOL } from "@/lib/markets"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"

export default function Home() {
  const { data: session } = useGetSessionStatus({
    query: { queryKey: getGetSessionStatusQueryKey() },
  })
  const trackEvent = useTrackEvent()
  const pulseTicker = useGetMarketTicker(DEFAULT_MARKET_SYMBOL, { query: { queryKey: getGetMarketTickerQueryKey(DEFAULT_MARKET_SYMBOL), staleTime: 30000, refetchInterval: 15000 } })
  const pulseCandles = useGetMarketCandles(DEFAULT_MARKET_SYMBOL, { count: 36, granularity: 60 }, {
    query: { queryKey: getGetMarketCandlesQueryKey(DEFAULT_MARKET_SYMBOL, { count: 36, granularity: 60 }), staleTime: 30000, refetchInterval: 30000 },
  })
  const pulseData = pulseCandles.data as any
  const pulseCloses = Array.isArray(pulseData?.candles) ? pulseData.candles.map((point: any) => Number(point.close)).filter(Number.isFinite) : []
  const pulsePrice = (pulseTicker.data as any)?.quote ?? (pulseTicker.data as any)?.price
  const pulseChange = pulseCloses.length > 1 && pulseCloses[0] !== 0 ? ((pulseCloses.at(-1) - pulseCloses[0]) / pulseCloses[0]) * 100 : null

  useEffect(() => {
    document.title = "ProTraders FX · Trade like a pro."
    trackEvent.mutate({ data: { type: "page_view", path: "/" } })
    return () => { document.title = "ProTraders FX" }
    // Page-view tracking should run once per mount. Mutation objects can change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tradeHref = session?.authenticated ? "/dashboard" : "/api/deriv/login"

  return (
    <div className="noise-layer flex min-h-full w-full flex-col overflow-hidden bg-background">
      <MarketTicker />
      
      <main className="flex-1 w-full">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden border-b border-border bg-[#fcfaf8] px-5 py-14 md:px-10 md:py-20 lg:py-24">
          <div className="absolute -right-24 top-8 h-72 w-72 rounded-full bg-[#f6b2a1]/20 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#d9f0ed]/45 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
            <div className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#efaa98] bg-[#fff3ef] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.2em] text-[#c84c3d]">
                <Radio className="h-3 w-3" /> Deriv trading workspace
              </div>
              <h1 className="font-display text-5xl font-semibold leading-[.98] tracking-[-.04em] text-[#14243a] sm:text-6xl lg:text-[5.2rem]">
                TRADE LIKE A <br /><span className="text-[#e96751]">PRO.</span>
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-[#637184] sm:text-lg">
                A clearer way to read the market, review a setup, and trade from your selected Demo or Real account.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a href={tradeHref} className="group flex h-12 items-center justify-between gap-5 rounded-full bg-[#e96751] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(233,103,81,.2)] transition-all hover:bg-[#d95743]">
                  {session?.authenticated ? "Open workspace" : "Log In and Trade"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a href="/api/deriv/signup" className="flex h-12 items-center justify-center rounded-full border border-[#d5dbe2] bg-white/70 px-6 text-sm font-medium text-[#25364b] transition-colors hover:bg-white">
                  Create Free Account
                </a>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[#e4deda] pt-5 font-mono text-[10px] uppercase tracking-[.16em] text-[#748092]">
                <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-[#159884]" /> Demo first</span>
                <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-[#159884]" /> User-controlled</span>
                <Link href="/analysis" className="text-[#c84c3d] transition-colors hover:text-[#a73c31]">See the workflow <span aria-hidden="true">↗</span></Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[600px] animate-in fade-in slide-in-from-right-4 duration-1000 lg:justify-self-end">
              <div className="absolute -inset-4 rounded-[2.25rem] bg-[#f8d7ce]/65 blur-[1px]" aria-hidden="true" />
              <div className="relative aspect-square overflow-hidden rounded-[1.8rem] border-[9px] border-white bg-[#102945] shadow-[0_25px_70px_rgba(20,36,58,.22)]">
                <img src="/images/protraders-trader-hero.jpg" alt="Trader reviewing live market charts at a workstation" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#08182a]/80 via-transparent to-[#102945]/10" />
                <div className="absolute left-5 right-5 top-5 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2 rounded-full bg-[#0b2844]/75 px-3 py-1.5 backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#56dec4]" />
                    <span className="font-mono text-[9px] uppercase tracking-[.16em]">Live market context</span>
                  </div>
                  <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider backdrop-blur">R_100</span>
                </div>
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-white">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[.18em] text-white/65">Decision before action</div>
                    <div className="mt-1 font-display text-xl tracking-tight">Read the setup clearly.</div>
                  </div>
                  <div className="hidden rounded-xl border border-white/15 bg-[#0b2844]/80 p-2.5 backdrop-blur sm:block">
                    <div className="font-mono text-[8px] uppercase tracking-wider text-white/55">Status</div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-[#6ee2cb]"><span className="h-1.5 w-1.5 rounded-full bg-[#6ee2cb]" /> Ready</div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-4 hidden w-52 rounded-2xl border border-[#d8e5e5] bg-white p-3 shadow-[0_14px_35px_rgba(20,36,58,.14)] sm:block">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#7a8796]">Market pulse</span>
                  <span className={`font-mono text-[10px] font-semibold ${pulseChange == null || pulseChange >= 0 ? "text-[#159884]" : "text-[#c84c3d]"}`}>
                    {pulseChange == null ? "LIVE" : `${pulseChange >= 0 ? "+" : ""}${pulseChange.toFixed(2)}%`}
                  </span>
                </div>
                <div className="mt-1 font-mono text-xl font-bold tracking-tight text-[#162a44]">{pulsePrice ?? "—"}</div>
                <div className="mt-2 h-8 overflow-hidden rounded-md bg-[#f2f8f8]"><PulseChart candles={pulseData?.candles} /></div>
              </div>
            </div>
          </div>
        </section>

         <section className="border-b border-border bg-secondary/5 px-5 py-20 md:px-10 md:py-24">
           <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-20">
             <div>
               <div className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">See the workflow</div>
               <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-4xl">Every entry has a checkpoint.</h2>
               <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                 ProTraders FX keeps analysis, review, execution, and settlement visible. This preview is read-only; a real run starts only from the reviewed trader ticket.
               </p>
               <div className="mt-8 space-y-3">
                 <WorkflowStep number="01" title="Scan the market" text="Compare fresh candles and live contract availability." active />
                 <WorkflowStep number="02" title="Review the proposal" text="Check stake, duration, price, and account before entry." />
                 <WorkflowStep number="03" title="Wait for settlement" text="The next run waits for an authoritative Deriv result." />
               </div>
             </div>
             <div className="grid gap-4 md:grid-cols-[1.1fr_.9fr]">
               <ExecutionPreview symbol={DEFAULT_MARKET_SYMBOL} quote={pulsePrice} />
               <div className="rounded-sm border border-border bg-card p-5">
                 <div className="flex items-center justify-between border-b border-border pb-4">
                   <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                     <Activity className="h-3.5 w-3.5 text-primary" /> Bulk scan
                   </div>
                   <span className="font-mono text-[9px] uppercase tracking-widest text-primary">Live</span>
                 </div>
                 <div className="mt-5 space-y-3">
                   {["R_100", "R_75", "1HZ50V"].map((market, index) => (
                     <div key={market} className={`flex items-center justify-between border-b border-border/70 pb-3 ${index === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                       <div>
                         <div className="font-mono text-xs">{market}</div>
                         <div className="mt-1 text-[10px] uppercase tracking-widest">{index === 0 ? "Selected after scan" : "Candidate market"}</div>
                       </div>
                       <span className={`font-mono text-[10px] ${index === 0 ? "text-primary" : ""}`}>{index === 0 ? "TOP" : `0${index + 2}`}</span>
                     </div>
                   ))}
                 </div>
                 <p className="mt-4 text-[11px] leading-5 text-muted-foreground">Bulk Trader replaces this preview with fresh ranked results after you connect.</p>
                 <Link href="/bulk-trader" className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-foreground transition-colors hover:text-primary">
                   Open Bulk Trader <ChevronRight className="h-3.5 w-3.5" />
                 </Link>
               </div>
             </div>
           </div>
         </section>

        {/* FEATURES GRID */}
        <section className="px-5 py-24 md:px-10 border-b border-border bg-secondary/5">
           <div className="mx-auto max-w-7xl">
            <div className="mb-12 md:mb-16">
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Workspace Capabilities</h2>
            </div>
            
             <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
               <Link href="/analysis" className="group relative bg-card p-8 transition-colors hover:bg-primary/[.055]">
                <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-display text-lg font-medium text-foreground">Market Context</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Inspect live quotes, candles, and deterministic indicators. See the setup clearly before committing capital.
                </p>
              </Link>
              
               <Link href="/dashboard" className="group relative bg-card p-8 transition-colors hover:bg-primary/[.055]">
                <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 text-primary">
                  <TerminalSquare className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-display text-lg font-medium text-foreground">Bounded Execution</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Trade on Demo first. Test setups with controlled stakes and mandatory review steps built into the interface.
                </p>
              </Link>

               <Link href="/bots" className="group relative bg-card p-8 transition-colors hover:bg-primary/[.055]">
                <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-display text-lg font-medium text-foreground">Transparent Bots</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Run transparent, cost-free bot templates. Automation without hiding the underlying market risks.
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* METHODOLOGY SECTION */}
        <section className="px-5 py-24 md:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-24">
              <div>
                <div className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Methodology</div>
                <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-4xl">Engineered for clarity.</h2>
                <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                  Trading platforms often optimize for speed of execution. ProTraders FX optimizes for clarity of decision.
                  We force review steps, prioritize Demo practice, and separate analysis from execution.
                </p>
                <div className="mt-8">
                  <Link href="/course" className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
                    Read our design principles <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="border border-border bg-card p-6 rounded-sm">
                  <LineChart className="mb-4 h-5 w-5 text-primary" />
                  <h3 className="mb-2 font-display text-base font-medium">Context First</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A quote needs history. We provide the recent movement and a written reason before you act.
                  </p>
                </div>
                <div className="border border-border bg-card p-6 rounded-sm">
                  <Crosshair className="mb-4 h-5 w-5 text-primary" />
                  <h3 className="mb-2 font-display text-base font-medium">Visible Boundaries</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Pause points and bounded stakes are baked into the UI, not hidden in settings menus.
                  </p>
                </div>
                <div className="border border-border bg-card p-6 rounded-sm sm:col-span-2">
                  <LockKeyhole className="mb-4 h-5 w-5 text-primary" />
                  <h3 className="mb-2 font-display text-base font-medium">Your Account, Your Call</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                    We surface information and controlled tools. The workspace never promises an outcome or trades without explicit direction.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="border-t border-border bg-secondary/10 px-5 py-24 md:px-10 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Ready to deploy?</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Connect your Deriv account. No premium tiers, no hidden fees.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a href={tradeHref} className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                Connect Workspace <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Advisory only · You control execution
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function MarketTicker() {
  const marketQuery = useDerivMarkets()
  const liveQuote = useGetMarketTicker(marketQuery.defaultSymbol, { query: { queryKey: getGetMarketTickerQueryKey(marketQuery.defaultSymbol), staleTime: 60000, refetchInterval: 60000 } })
  return (
     <div className="relative z-20 flex w-full items-center justify-center overflow-hidden border-b border-sidebar-border bg-sidebar py-2.5 font-mono text-[10px] text-sidebar-foreground/80 shadow-[0_4px_18px_hsl(var(--foreground)/.08)]" aria-label="Live market ticker">
      <div className="flex min-w-max items-center gap-7 px-4">
        {marketQuery.markets.map((market, index) => { 
          const value = index === 0 ? ((liveQuote.data as any)?.quote ?? (liveQuote.data as any)?.price) : undefined; 
          const unavailable = index === 0 && ((liveQuote.data as any)?.available === false || liveQuote.isError); 
          return (
            <div key={market.symbol} className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${unavailable ? "bg-accent" : "bg-primary/75"}`} />
               <span className="uppercase tracking-widest text-sidebar-foreground/50">{market.displayName || market.symbol}</span>
               <span className={unavailable ? "text-accent" : "font-medium tabular-nums text-sidebar-foreground"}>{unavailable ? "offline" : value ?? (index === 0 ? "—" : "")}</span>
            </div>
          ) 
        })}
      </div>
    </div>
  )
}

function WorkflowStep({ number, title, text, active }: { number: string; title: string; text: string; active?: boolean }) {
  return (
    <div className={`flex gap-3 border-l-2 pl-4 ${active ? "border-primary" : "border-border"}`}>
      <span className="font-mono text-[10px] text-primary">{number}</span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{text}</div>
      </div>
    </div>
  )
}

function ExecutionPreview({ symbol, quote }: { symbol: string; quote?: number }) {
  return (
    <div className="rounded-sm border border-primary/25 bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border bg-secondary/20 px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <TerminalSquare className="h-3.5 w-3.5 text-primary" /> Execution preview
        </div>
        <span className="border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-500">Review</span>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Market</div>
            <div className="mt-1 font-mono text-xl">{symbol}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg tabular-nums">{quote ?? "—"}</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Live quote</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PreviewMetric label="Stake" value="1.00 USD" />
          <PreviewMetric label="Duration" value="1 tick" />
          <PreviewMetric label="Account" value="Demo" />
        </div>
        <div className="flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Proposal review required before entry
        </div>
        <Link href={`/create-bot?symbol=${encodeURIComponent(symbol)}&source=demo_preview`} className="flex h-10 items-center justify-center gap-2 rounded-sm bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          Review in Manual Trader <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-secondary/10 p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[10px] text-foreground">{value}</div>
    </div>
  )
}

function PulseChart({ candles }: { candles?: any[] }) {
  const points = Array.isArray(candles) ? candles : []
  const closes = points.map(point => Number(point.close)).filter(Number.isFinite)
  if (closes.length < 2) return <div className="grid h-full place-items-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Waiting for history</div>
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const polyline = points.map((point, index) => `${(index / (points.length - 1)) * 600},${165 - ((Number(point.close) - min) / range) * 135}`).join(" ")
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 180" preserveAspectRatio="none" aria-label="Live candle movement">
      <defs><linearGradient id="chart-fill-live" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="hsl(var(--primary))" stopOpacity=".15" /><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" /></linearGradient></defs>
      <polyline points={polyline} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
