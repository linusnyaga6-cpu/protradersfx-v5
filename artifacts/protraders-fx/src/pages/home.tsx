import { useEffect } from "react"
import { ArrowRight, ShieldCheck, TerminalSquare, TrendingUp, Lock, Zap, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
    <div className="flex flex-col min-h-full">
      <MarketTicker />
      {/* Hero Section */}
      <section className="relative px-4 py-20 md:py-28 lg:py-32 overflow-hidden flex-1 flex flex-col justify-center items-center">
        {/* Abstract background grid */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent)'
        }} />
        
        <div className="container relative z-10 max-w-5xl mx-auto text-center space-y-8">
          <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary tracking-wide text-xs mb-4">
            Deriv workspace
          </Badge>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground balance-text">
            Trade with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">focus.</span>
          </h1>
          
          <p className="max-w-xl mx-auto text-base md:text-lg text-muted-foreground balance-text font-light leading-relaxed">
            Markets, bots, and risk controls in one focused terminal.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            {loadingSession ? (
              <Skeleton className="h-12 w-48 rounded-md" />
            ) : session?.authenticated ? (
              <Button size="xl" asChild className="gap-2 group shadow-xl shadow-primary/20" data-testid="hero-dashboard-btn">
                <Link href="/dashboard">
                  Enter Workspace
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            ) : (
              <Button size="xl" asChild className="gap-2 group shadow-xl shadow-primary/20" data-testid="hero-login-btn">
                <a href="/api/deriv/login">
                  Connect via Deriv
                  <TerminalSquare className="h-5 w-5 ml-1" />
                </a>
              </Button>
            )}
            
            {!session?.authenticated && (
              <Button size="xl" variant="outline" asChild className="gap-2" data-testid="hero-signup-btn">
                <a href="/api/deriv/signup">
                  Create Account
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Deployment Status Section */}
      <section className="bg-secondary/50 border-t border-border py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <div>
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                  System status
              </h2>
              <p className="text-muted-foreground mt-1">Live endpoint checks.</p>
            </div>
            <Button variant="outline" size="sm" asChild data-testid="link-readiness">
              <Link href="/readiness" className="gap-2">
                View diagnostics <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-background shadow-sm">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">OAuth Configured</h3>
                  <p className="text-sm text-muted-foreground mt-1">Secure authentication tunnel</p>
                </div>
                {loadingPreflight ? (
                  <Skeleton className="h-6 w-16 mt-2" />
                ) : (
                  <Badge variant={preflight?.oauthClientConfigured ? "success" : "destructive"}>
                    {preflight?.oauthClientConfigured ? "VERIFIED" : "PENDING"}
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card className="bg-background shadow-sm">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Trading Engine</h3>
                  <p className="text-sm text-muted-foreground mt-1">Live execution status</p>
                </div>
                {loadingPreflight ? (
                  <Skeleton className="h-6 w-16 mt-2" />
                ) : (
                  <Badge variant={preflight?.tradingEnabled ? "success" : "destructive"}>
                    {preflight?.tradingEnabled ? "ONLINE" : "DISABLED"}
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card className="bg-background shadow-sm">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Environment</h3>
                  <p className="text-sm text-muted-foreground mt-1">Current operation mode</p>
                </div>
                {loadingPreflight ? (
                  <Skeleton className="h-6 w-16 mt-2" />
                ) : (
                  <Badge variant={preflight?.executionMode === "BOTH" ? "success" : "secondary"} className={preflight?.executionMode !== "BOTH" ? "bg-amber-500/10 text-amber-700 dark:text-amber-500 border-transparent" : ""}>
                    {preflight?.executionMode || "CHECKING"}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}

const tickerSymbols = ["R_100", "R_75", "R_50", "R_25", "1HZ100V", "BOOM_500"]

function MarketTicker() {
  const liveQuote = useGetMarketTicker("R_100", {
    query: {
      queryKey: getGetMarketTickerQueryKey("R_100"),
      staleTime: 60000,
      refetchInterval: 60000
    }
  })

  return (
    <section className="overflow-hidden border-b bg-sidebar text-sidebar-foreground" aria-label="Live market ticker">
      <div className="flex min-w-max items-center gap-6 px-4 py-2 text-[11px] md:justify-center">
        {tickerSymbols.map((symbol, index) => {
          const value = index === 0 ? ((liveQuote.data as any)?.quote ?? (liveQuote.data as any)?.price) : undefined
          return (
            <div key={symbol} className="flex items-center gap-2 font-mono">
              <Radio className={`h-3 w-3 ${index === 0 && liveQuote.isError ? "text-destructive" : "text-sidebar-primary"}`} />
              <span className="font-sans text-sidebar-foreground/70">{symbol}</span>
              <span className={index === 0 && liveQuote.isError ? "text-destructive" : "text-sidebar-primary"}>{value ?? (index === 0 ? "—" : "watch")}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
