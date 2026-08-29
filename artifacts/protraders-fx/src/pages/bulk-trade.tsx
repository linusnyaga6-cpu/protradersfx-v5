import { useState } from "react"
import { Layers3, Loader2 } from "lucide-react"
import {
  getGetAccountQueryKey,
  getGetMarketCandlesQueryKey,
  getGetMarketTickerQueryKey,
  getGetProtradersPreflightQueryKey,
  getGetSessionStatusQueryKey,
  useCreateTrade,
  useGetAccount,
  useGetMarketCandles,
  useGetMarketTicker,
  useGetProtradersPreflight,
  useGetSessionStatus,
} from "@workspace/api-client-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AccountStrip } from "@/components/trading/account-strip"
import { formatMoney, formatVolatility } from "@/lib/format"

export default function BulkTrade() {
  const bestMarket = "R_100"
  const [stake, setStake] = useState("10")
  const [duration, setDuration] = useState("5")
  const [direction, setDirection] = useState<"CALL" | "PUT">("CALL")
  const [results, setResults] = useState<any[]>([])
  const createTrade = useCreateTrade()
  const { data: session } = useGetSessionStatus({ query: { queryKey: getGetSessionStatusQueryKey() } })
  const preflight = useGetProtradersPreflight({ query: { queryKey: getGetProtradersPreflightQueryKey() } })
  const account = useGetAccount({
    query: {
      queryKey: getGetAccountQueryKey(),
      enabled: !!session?.authenticated,
      refetchInterval: 5000,
    },
  })
  const accountCurrency = account.data?.currency || "USD"
  const canRun = Boolean(session?.authenticated && account.data?.accountType === "demo" && preflight.data?.tradingEnabled && preflight.data?.demoOnly)
  const ticker = useGetMarketTicker(bestMarket, { query: { queryKey: getGetMarketTickerQueryKey(bestMarket), refetchInterval: 5000 } })
  const candles = useGetMarketCandles(bestMarket, { count: 60, granularity: 60 }, { query: { queryKey: getGetMarketCandlesQueryKey(bestMarket, { count: 60, granularity: 60 }), refetchInterval: 30000 } })
  const marketData = candles.data as any
  const marketQuote = (ticker.data as any)?.quote ?? (ticker.data as any)?.price
  const marketOffline = ticker.isError || (ticker.data as any)?.available === false

  const executeBatch = async () => {
    if (!canRun) return
    setResults([])
    try {
      const result = await createTrade.mutateAsync({
        data: {
          symbol: bestMarket,
          contract_type: direction,
          stake: Number(stake),
          duration: Number(duration),
          source: "bulk",
          request_label: "Best market order",
        } as any,
      })
      setResults([{ symbol: bestMarket, ok: result.ok, status: result.status, message: result.message }])
    } catch (error) {
      setResults([{ symbol: bestMarket, ok: false, message: error instanceof Error ? error.message : "Order rejected" }])
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.22em] text-primary">Bulk</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bulk trader</h1>
        </div>
        <Badge variant={account.data?.accountType === "real" ? "destructive" : "outline"}>
          {account.data?.accountType === "real" ? "Real account" : "Demo account"}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
           <CardHeader className="border-b bg-secondary/10">
             <CardTitle className="flex items-center gap-2 text-lg"><Layers3 className="h-5 w-5 text-primary" />Best market</CardTitle>
          </CardHeader>
           <CardContent className="space-y-4 p-5">
             <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
               <div><div className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Live market to review</div><div className="mt-1 font-mono text-2xl font-semibold">{bestMarket}</div></div>
               <Badge variant={marketOffline ? "destructive" : "success"}>{marketOffline ? "OFFLINE" : "LIVE"}</Badge>
             </div>
             <div className="grid grid-cols-2 gap-2">
               <MarketMetric label="Quote" value={marketQuote == null ? "Unavailable" : String(marketQuote)} />
               <MarketMetric label="Volatility" value={marketData?.indicators ? formatVolatility(marketData.indicators.volatilityLevel, marketData.indicators.volatilityPct) : "Unavailable"} />
             </div>
             <p className="text-xs leading-5 text-muted-foreground">One market is shown here to keep bulk review focused. “Best” means the configured market view, not a guaranteed outcome.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-lg">Order</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="bulk-stake">Stake ({accountCurrency})</Label>
              <Input id="bulk-stake" type="number" min="0.01" step="0.01" value={stake} onChange={event => setStake(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-duration">Duration</Label>
              <Input id="bulk-duration" type="number" min="1" step="1" value={duration} onChange={event => setDuration(event.target.value)} />
            </div>
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
               <div className="flex justify-between"><span className="text-muted-foreground">Market</span><span className="font-mono">{bestMarket}</span></div>
               <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Total stake</span><span>{formatMoney(Number(stake || 0), accountCurrency)}</span></div>
            </div>
             <Button className="w-full" onClick={executeBatch} disabled={!canRun || createTrade.isPending} data-testid="button-execute-bulk">
              {createTrade.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               {account.data?.accountType === "real" ? "Demo account required" : "Run best market"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card data-testid="card-bulk-results">
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-base">Results</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {results.map((result: any) => (
              <div key={result.symbol} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="font-mono">{result.symbol}</span>
                <span className={result.ok ? "text-success" : "text-destructive"}>{result.ok ? result.status || "accepted" : result.message || "rejected"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MarketMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-secondary/35 p-3"><div className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm">{value}</div></div>
}