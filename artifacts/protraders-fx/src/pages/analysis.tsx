import { useState } from "react"
import { Activity, ArrowRight, BarChart3, RefreshCw, Radio } from "lucide-react"
import { Link } from "wouter"
import {
  getGetMarketCandlesQueryKey,
  getGetMarketTickerQueryKey,
  useGetMarketCandles,
  useGetMarketTicker,
} from "@workspace/api-client-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatVolatility } from "@/lib/format"

const symbols = ["R_100", "R_75", "R_50", "R_25", "1HZ100V", "1HZ250V"]

export default function Analysis() {
  const [selectedSymbol, setSelectedSymbol] = useState("R_100")
  const ticker = useGetMarketTicker(selectedSymbol, {
    query: { queryKey: getGetMarketTickerQueryKey(selectedSymbol), refetchInterval: 5000 },
  })
  const candles = useGetMarketCandles(selectedSymbol, { count: 60, granularity: 60 }, {
    query: {
      queryKey: getGetMarketCandlesQueryKey(selectedSymbol, { count: 60, granularity: 60 }),
      refetchInterval: 30000,
    },
  })
  const tick = ticker.data as any
  const history = candles.data as any
  const price = tick?.quote ?? tick?.price
  const offline = tick?.available === false || ticker.isError
  const latest = Array.isArray(history?.candles) ? history.candles.at(-1) : undefined

  return (
    <div className="noise-layer min-h-full overflow-hidden bg-background">
      <section className="border-b border-white/[.07] bg-secondary/25 px-5 py-14 md:px-10 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.22em] text-primary">
            <Activity className="h-3.5 w-3.5" /> Analysis tools
          </div>
          <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-[-.05em] md:text-6xl">Analysis tools for clearer decisions.</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Live quotes, recent movement, and transparent volatility context. Review the information before you decide.</p>
            </div>
            <Button asChild variant="outline"><Link href="/course">Learn the process <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-10 md:px-10 md:py-14">
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoTile label="Source" value="Deriv live endpoint" />
          <InfoTile label="Refresh" value={ticker.isFetching ? "Syncing" : "Every 5 seconds"} />
          <InfoTile label="Mode" value="Advisory only" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Card>
            <CardHeader className="border-b bg-secondary/20"><CardTitle className="text-base">Markets</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-3">
              {symbols.map(symbol => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => setSelectedSymbol(symbol)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition-colors ${selectedSymbol === symbol ? "bg-primary/10 text-foreground ring-1 ring-primary/25" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}
                  data-testid={`button-analysis-symbol-${symbol}`}
                >
                  <span className="font-mono">{symbol}</span>
                  {selectedSymbol === symbol && <Radio className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between border-b bg-secondary/20">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5 text-primary" />{selectedSymbol}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Synthetic index · live quote</p>
              </div>
              <Badge variant={offline ? "destructive" : "success"}><Radio className="mr-1 h-3 w-3" />{offline ? "OFFLINE" : "LIVE"}</Badge>
            </CardHeader>
            <CardContent className="space-y-5 p-5 md:p-7">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Current price</div>
                  <div className="mt-2 font-mono text-4xl font-bold">{price ?? "—"}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { ticker.refetch(); candles.refetch() }} disabled={ticker.isFetching && candles.isFetching} aria-label="Refresh analysis">
                  <RefreshCw className={ticker.isFetching || candles.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                </Button>
              </div>

              <CompactChart candles={history?.candles} />

              <div className="grid gap-3 sm:grid-cols-4">
                <DataTile label="Open" value={latest?.open} />
                <DataTile label="High" value={latest?.high} />
                <DataTile label="Low" value={latest?.low} />
                <DataTile label="Close" value={latest?.close} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DataTile label="Volatility" value={history?.indicators ? formatVolatility(history.indicators.volatilityLevel, history.indicators.volatilityPct) : "Not available"} />
                <DataTile label="History" value={candles.isLoading ? "Loading" : history?.candles?.length ? `${history.candles.length} candles` : "Not available"} />
              </div>
              <div className="flex flex-wrap gap-3 border-t border-white/[.08] pt-5">
                <Button asChild><Link href="/markets">Open full market view <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild variant="outline"><Link href="/course">Read the course</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/[.08] bg-card/50 p-4"><div className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">{label}</div><div className="mt-2 text-sm font-semibold">{value}</div></div>
}

function DataTile({ label, value }: { label: string; value: unknown }) {
  const displayValue = value == null || typeof value === "object" ? "—" : String(value)
  return <div className="rounded-lg border border-white/[.08] bg-secondary/35 p-3"><div className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm">{displayValue}</div></div>
}

function CompactChart({ candles }: { candles?: any[] }) {
  const points = Array.isArray(candles) ? candles : []
  const closes = points.map(point => Number(point.close)).filter(Number.isFinite)
  if (closes.length < 2) {
    return <div className="grid h-48 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground">Candle history unavailable</div>
  }
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const polyline = points.map((point, index) => `${(index / (points.length - 1)) * 600},${185 - ((Number(point.close) - min) / range) * 165}`).join(" ")
  return (
    <div className="relative h-48 overflow-hidden rounded-xl border border-white/[.08] bg-background/60 p-2">
      {[25, 50, 75].map(line => <div key={line} className="absolute inset-x-0 border-t border-dashed border-white/[.08]" style={{ top: `${line}%` }} />)}
      <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="relative h-full w-full" aria-label="Recent price movement">
        <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="3" points={polyline} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute left-3 top-3 font-mono text-[10px] text-muted-foreground">{max.toFixed(4)}</div>
      <div className="absolute bottom-3 left-3 font-mono text-[10px] text-muted-foreground">{min.toFixed(4)}</div>
    </div>
  )
}