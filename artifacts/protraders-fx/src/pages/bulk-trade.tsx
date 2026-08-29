import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
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
import { ALL_MARKET_SYMBOLS } from "@/lib/markets"

export default function BulkTrade() {
  const [selectedMarket, setSelectedMarket] = useState("R_100")
  const [stake, setStake] = useState("10")
  const [duration, setDuration] = useState("5")
  const [batchSize, setBatchSize] = useState("3")
  const [results, setResults] = useState<any[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const createTrade = useCreateTrade()
  const queryClient = useQueryClient()
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
  const ticker = useGetMarketTicker(selectedMarket, { query: { queryKey: getGetMarketTickerQueryKey(selectedMarket), refetchInterval: 5000 } })
  const candles = useGetMarketCandles(selectedMarket, { count: 60, granularity: 60 }, { query: { queryKey: getGetMarketCandlesQueryKey(selectedMarket, { count: 60, granularity: 60 }), refetchInterval: 30000 } })
  const marketData = candles.data as any
  const marketQuote = (ticker.data as any)?.quote ?? (ticker.data as any)?.price
  const marketOffline = ticker.isError || (ticker.data as any)?.available === false

  const requestedBatchSize = Math.min(10, Math.max(1, Math.floor(Number(batchSize) || 0)))
  const validOrder = Number(stake) > 0 && Number(duration) > 0 && Number.isInteger(Number(duration)) && Number.isInteger(Number(batchSize)) && Number(batchSize) >= 1 && Number(batchSize) <= 10
  const executeBatch = async () => {
    if (!canRun || !validOrder || isRunning) return
    const count = requestedBatchSize
    setIsRunning(true)
    setResults(Array.from({ length: count }, (_, index) => ({
      id: index,
             symbol: selectedMarket,
      ok: null,
      status: "queued",
      message: `Waiting for entry ${index + 1} of ${count}`,
    })))

    for (let index = 0; index < count; index += 1) {
      setResults(current => current.map(item => item.id === index ? { ...item, status: "sending", message: "Submitting demo order..." } : item))
      try {
        // Bulk execution intentionally reuses the reviewed demo contract path one entry at a time.
        // The contract type remains server-compatible while direction controls stay out of the UI.
        const result = await createTrade.mutateAsync({
          data: {
            symbol: selectedMarket,
            contract_type: "CALL",
            stake: Number(stake),
            duration: Number(duration),
            source: "bulk",
             request_label: `${selectedMarket} batch entry ${index + 1} of ${count}`,
          } as any,
        })
        setResults(current => current.map(item => item.id === index ? {
          ...item,
          ok: result.ok,
           status: result.ok ? "accepted" : (result.status || "rejected"),
          message: result.message || (result.ok ? "Demo order accepted" : "Order rejected"),
        } : item))
      } catch (error) {
        setResults(current => current.map(item => item.id === index ? {
          ...item,
          ok: false,
          status: "rejected",
          message: error instanceof Error ? error.message : "Order rejected",
        } : item))
      }
    }
    setIsRunning(false)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetSessionStatusQueryKey() }),
    ])
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />

       <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.22em] text-primary">Bulk</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bulk trader</h1>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
           <CardHeader className="border-b bg-secondary/10">
             <CardTitle className="flex items-center gap-2 text-lg"><Layers3 className="h-5 w-5 text-primary" />Market selection</CardTitle>
          </CardHeader>
           <CardContent className="space-y-4 p-5">
               <div className="space-y-2">
                 <Label htmlFor="bulk-market">Market</Label>
                 <select id="bulk-market" value={selectedMarket} onChange={event => setSelectedMarket(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm" data-testid="select-bulk-market">
                   {ALL_MARKET_SYMBOLS.map(symbol => <option key={symbol} value={symbol}>{symbol}</option>)}
                 </select>
               </div>
               <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div><div className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Live market to review</div><div className="mt-1 font-mono text-2xl font-semibold">{selectedMarket}</div></div>
               <Badge variant={marketOffline ? "destructive" : "success"}>{marketOffline ? "OFFLINE" : "LIVE"}</Badge>
             </div>
             <div className="grid grid-cols-2 gap-2">
               <MarketMetric label="Quote" value={marketQuote == null ? "Unavailable" : String(marketQuote)} />
               <MarketMetric label="Volatility" value={marketData?.indicators ? formatVolatility(marketData.indicators.volatilityLevel, marketData.indicators.volatilityPct) : "Unavailable"} />
             </div>
              <p className="text-xs leading-5 text-muted-foreground">All supported markets are available for review. Select one market per sequential batch; “live” reflects the current Deriv response, not a guaranteed outcome.</p>
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
             <div className="space-y-2">
               <Label htmlFor="bulk-size">Demo batch entries</Label>
               <Input id="bulk-size" type="number" min="1" max="10" step="1" value={batchSize} onChange={event => setBatchSize(event.target.value)} />
               <p className="text-xs leading-5 text-muted-foreground">Runs up to 10 reviewed demo entries sequentially so every result is visible.</p>
             </div>
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Market</span><span className="font-mono">{selectedMarket}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Entries</span><span>{requestedBatchSize}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Total stake</span><span>{formatMoney(Number(stake || 0) * requestedBatchSize, accountCurrency)}</span></div>
            </div>
              {!validOrder && <p className="text-xs text-destructive">Enter a positive stake, whole-number duration, and at least one batch entry.</p>}
              <Button className="w-full" onClick={executeBatch} disabled={!canRun || !validOrder || isRunning || marketOffline} data-testid="button-execute-bulk">
               {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRunning ? "Running reviewed batch..." : "Run reviewed batch"}
            </Button>
              <p className="text-[11px] leading-5 text-muted-foreground">Every entry uses the protected trade flow. Entries are marked accepted only after Deriv confirms the request; settlement values appear only when Deriv reports them.</p>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card data-testid="card-bulk-results">
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-base">Results</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
             {results.map((result: any) => (
               <div key={result.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                 <div>
                   <div className="font-mono">{result.symbol} · entry {result.id + 1}</div>
                   <div className="mt-1 text-xs text-muted-foreground">{result.message}</div>
                 </div>
                 <span className={result.ok === true ? "text-success" : result.ok === false ? "text-destructive" : "text-muted-foreground"}>{result.status || "queued"}</span>
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