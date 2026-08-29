import { useEffect } from "react"
import { ArrowRight, TerminalSquare, Radio, Activity, BarChart3, Bot, CircleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  useGetSessionStatus,
  getGetSessionStatusQueryKey,
  useTrackEvent,
  useGetMarketTicker,
  getGetMarketTickerQueryKey
} from "@workspace/api-client-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "wouter"

export default function Home() {
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
             Built for focused execution
          </div>
          
           <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground balance-text">
             Trade <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">like a pro.</span>
           </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
            Live prices, controlled bots, and clear risk limits.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            {loadingSession ? (
              <Skeleton className="h-12 w-48 rounded-md bg-white/5" />
            ) : session?.authenticated ? (
              <Button size="xl" asChild className="gap-2 group shadow-[0_0_30px_rgba(var(--primary),0.2)] hover:shadow-[0_0_40px_rgba(var(--primary),0.3)] transition-shadow bg-primary text-primary-foreground border-transparent" data-testid="hero-dashboard-btn">
                <Link href="/dashboard">
                   Open terminal
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

    </div>
  )
}

const tickerSymbols = ["R_100", "R_75", "R_50", "R_25", "1HZ100V", "BOOM_500"]

const toolCards = [
  { title: "AI Scanner", eyebrow: "Analysis", description: "Inspect quotes, candles, and transparent advisory signals.", href: "/markets", icon: Activity },
  { title: "Bulk Trade", eyebrow: "Review queue", description: "Build a multi-market batch for review before action.", href: "/bulk-trade", icon: BarChart3 },
  { title: "Free Bots", eyebrow: "Observation", description: "Start with no-cost dry-run templates and a visual builder.", href: "/bots", icon: Bot },
  { title: "Recovery Bot", eyebrow: "Guardrails", description: "Build a bounded pause-and-review recovery observer.", href: "/bots", icon: CircleAlert },
  { title: "Recovery", eyebrow: "Advisory", description: "Review incidents and request a human-reviewed explanation.", href: "/recovery", icon: CircleAlert },
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
