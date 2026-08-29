import { useEffect } from "react"
import { ArrowRight, ShieldCheck, TerminalSquare, TrendingUp, Lock, Zap, Radio, Activity, BarChart3, Bot, Camera, CircleAlert, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  useGetProtradersPreflight,
  getGetProtradersPreflightQueryKey,
  useGetSessionStatus,
  getGetSessionStatusQueryKey,
  useTrackEvent,
  useGetMarketTicker,
  getGetMarketTickerQueryKey
} from "@workspace/api-client-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "wouter"

export default function Home() {
  const { data: preflight, isLoading: loadingPreflight } = useGetProtradersPreflight({
    query: { queryKey: getGetProtradersPreflightQueryKey() }
  })
  const { data: session, isLoading: loadingSession } = useGetSessionStatus({
    query: { queryKey: getGetSessionStatusQueryKey() }
  })
  const trackEvent = useTrackEvent()

  useEffect(() => {
    trackEvent.mutate({ data: { type: "page_view", path: "/" } })
  }, [])

  return (
    <div className="flex flex-col min-h-full w-full">
      <MarketTicker />
      
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center min-h-[80vh] px-4 py-20 text-center overflow-hidden border-b border-white/5">
        {/* Deep atmospheric glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        
        {/* Subtle grid */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)'
        }} />

        <div className="container relative z-10 max-w-4xl mx-auto px-6 space-y-8 mt-[-4rem]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest mb-2 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
             Trade like a pro.
          </div>
          
           <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground balance-text">
             Trade <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">like a pro.</span>
           </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
            Live market context, bot templates, and visible risk boundaries. A focused environment built for discipline, devoid of noise.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            {loadingSession ? (
              <Skeleton className="h-12 w-48 rounded-md bg-white/5" />
            ) : session?.authenticated ? (
              <Button size="xl" asChild className="gap-2 group shadow-[0_0_30px_rgba(var(--primary),0.2)] hover:shadow-[0_0_40px_rgba(var(--primary),0.3)] transition-shadow bg-primary text-primary-foreground border-transparent" data-testid="hero-dashboard-btn">
                <Link href="/dashboard">
                   Trade like a pro
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            ) : (
              <Button size="xl" asChild className="gap-2 group shadow-[0_0_30px_rgba(var(--primary),0.2)] hover:shadow-[0_0_40px_rgba(var(--primary),0.3)] transition-shadow bg-primary text-primary-foreground border-transparent" data-testid="hero-login-btn">
                <a href="/api/deriv/login">
                  Log In
                  <TerminalSquare className="h-5 w-5 ml-1 opacity-80" />
                </a>
              </Button>
            )}
            
            {!session?.authenticated && (
              <Button size="xl" variant="outline" asChild className="gap-2 border-white/10 hover:bg-white/5" data-testid="hero-signup-btn">
                <a href="/api/deriv/signup">
                  Create Account
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {session?.authenticated && <>{/* Tool Directory */}
      <section className="py-24 px-6 bg-background relative z-10 border-b border-white/5">
        <div className="container max-w-5xl mx-auto">
          <div className="flex flex-col items-start justify-between gap-4 border-b border-white/5 pb-8 sm:flex-row sm:items-end">
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.28em] text-primary">Workspace tools</div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground/90">Choose your next move.</h2>
            </div>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground sm:text-right">Open a focused workspace. Review first, execute only when enabled.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {toolCards.map(({ title, description, href, icon: Icon, eyebrow }) => (
              <Link
                key={href}
                href={href}
                className="group relative rounded-2xl border border-white/5 bg-card/30 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:bg-card/80 hover:shadow-[0_18px_50px_rgba(0,0,0,.16)]"
                data-testid={`card-tool-${title.toLowerCase().replaceAll(" ", "-")}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <div className="mt-7 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</div>
                <h3 className="mt-2 text-lg font-semibold text-foreground/90">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section></>}

      {/* Deployment Status Section */}
      {session?.authenticated && <section className="bg-background py-24 px-6 relative overflow-hidden">
        {/* Subtle bottom glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-primary/5 blur-[100px] pointer-events-none rounded-t-full" />
        
        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-12 border-b border-white/5 pb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2 text-foreground/90">System Telemetry</h2>
              <p className="text-muted-foreground text-sm">Live endpoint checks and environment readiness.</p>
            </div>
            <Button variant="outline" size="sm" asChild className="border-white/10 hover:bg-white/5 font-mono text-xs tracking-wide" data-testid="link-readiness">
              <Link href="/readiness" className="gap-2">
                <Activity className="h-3.5 w-3.5" />
                View diagnostics
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-5 rounded-xl border border-white/5 bg-card/40">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground/80">OAuth Tunnel</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">auth_config</div>
                </div>
              </div>
              <div>
                {loadingPreflight ? (
                  <Skeleton className="h-6 w-16 bg-white/5" />
                ) : (
                  <Badge variant="outline" className={preflight?.oauthClientConfigured ? "border-success/30 text-success bg-success/10" : "border-destructive/30 text-destructive bg-destructive/10"}>
                    {preflight?.oauthClientConfigured ? "VERIFIED" : "PENDING"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-5 rounded-xl border border-white/5 bg-card/40">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground/80">Trading Engine</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">exec_state</div>
                </div>
              </div>
              <div>
                {loadingPreflight ? (
                  <Skeleton className="h-6 w-16 bg-white/5" />
                ) : (
                  <Badge variant="outline" className={preflight?.tradingEnabled ? "border-success/30 text-success bg-success/10" : "border-destructive/30 text-destructive bg-destructive/10"}>
                    {preflight?.tradingEnabled ? "ONLINE" : "DISABLED"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-5 rounded-xl border border-white/5 bg-card/40">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground/80">Environment</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">op_mode</div>
                </div>
              </div>
              <div>
                {loadingPreflight ? (
                  <Skeleton className="h-6 w-16 bg-white/5" />
                ) : (
                  <Badge variant="outline" className={preflight?.executionMode === "BOTH" ? "border-success/30 text-success bg-success/10" : "border-amber-500/30 text-amber-500 bg-amber-500/10"}>
                    {preflight?.executionMode || "CHECKING"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>}
    </div>
  )
}

const tickerSymbols = ["R_100", "R_75", "R_50", "R_25", "1HZ100V", "BOOM_500"]

const toolCards = [
  { title: "Manual Trade", eyebrow: "Execution", description: "Set one controlled trade with visible limits.", href: "/dashboard", icon: TrendingUp },
  { title: "AI Scanner", eyebrow: "Analysis", description: "Inspect quotes, candles, and transparent advisory signals.", href: "/markets", icon: Activity },
  { title: "Bulk Trade", eyebrow: "Review queue", description: "Build a multi-market batch for review before action.", href: "/bulk-trade", icon: BarChart3 },
  { title: "Free Bots", eyebrow: "Observation", description: "Start with no-cost dry-run templates and a visual builder.", href: "/bots", icon: Bot },
  { title: "Recovery Bot", eyebrow: "Guardrails", description: "Build a bounded pause-and-review recovery observer.", href: "/bots", icon: CircleAlert },
  { title: "Recovery", eyebrow: "Advisory", description: "Review incidents and request a human-reviewed explanation.", href: "/recovery", icon: CircleAlert },
  { title: "Snapshots", eyebrow: "Checkpoints", description: "Capture server-verified account context before changes.", href: "/snapshots", icon: Camera },
  { title: "Readiness", eyebrow: "System", description: "Check OAuth, trading gates, and environment status.", href: "/readiness", icon: Settings2 },
]

function MarketTicker() {
  const liveQuote = useGetMarketTicker("R_100", {
    query: {
      queryKey: getGetMarketTickerQueryKey("R_100"),
      staleTime: 60000,
      refetchInterval: 60000
    }
  })

  return (
    <div className="w-full border-b border-white/5 bg-card/50 text-xs font-mono py-2 overflow-hidden flex items-center justify-center relative z-20 shadow-sm" aria-label="Live market ticker">
      <div className="flex min-w-max items-center gap-8 px-4 md:justify-center animate-in fade-in duration-1000">
        {tickerSymbols.map((symbol, index) => {
          const value = index === 0 ? ((liveQuote.data as any)?.quote ?? (liveQuote.data as any)?.price) : undefined
          const unavailable = index === 0 && ((liveQuote.data as any)?.available === false || liveQuote.isError)
          return (
            <div key={symbol} className="flex items-center gap-2.5">
              <Radio className={`h-3 w-3 ${unavailable ? "text-amber-500" : "text-primary/70"}`} />
              <span className="text-muted-foreground">{symbol}</span>
              <span className={unavailable ? "text-amber-500 font-medium" : "text-foreground font-medium"}>
                {unavailable ? "offline" : value ?? (index === 0 ? "—" : "watch")}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
