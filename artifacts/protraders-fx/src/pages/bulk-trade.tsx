import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Layers3 } from "lucide-react"
import {
  getGetAccountQueryKey,
  getGetMarketCandlesQueryKey,
  getGetMarketTickerQueryKey,
  getGetMarketContractsQueryKey,
  getGetProtradersPreflightQueryKey,
  getGetSessionStatusQueryKey,
  useGetAccount,
  useGetMarketCandles,
  useGetMarketTicker,
  useGetMarketContracts,
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
import { CONTRACT_LABELS, DEFAULT_MARKET_SYMBOL, marketLabel } from "@/lib/markets"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"
import { useTradingRunSession } from "@/hooks/use-trading-run-session"
import { RunSessionSummary } from "@/components/trading/run-session-summary"

export default function BulkTrade() {
  const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search)
  const [selectedMarket, setSelectedMarket] = useState(requested?.get("symbol") || DEFAULT_MARKET_SYMBOL)
  const [contractType, setContractType] = useState(requested?.get("contract") || "DIGITOVER")
  const [barrier, setBarrier] = useState("5")
  const [stopLoss, setStopLoss] = useState("1")
  const [stake, setStake] = useState("1")
  const [runCount, setRunCount] = useState("1")
  const [takeProfit, setTakeProfit] = useState("1")
  const [availabilityNotice, setAvailabilityNotice] = useState("")
  const [duration, setDuration] = useState("1")
  const queryClient = useQueryClient()
  const marketQuery = useDerivMarkets()
  const marketGroups = useMemo(() => {
    const groups = new Map<string, typeof marketQuery.markets>()
    for (const market of marketQuery.markets) {
      const key = market.submarketDisplayName || market.marketDisplayName || "Deriv markets"
      groups.set(key, [...(groups.get(key) || []), market])
    }
    return [...groups.entries()]
  }, [marketQuery.markets])
  useEffect(() => {
    if (marketQuery.markets.length && !marketQuery.markets.some(item => item.symbol === selectedMarket)) {
      setSelectedMarket(marketQuery.defaultSymbol)
    }
  }, [marketQuery.markets, marketQuery.defaultSymbol, selectedMarket])
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
  const availableBalance = Number(account.data?.balance)
  const canRun = Boolean(session?.authenticated && account.data?.accountType === "demo" && preflight.data?.tradingEnabled && preflight.data?.demoOnly)
  const tradeSource = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "ai_assisted"
    ? "ai_assisted" as const
    : "manual" as const
  const runSession = useTradingRunSession(
    `protraders-run-session:${tradeSource}`,
    () => { queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() }) },
  )
  const ticker = useGetMarketTicker(selectedMarket, { query: { queryKey: getGetMarketTickerQueryKey(selectedMarket), refetchInterval: 15000 } })
  const candles = useGetMarketCandles(selectedMarket, { count: 60, granularity: 60 }, { query: { queryKey: getGetMarketCandlesQueryKey(selectedMarket, { count: 60, granularity: 60 }), refetchInterval: 30000 } })
  const marketData = candles.data as any
  const marketQuote = (ticker.data as any)?.quote ?? (ticker.data as any)?.price
  const marketOffline = ticker.isError || (ticker.data as any)?.available === false
  const contracts = useGetMarketContracts(selectedMarket, {
    query: {
      queryKey: getGetMarketContractsQueryKey(selectedMarket),
      enabled: Boolean(selectedMarket),
      staleTime: 60_000,
    },
  })
  const availableTypes = Array.isArray((contracts.data as any)?.availableContractTypes)
    ? (contracts.data as any).availableContractTypes.filter((item: string) => CONTRACT_LABELS[item])
    : []
  useEffect(() => {
    if (
      contracts.data
      && !contracts.isLoading
      && !contracts.isError
      && availableTypes.length === 0
      && selectedMarket !== DEFAULT_MARKET_SYMBOL
      && marketQuery.markets.some(item => item.symbol === DEFAULT_MARKET_SYMBOL)
    ) {
      setAvailabilityNotice(`${selectedMarket} currently has no supported Deriv contracts. Switched to ${DEFAULT_MARKET_SYMBOL}.`)
      setSelectedMarket(DEFAULT_MARKET_SYMBOL)
    }
  }, [contracts.data, contracts.isLoading, contracts.isError, availableTypes.length, selectedMarket, marketQuery.markets])
  useEffect(() => {
    if (availableTypes.length && !availableTypes.includes(contractType)) setContractType(availableTypes[0])
  }, [availableTypes.join("|"), contractType])
  const needsBarrier = Boolean(CONTRACT_LABELS[contractType]?.needsBarrier)

  const totalRuns = Number(runCount)
  const targetProfit = Number(takeProfit)
  const validInputs = Number.isInteger(totalRuns)
    && totalRuns >= 1
    && totalRuns <= 100
    && Number.isFinite(targetProfit)
    && targetProfit > 0
    && Number.isFinite(availableBalance)
    && availableBalance > 0
    && Number(stake) > 0
    && Number(stake) < availableBalance
    && Number(stopLoss) > 0
    && Number(duration) > 0
    && Number(duration) <= Number(preflight.data?.maxDuration || 3600)
    && Number.isInteger(Number(duration))
    && (!needsBarrier || /^[0-9]$/.test(barrier))
  const validOrder = validInputs && availableTypes.includes(contractType)
  const orderData = {
    symbol: selectedMarket, contract_type: contractType,
    ...(needsBarrier ? { barrier } : {}), stop_loss: Number(stopLoss),
    stake: Number(stake), duration: Number(duration), source: tradeSource,
    request_label: `${selectedMarket} ${tradeSource === "ai_assisted" ? "scanner-assisted" : "manual"} order`,
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />

       <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.22em] text-primary">Bot builder</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Create Bot</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Configure a reusable, user-started bot session. For the two-input quick-run experience, open Bulk Trader.</p>
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
                  <select id="bulk-market" value={selectedMarket} onChange={event => setSelectedMarket(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" data-testid="select-bulk-market">
                    {marketGroups.map(([group, markets]) => (
                      <optgroup key={group} label={group}>
                        {markets.map(market => <option key={market.symbol} value={market.symbol}>{marketLabel(market, market.symbol)}</option>)}
                      </optgroup>
                    ))}
                 </select>
                  {marketQuery.isLoading && <p className="text-xs text-muted-foreground">Loading active markets from Deriv…</p>}
                  {marketQuery.isError && <p className="text-xs text-destructive">Deriv market discovery is unavailable.</p>}
                   {availabilityNotice && <p className="text-xs text-amber-600">{availabilityNotice}</p>}
               </div>
               <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                 <div><div className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Live market to review</div><div className="mt-1 text-xl font-semibold">{marketLabel(marketQuery.markets.find(item => item.symbol === selectedMarket), selectedMarket)}</div></div>
               <Badge variant={marketOffline ? "destructive" : "success"}>{marketOffline ? "OFFLINE" : "LIVE"}</Badge>
             </div>
             <div className="grid grid-cols-2 gap-2">
               <MarketMetric label="Quote" value={marketQuote == null ? "Unavailable" : String(marketQuote)} />
               <MarketMetric label="Volatility" value={marketData?.indicators ? formatVolatility(marketData.indicators.volatilityLevel, marketData.indicators.volatilityPct) : "Unavailable"} />
             </div>
               <p className="text-xs leading-5 text-muted-foreground">All standard and 1-second volatility families are listed. Quotes, candles, contract types, and every order are validated live by Deriv for the selected symbol.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-lg">Order</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>Trading type</Label>
              <div className="grid grid-cols-2 gap-2" data-testid="contract-type-grid">
                {availableTypes.map((type: string) => (
                  <Button key={type} type="button" variant={contractType === type ? "default" : "outline"} onClick={() => setContractType(type)} data-testid={`button-contract-${type}`}>
                    {CONTRACT_LABELS[type]?.action || type}
                  </Button>
                ))}
              </div>
              {contracts.isLoading && <p className="text-xs text-muted-foreground">Checking contracts offered by Deriv…</p>}
              {!contracts.isLoading && !availableTypes.length && <p className="text-xs text-destructive">No supported contracts are currently offered for this symbol.</p>}
            </div>
            {needsBarrier && (
              <div className="space-y-2">
                <Label>Digit barrier</Label>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }, (_, digit) => String(digit)).map(digit => (
                    <Button key={digit} type="button" size="sm" variant={barrier === digit ? "default" : "outline"} onClick={() => setBarrier(digit)} data-testid={`button-barrier-${digit}`}>{digit}</Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="bulk-stake">Stake ({accountCurrency})</Label>
              <Input id="bulk-stake" type="number" min="0.01" step="0.01" value={stake} onChange={event => setStake(event.target.value)} />
              <p className="text-xs text-muted-foreground">Trader-entered amount, independent of the selected market and contract type. It must remain below the available account balance.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-stop-loss">Stop loss ({accountCurrency})</Label>
              <Input id="bulk-stop-loss" type="number" min="0.01" step="0.01" value={stopLoss} onChange={event => setStopLoss(event.target.value)} />
              <p className="text-xs leading-5 text-muted-foreground">Applied to each accepted contract through Deriv’s contract-update API. Any provider rejection is shown in the result.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-run-count">Number of runs</Label>
                <Input id="bulk-run-count" type="number" min="1" max="100" step="1" value={runCount} onChange={event => setRunCount(event.target.value)} />
                <p className="text-xs text-muted-foreground">Run Bot obtains a fresh provider proposal automatically before every bounded run.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-take-profit">Take-profit target ({accountCurrency})</Label>
                <Input id="bulk-take-profit" type="number" min="0.01" step="0.01" value={takeProfit} onChange={event => setTakeProfit(event.target.value)} />
                <p className="text-xs text-muted-foreground">Stops future runs after Deriv reports cumulative settled profit at or above this target.</p>
              </div>
            </div>
             <div className="space-y-2">
              <Label htmlFor="bulk-duration">Ticks before expiry</Label>
              <div className="grid grid-cols-4 gap-2">
                {["1", "2", "3", "5"].map(ticks => <Button key={ticks} type="button" size="sm" variant={duration === ticks ? "default" : "outline"} onClick={() => setDuration(ticks)}>{ticks}</Button>)}
              </div>
              <Input id="bulk-duration" type="number" min="1" max={Number(preflight.data?.maxDuration || 3600)} step="1" value={duration} onChange={event => setDuration(event.target.value)} />
              <p className="text-xs leading-5 text-muted-foreground">Reduce this before submitting. One tick is the shortest selectable duration; Deriv validates whether it is available for the chosen contract.</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Market</span><span className="font-mono">{selectedMarket}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Type</span><span>{CONTRACT_LABELS[contractType]?.action || contractType}{needsBarrier ? ` ${barrier}` : ""}</span></div>
                 <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Stop loss</span><span>{formatMoney(Number(stopLoss || 0), accountCurrency)}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Stake</span><span>{formatMoney(Number(stake || 0), accountCurrency)}</span></div>
                 <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Run plan</span><span>{Number.isInteger(totalRuns) ? `${runSession.state.completedRuns}/${totalRuns}` : "Invalid"} · TP {formatMoney(Number(takeProfit || 0), accountCurrency)}</span></div>
            </div>
               {!contracts.isLoading && !contracts.isError && !availableTypes.length && (
                 <p className="text-xs text-destructive">Deriv currently offers no supported contracts for {selectedMarket}. Choose another market.</p>
               )}
                <RunSessionSummary
                  state={runSession.state}
                  currency={accountCurrency}
                  onStart={() => runSession.start(orderData, totalRuns, targetProfit)}
                  onStop={runSession.stop}
                  disabled={!canRun || !validOrder || marketOffline || runSession.isBusy}
                  label="Run Bot"
                />
                <p className="text-[11px] leading-5 text-muted-foreground">Run Bot starts one bounded session. Each run gets a fresh Deriv proposal and the next order waits for the previous contract to settle. Stop Bot prevents future entries.</p>
          </CardContent>
        </Card>
      </div>

       {runSession.state.results.length > 0 && (
        <Card data-testid="card-bulk-results">
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-base">Results</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
              {runSession.state.results.map((result: any) => (
               <div key={result.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                 <div>
                     <div className="font-mono">{selectedMarket} · run {result.run}</div>
                   <div className="mt-1 text-xs text-muted-foreground">{result.message}</div>
                 </div>
                  <span className={["won", "settled"].includes(result.status) ? "text-success" : result.status === "rejected" ? "text-destructive" : "text-muted-foreground"}>{result.status || "queued"}</span>
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