import { useEffect } from "react"
import { Activity, ArrowRight, ShieldCheck, TerminalSquare, TrendingUp, Lock, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  useGetProtradersPreflight,
  getGetProtradersPreflightQueryKey,
  useGetSessionStatus,
  getGetSessionStatusQueryKey,
  useTrackEvent
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
      {/* Hero Section */}
      <section className="relative px-4 py-24 md:py-32 lg:py-40 overflow-hidden flex-1 flex flex-col justify-center items-center">
        {/* Abstract background grid */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent)'
        }} />
        
        <div className="container relative z-10 max-w-5xl mx-auto text-center space-y-8">
          <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary tracking-wide text-xs mb-4">
            Deriv Connected • Secure Terminal
          </Badge>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground balance-text">
            Disciplined Trading <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Engineered for Focus.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground balance-text font-light leading-relaxed">
            ProTraders FX is a tightly controlled workspace that connects directly to your Deriv account. No noise, no distractions—just pure execution.
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
      <section className="bg-secondary/50 border-t border-border py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                System Preflight
              </h2>
              <p className="text-muted-foreground mt-1">Real-time status of connection endpoints.</p>
            </div>
            <Button variant="outline" size="sm" asChild data-testid="link-readiness">
              <Link href="/readiness" className="gap-2">
                View Full Diagnostics <ArrowRight className="h-4 w-4" />
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
          <p className="mt-10 text-center text-xs text-muted-foreground">
            Public reference for Deriv trading tools:{" "}
            <a
              href="https://www.traderscheme.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              TraderScheme
            </a>
            . ProTraders FX is an independent workspace.
          </p>
        </div>
      </section>
    </div>
  )
}
