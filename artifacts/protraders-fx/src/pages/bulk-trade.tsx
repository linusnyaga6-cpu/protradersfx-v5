import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Crosshair,
  MoreHorizontal,
  Radio,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  TrendingUp,
  WalletCards,
} from "lucide-react"
import {
  getGetAccountQueryKey,
  getGetMarketCandlesQueryKey,
  getGetMarketContractsQueryKey,
  getGetMarketTickerQueryKey,
  getGetProtradersPreflightQueryKey,
  getGetSessionStatusQueryKey,
  useGetAccount,
  useGetMarketCandles,
  useGetMarketContracts,
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
import { DigitRail } from "@/components/trading/digit-rail"
import { TradingTabs } from "@/components/trading/trading-tabs"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"
import { useTradingRunSession } from "@/hooks/use-trading-run-session"
import { formatMoney, formatSignedMoney, formatVolatility } from "@/lib/format"
import { CONTRACT_LABELS, DEFAULT_MARKET_SYMBOL, SUPPORTED_VOLATILITY_SYMBOLS, marketLabel } from "@/lib/markets"

export default function BulkTrade() {
  const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search)
  const requestedSymbol = requested?.get("symbol") || DEFAULT_MARKET_SYMBOL
  const [selectedMarket, setSelectedMarket] = useState(
    SUPPORTED_VOLATILITY_SYMBOLS.has(requestedSymbol) ? requestedSymbol : DEFAULT_MARKET_SYMBOL,
  )
  const [contractType, setContractType] = useState(requested?.get("contract") || "CALL")
  const [barrier, setBarrier] = useState("5")
  const [stopLoss, setStopLoss] = useState("1")
  const [stake, setStake] = useState("1")
  const [duration, setDuration] = useState("1")
  const [availabilityNotice, setAvailabilityNotice] = useState("")
  const queryClient = useQueryClient()
  const marketQuery = useDerivMarkets()

  useEffect(() => {
    if (marketQuery.markets.length && !marketQuery.markets.some(item => item.symbol === selectedMarket)) {
      setSelectedMarket(marketQuery.defaultSymbol)
    }
  }, [marketQuery.markets, marketQuery.defaultSymbol, selectedMarket])

  const { data: session } = useGetSessionStatus({
    query: { queryKey: getGetSessionStatusQueryKey() },
  })
  const preflight = useGetProtradersPreflight({
    query: { queryKey: getGetProtradersPreflightQueryKey() },
  })
  const account = useGetAccount(undefined, {
    query: {
      queryKey: getGetAccountQueryKey(),
      enabled: !!session?.authenticated,
      refetchInterval: 5000,
    },
  })
  const accountCurrency = account.data?.currency || "USD"
  const accountSessionLabel = account.data?.accountType === "real"
    ? "real account"
    : account.data?.accountType === "demo"
      ? "demo account"
      : "selected account"
  const availableBalance = Number(account.data?.balance)
  const accountCanTrade = account.data?.accountType === "real"
    ? preflight.data?.readyForRealTrading
    : account.data?.accountType === "demo" && preflight.data?.tradingEnabled
  const canRun = Boolean(session?.authenticated && accountCanTrade)
  const tradeSource = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "ai_assisted"
    ? "ai_assisted" as const
    : "manual" as const
  const runSession = useTradingRunSession(
    `protraders-run-session:${tradeSource}`,
    () => { queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() }) },
  )

  const ticker = useGetMarketTicker(selectedMarket, {
    query: {
      queryKey: getGetMarketTickerQueryKey(selectedMarket),
      refetchInterval: 15000,
    },
  })
  const candles = useGetMarketCandles(selectedMarket, { count: 60, granularity: 60 }, {
    query: {
      queryKey: getGetMarketCandlesQueryKey(selectedMarket, { count: 60, granularity: 60 }),
      refetchInterval: 30000,
    },
  })
  const marketData = candles.data as any
  const marketQuote = (ticker.data as any)?.quote ?? (ticker.data as any)?.price
  const quoteDigits = String(marketQuote ?? "").replace(/\D/g, "")
  const liveLastDigit = quoteDigits ? Number(quoteDigits.at(-1)) : null
  const marketOffline = ticker.isError || (ticker.data as any)?.available === false
  const candleCloses = useMemo(() => readCandleCloses(marketData), [marketData])
  const selectedMarketIndex = Math.max(0, marketQuery.markets.findIndex(item => item.symbol === selectedMarket))
  const quoteTrend = candleCloses.length > 1
    ? candleCloses.at(-1)! >= candleCloses.at(-2)! ? "up" : "down"
    : "flat"

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
      !contracts.isLoading
      && selectedMarket !== DEFAULT_MARKET_SYMBOL
      && marketQuery.markets.some(item => item.symbol === DEFAULT_MARKET_SYMBOL)
      && (contracts.isError || (contracts.data && availableTypes.length === 0))
    ) {
      setAvailabilityNotice(`${selectedMarket} is not currently returning usable contract choices. Switched to ${DEFAULT_MARKET_SYMBOL}.`)
      setSelectedMarket(DEFAULT_MARKET_SYMBOL)
    }
  }, [contracts.data, contracts.isLoading, contracts.isError, availableTypes.length, selectedMarket, marketQuery.markets])

  useEffect(() => {
    if (availableTypes.length && !availableTypes.includes(contractType)) {
      setContractType(availableTypes.includes("CALL") ? "CALL" : availableTypes[0])
    }
  }, [availableTypes.join("|"), contractType])

  const needsBarrier = Boolean(CONTRACT_LABELS[contractType]?.needsBarrier)
  const totalRuns = 1
  const targetProfit = Number(stake)
  const validInputs = Number.isInteger(totalRuns)
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
    account_id: String(account.data?.loginid || ""),
    account_type: account.data?.accountType,
    symbol: selectedMarket,
    contract_type: contractType,
    ...(needsBarrier ? { barrier } : {}),
    stake: Number(stake),
    duration: Number(duration),
    stop_loss: Number(stopLoss),
    source: tradeSource,
    request_label: `${selectedMarket} ${tradeSource === "ai_assisted" ? "scanner-assisted" : "manual"} order`,
  }
  const directionIsCall = contractType === "CALL"
  const directionIsPut = contractType === "PUT"

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-[1480px] space-y-4 p-3 md:p-5">
      <TradingTabs active="manual" />
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} switchingDisabled={runSession.isBusy} />

      <section className="instrument-panel overflow-hidden rounded-xl" data-testid="manual-trader-workspace">
        <div className="flex flex-col gap-4 border-b border-border/80 bg-card px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Crosshair className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-primary">
                <Radio className="h-3 w-3" />
                Manual trading
              </div>
               <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">One reviewed decision</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground md:ml-2">
            <Badge variant={marketOffline ? "destructive" : "success"} data-testid="status-market-connection">
              {marketOffline ? "OFFLINE" : ticker.isLoading ? "CONNECTING" : "LIVE"}
            </Badge>
            <span className="hidden whitespace-nowrap lg:inline">{accountSessionLabel} · safeguarded</span>
          </div>
        </div>
        {(marketQuery.isLoading || marketQuery.isError || availabilityNotice) && (
          <div className="border-b border-border/70 bg-secondary/15 px-4 py-2 text-xs md:px-5">
            {marketQuery.isLoading && <p className="text-muted-foreground">Loading active markets from Deriv.</p>}
            {marketQuery.isError && <p className="text-destructive">Deriv market discovery is unavailable.</p>}
            {availabilityNotice && <p className="text-amber-600">{availabilityNotice}</p>}
          </div>
        )}
        <div className="border-b border-border/80 bg-background/40 p-3 md:p-4">
          <DigitRail activeDigit={liveLastDigit} selectedDigit={needsBarrier ? Number(barrier) : null} />
           <MarketCursor
             markets={marketQuery.markets}
             selectedMarket={selectedMarket}
             selectedIndex={selectedMarketIndex}
             onChange={setSelectedMarket}
             isLoading={marketQuery.isLoading}
           />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="order-2 min-w-0 border-b border-border/80 lg:order-1 lg:border-b-0 lg:border-r" aria-label="Live market">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 md:px-5">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  Live market
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-2xl font-bold tracking-tight" data-testid="text-market-quote">{marketQuote == null ? "—" : String(marketQuote)}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${marketOffline ? "bg-destructive" : "bg-success"}`} />
                    {marketOffline ? "Awaiting provider" : "Provider quote"}
                  </span>
                </div>
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider ${quoteTrend === "down" ? "text-destructive" : quoteTrend === "up" ? "text-success" : "text-muted-foreground"}`}>
                {quoteTrend === "down" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                {quoteTrend === "flat" ? "Waiting" : quoteTrend === "up" ? "Rising" : "Falling"}
              </div>
            </div>
            <div className="bg-card/70 p-3 md:p-5">
              <QuoteChart values={candleCloses} trend={quoteTrend} isLoading={candles.isLoading} />
            </div>
            <div className="grid gap-3 border-t border-border/70 bg-background/30 p-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:p-4" data-testid="panel-live-price-context">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Latest tick context</div>
                <p className="mt-1 text-sm text-foreground">The last digit is moving with the live quote.</p>
              </div>
              <div className="hidden h-8 w-px bg-border md:block" />
              <div className="flex items-center justify-between gap-4 md:justify-end">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last digit</div>
                  <div className="font-mono text-lg font-semibold text-primary" data-testid="text-live-last-digit">{liveLastDigit == null ? "—" : liveLastDigit}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
                  <div className="font-mono text-sm font-semibold">{Number.isFinite(availableBalance) ? formatMoney(availableBalance, accountCurrency) : "Unavailable"}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-border/70 bg-background/20 p-3 sm:grid-cols-4 md:p-4">
              <MarketMetric label="Volatility" value={marketData?.indicators ? formatVolatility(marketData.indicators.volatilityLevel, marketData.indicators.volatilityPct) : "Unavailable"} />
              <MarketMetric label="Candle window" value={candleCloses.length ? `${candleCloses.length} closes` : "Waiting"} />
              <MarketMetric label="Duration cap" value={`${Number(preflight.data?.maxDuration || 3600)} ticks`} />
              <MarketMetric label="Account" value={accountSessionLabel} />
            </div>
          </section>

          <aside className="order-1 bg-card/90 lg:order-2" aria-label="Order ticket">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 md:px-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-primary">Order ticket</div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Place a trade</h2>
              </div>
              <WalletCards className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-4 p-4 md:p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Direction</Label>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Higher / Lower</span>
                </div>
                <div className="grid gap-2" data-testid="direction-selector">
                <Button
                  type="button"
                  variant={directionIsCall ? "default" : "outline"}
                  className={`h-12 justify-between px-4 ${directionIsCall ? "bg-success text-success-foreground hover:bg-success/90" : "border-success/40 text-success hover:bg-success/10"}`}
                  onClick={() => setContractType("CALL")}
                  disabled={!availableTypes.includes("CALL") || runSession.isBusy}
                  aria-pressed={directionIsCall}
                  data-testid="button-direction-call"
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-bold tracking-wide">CALL</span>
                    <span className="text-[10px] font-normal opacity-80">Higher</span>
                  </span>
                  <ArrowUpRight className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant={directionIsPut ? "default" : "outline"}
                  className={`h-12 justify-between px-4 ${directionIsPut ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "border-destructive/40 text-destructive hover:bg-destructive/10"}`}
                  onClick={() => setContractType("PUT")}
                  disabled={!availableTypes.includes("PUT") || runSession.isBusy}
                  aria-pressed={directionIsPut}
                  data-testid="button-direction-put"
                >
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-bold tracking-wide">PUT</span>
                    <span className="text-[10px] font-normal opacity-80">Lower</span>
                  </span>
                  <ArrowDownRight className="h-5 w-5" />
                </Button>
                </div>
                {contracts.isLoading && <p className="text-xs text-muted-foreground">Checking contracts offered by Deriv.</p>}
                {contracts.isError && <p className="text-xs text-amber-600">Contract availability is temporarily unavailable for this symbol.</p>}
                {!contracts.isLoading && !contracts.isError && !availableTypes.length && <p className="text-xs text-amber-600">No supported contracts are available for this symbol yet.</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Duration</Label>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ticks</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {["1", "2", "3", "4"].map(tick => (
                    <Button
                      key={tick}
                      type="button"
                      variant={duration === tick ? "default" : "outline"}
                      className={duration === tick ? "bg-primary text-primary-foreground" : "bg-background"}
                      onClick={() => setDuration(tick)}
                      disabled={runSession.isBusy}
                      data-testid={`button-duration-${tick}`}
                    >
                      {tick}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label={`Stake (${accountCurrency})`} id="bulk-stake" value={stake} onChange={setStake} min="0.01" step="0.01" />
                <div className="space-y-2">
                  <Label htmlFor="bulk-duration">Custom ticks</Label>
                  <div className="relative">
                    <Input id="bulk-duration" type="number" min="1" max={Number(preflight.data?.maxDuration || 3600)} step="1" value={duration} onChange={event => setDuration(event.target.value)} disabled={runSession.isBusy} data-testid="input-duration" className="pr-14" />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] uppercase text-muted-foreground">ticks</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-choice">Contract type</Label>
                <select
                  id="contract-choice"
                  value={contractType}
                  onChange={event => setContractType(event.target.value)}
                  disabled={!availableTypes.length || runSession.isBusy}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  data-testid="select-contract-type"
                >
                  {availableTypes.map((type: string) => (
                    <option key={type} value={type}>{CONTRACT_LABELS[type]?.action || type} · {CONTRACT_LABELS[type]?.family || "Contract"}</option>
                  ))}
                </select>
               <div className="grid grid-cols-2 gap-2" data-testid="quick-contract-selector">
                 {availableTypes.slice(0, 4).map((type: string) => (
                   <Button
                     key={type}
                     type="button"
                     size="sm"
                     variant={contractType === type ? "default" : "outline"}
                     className={contractType === type ? "bg-primary text-primary-foreground" : "bg-background"}
                     onClick={() => setContractType(type)}
                     disabled={runSession.isBusy}
                   >
                     {CONTRACT_LABELS[type]?.action || type}
                   </Button>
                 ))}
               </div>
              </div>

              {needsBarrier && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Digit barrier</Label>
                    <span className="font-mono text-xs text-amber-600">selected: {barrier}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 10 }, (_, digit) => String(digit)).map(digit => (
                      <Button
                        key={digit}
                        type="button"
                        size="sm"
                        variant={barrier === digit ? "default" : "outline"}
                        onClick={() => setBarrier(digit)}
                        disabled={runSession.isBusy}
                        data-testid={`button-barrier-${digit}`}
                      >
                        {digit}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Field label={`Stop loss (${accountCurrency})`} id="bulk-stop-loss" value={stopLoss} onChange={setStopLoss} min="0.01" step="0.01" />
                <div className="flex items-end">
                  <div className="flex h-10 w-full items-center justify-between rounded-md border border-border/80 bg-secondary/25 px-3 text-xs">
                    <span className="text-muted-foreground">At risk</span>
                    <span className="font-mono font-semibold">{formatMoney(Number(stake || 0), accountCurrency)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-secondary/25 p-3 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Market</span><span className="font-mono">{selectedMarket}</span></div>
                <div className="mt-1 flex items-center justify-between gap-2"><span className="text-muted-foreground">Contract</span><span className="font-semibold">{CONTRACT_LABELS[contractType]?.action || contractType}{needsBarrier ? ` · ${barrier}` : ""}</span></div>
                <div className="mt-1 flex items-center justify-between gap-2"><span className="text-muted-foreground">Stop loss</span><span className="font-mono">{formatMoney(Number(stopLoss || 0), accountCurrency)}</span></div>
              </div>

              {!session?.authenticated && <GateNotice icon={<CircleAlert className="h-4 w-4" />} text="Sign in and select an account before submitting an order." />}
              {session?.authenticated && !accountCanTrade && <GateNotice icon={<ShieldCheck className="h-4 w-4" />} text="Trading is gated until the selected account passes the current preflight checks." />}

              <SessionActions
                state={runSession.state}
                currency={accountCurrency}
                contractType={contractType}
                disabled={!canRun || !validOrder || marketOffline || runSession.isBusy}
                onStart={() => runSession.start(orderData, totalRuns, targetProfit)}
                onStop={runSession.stop}
                onReset={runSession.reset}
              />
            </div>
          </aside>
        </div>
      </section>

      <SettlementStream state={runSession.state} currency={accountCurrency} selectedMarket={selectedMarket} />
    </div>
  )
}

function Field({ label, id, value, onChange, min, max, step }: { label: string; id: string; value: string; onChange: (value: string) => void; min?: string; max?: string; step?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={min} max={max} step={step} value={value} onChange={event => onChange(event.target.value)} data-testid={`input-${id.replace("bulk-", "")}`} />
    </div>
  )
}

function GateNotice({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300" data-testid="status-trading-gate">{icon}<span>{text}</span></div>
}

function MarketCursor({
  markets,
  selectedMarket,
  selectedIndex,
  onChange,
  isLoading,
}: {
  markets: Array<{ symbol: string; displayName?: string; marketDisplayName?: string; submarketDisplayName?: string }>
  selectedMarket: string
  selectedIndex: number
  onChange: (symbol: string) => void
  isLoading: boolean
}) {
  const selected = markets[selectedIndex]
  const maxIndex = Math.max(0, markets.length - 1)
  const cursorPosition = maxIndex === 0 ? 0 : (selectedIndex / maxIndex) * 100

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[.04] px-4 py-3" data-testid="market-cursor-selector">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Chosen market</div>
          <div className="mt-1 font-mono text-sm font-semibold">{selected ? marketLabel(selected, selectedMarket) : isLoading ? "Loading markets…" : "No market selected"}</div>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-muted-foreground">
          <Crosshair className="h-3.5 w-3.5 text-primary" />
          Drag cursor to choose
        </div>
      </div>
      <div className="relative mt-4 px-1">
        <div className="pointer-events-none absolute left-1 right-1 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" aria-hidden="true" />
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary transition-[width] duration-300"
          style={{ left: "4px", width: `calc(${cursorPosition}% - ${cursorPosition * 8 / 100}px)` }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 text-primary transition-[left] duration-300"
          style={{ left: `calc(${cursorPosition}% + ${4 - cursorPosition * 8 / 100}px)` }}
          aria-hidden="true"
        >
          <span className="block animate-pulse text-sm leading-none">▼</span>
        </div>
        <input
          aria-label="Choose market"
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={selectedIndex}
          onChange={event => {
            const nextMarket = markets[Number(event.target.value)]
            if (nextMarket) onChange(nextMarket.symbol)
          }}
          disabled={markets.length < 2 || isLoading}
          className="relative z-20 h-5 w-full cursor-pointer appearance-none bg-transparent accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="cursor-market-selector"
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground">
        <span>{markets.length ? `${selectedIndex + 1} of ${markets.length}` : "—"}</span>
        <span>Live quote refreshes every 15s</span>
      </div>
    </div>
  )
}

function SessionActions({ state, currency, contractType, disabled, onStart, onStop, onReset }: {
  state: ReturnType<typeof useTradingRunSession>["state"]
  currency: string
  contractType: string
  disabled: boolean
  onStart: () => void
  onStop: () => void
  onReset: () => void
}) {
  const active = state.status === "running" || state.status === "stopping"
  const statusVariant = active ? "success" : state.status === "failed" ? "destructive" : "outline"
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4" data-testid="card-session-actions">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Execution</span>
          <Badge variant={statusVariant} className="uppercase">{state.status}</Badge>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{state.completedRuns}/{state.totalRuns || "—"} settled</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SessionStat label="Net P/L" value={state.completedRuns ? formatSignedMoney(state.netProfit, currency) : "Not settled"} tone={state.netProfit >= 0 ? "text-success" : "text-destructive"} />
        <SessionStat label="Next action" value={active ? `Waiting · ${contractType}` : "Ready"} />
      </div>
      {active ? (
        <Button type="button" variant="destructive" className="w-full" onClick={onStop} disabled={state.status === "stopping"} data-testid="button-stop-session">
          <Square className="mr-2 h-3.5 w-3.5" />{state.status === "stopping" ? "Stopping after settlement" : "Stop after current contract"}
        </Button>
      ) : (
        <div className="flex gap-2">
          {(state.results.length > 0 || state.status !== "idle") && (
            <Button type="button" variant="outline" className="shrink-0" onClick={onReset} data-testid="button-reset-session">
              <RotateCcw className="mr-2 h-3.5 w-3.5" />Reset
            </Button>
          )}
          <Button type="button" className="min-w-0 flex-1" onClick={onStart} disabled={disabled} data-testid="button-submit-order">
            <Send className="mr-2 h-3.5 w-3.5" />Submit {contractType} order
          </Button>
        </div>
      )}
      {state.message && <p className="text-xs leading-5 text-muted-foreground" aria-live="polite" data-testid="status-session-message">{state.message}</p>}
      <p className="text-[11px] leading-5 text-muted-foreground">Each submission requests a fresh provider proposal. The current contract settles before a stop takes effect.</p>
    </div>
  )
}

function SessionStat({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-lg border border-border/80 bg-background/65 p-2.5"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className={`mt-1 truncate font-mono text-xs font-semibold ${tone}`}>{value}</div></div>
}

function SettlementStream({ state, currency, selectedMarket }: {
  state: ReturnType<typeof useTradingRunSession>["state"]
  currency: string
  selectedMarket: string
}) {
  const settledCount = state.results.filter(result => ["won", "lost", "settled", "rejected"].includes(result.status)).length
  const netProfit = state.netProfit
  return (
    <Card data-testid="card-bulk-results" className="overflow-hidden">
      <CardHeader className="space-y-0 border-b bg-background p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 pt-3">
          <div className="flex items-center gap-5 text-[10px] font-semibold uppercase tracking-wider">
            <span className="pb-3 text-foreground">Summary</span>
            <span className="relative pb-3 text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary">Transactions</span>
            <span className="pb-3 text-muted-foreground">Journal</span>
          </div>
          <TrendingUp className="mb-3 h-4 w-4 text-primary" />
        </div>
        <div className="grid grid-cols-3 gap-px bg-border">
          <ResultSummary label="Transactions" value={String(state.results.length)} />
          <ResultSummary label="Settled" value={String(settledCount)} />
          <ResultSummary label="Net P/L" value={settledCount ? formatSignedMoney(netProfit, currency) : "Not settled"} tone={netProfit >= 0 ? "text-success" : "text-destructive"} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {state.results.length === 0 ? (
          <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground" data-testid="empty-settlement-stream">
            <BarChart3 className="h-5 w-5 text-primary/70" />
            <div><p className="font-medium text-foreground">No transactions yet.</p><p className="mt-0.5 text-xs">Settled contracts and authoritative P/L will appear here.</p></div>
          </div>
        ) : (
          <div className="divide-y">
            {state.results.map(result => (
              <SettlementRow key={result.id} result={result} currency={currency} fallbackSymbol={selectedMarket} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ResultSummary({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-background p-3">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xs font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

function SettlementRow({ result, currency, fallbackSymbol }: {
  result: ReturnType<typeof useTradingRunSession>["state"]["results"][number]
  currency: string
  fallbackSymbol: string
}) {
  const pending = result.status === "pending"
  const won = result.status === "won" || result.status === "settled"
  const rejected = result.status === "lost" || result.status === "rejected"
  const statusIcon = pending
    ? <Clock3 className="h-4 w-4 text-amber-600" />
    : won
      ? <CheckCircle2 className="h-4 w-4 text-success" />
      : rejected
        ? <CircleAlert className="h-4 w-4 text-destructive" />
        : <Clock3 className="h-4 w-4 text-muted-foreground" />
  return (
    <div className="grid gap-3 p-4 text-sm sm:grid-cols-[minmax(150px,1fr)_minmax(180px,1.2fr)_auto] sm:items-center" data-testid={`row-settlement-${result.id}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${result.contractType === "PUT" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
          {result.contractType === "PUT" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold">
            <span>{result.contractType || "ORDER"}</span>
            {statusIcon}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">Run {String(result.run).padStart(2, "0")} · {result.symbol || fallbackSymbol}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-[11px]">
        <ResultValue label="Entry" value={formatSpot(result.entrySpot)} />
        <ResultValue label="Exit" value={formatSpot(result.exitSpot)} />
        <ResultValue label="Buy price" value={result.buyPrice == null ? "—" : formatMoney(result.buyPrice, currency)} />
      </div>
      <div className="text-left sm:text-right">
        <div className={`font-mono text-sm font-semibold ${result.netProfit == null ? "text-muted-foreground" : result.netProfit >= 0 ? "text-success" : "text-destructive"}`}>
          {result.netProfit == null ? "Pending" : formatSignedMoney(result.netProfit, currency)}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{result.status || "queued"}</div>
        <div className="sr-only" data-testid={`text-settlement-message-${result.id}`}>{result.message}</div>
      </div>
    </div>
  )
}

function ResultValue({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs font-semibold">{value}</div></div>
}

function QuoteChart({ values, trend, isLoading }: { values: number[]; trend: "up" | "down" | "flat"; isLoading: boolean }) {
  const points = values.length > 1 ? values : []
  const min = points.length ? Math.min(...points) : 0
  const max = points.length ? Math.max(...points) : 1
  const range = max - min || 1
  const path = points.map((value, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 100
    const y = 72 - ((value - min) / range) * 58
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(" ")
  const lastValue = points.at(-1)
  const lastY = lastValue == null ? 72 : 72 - ((lastValue - min) / range) * 58
  const stroke = trend === "down" ? "hsl(var(--destructive))" : "hsl(var(--primary))"
  return (
    <div className="rounded-lg border border-border/80 bg-background/65" data-testid="chart-market-context">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground"><BarChart3 className="h-3.5 w-3.5 text-primary" />Price chart</div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground">{isLoading ? "Loading" : points.length ? "1m" : "Waiting"}</span>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      {path ? (
        <svg viewBox="0 0 100 84" preserveAspectRatio="none" className="h-[290px] w-full" role="img" aria-label="Recent market candle close context">
          <defs>
            <linearGradient id="quote-area-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity=".18" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g stroke="hsl(var(--border))" strokeWidth=".45" opacity=".65" vectorEffect="non-scaling-stroke">
            {[10, 26, 42, 58, 74].map(y => <path key={`h-${y}`} d={`M 0 ${y} H 100`} />)}
            {[12.5, 25, 37.5, 50, 62.5, 75, 87.5].map(x => <path key={`v-${x}`} d={`M ${x} 0 V 84`} />)}
          </g>
          <path d={`${path} L 100 84 L 0 84 Z`} fill="url(#quote-area-fill)" />
          <path d={path} fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <path d={`M 0 ${lastY.toFixed(2)} H 100`} stroke={stroke} strokeWidth=".8" strokeDasharray="2 2" opacity=".7" vectorEffect="non-scaling-stroke" />
          <circle cx="100" cy={lastY} r="1.5" fill={stroke} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div className="flex h-[290px] items-center justify-center text-xs text-muted-foreground">Candle context will populate from Deriv.</div>
      )}
    </div>
  )
}

function MarketMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-secondary/35 p-3"><div className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs font-semibold">{value}</div></div>
}

function readCandleCloses(data: unknown) {
  const payload = data as any
  const rows = Array.isArray(payload?.candles)
    ? payload.candles
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : []
  return rows
    .map((row: any) => Number(row?.close ?? row?.closePrice ?? row?.quote ?? row?.price))
    .filter((value: number) => Number.isFinite(value))
    .slice(-60)
}

function formatSpot(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(5).replace(/0+$/, "").replace(/\.$/, "")
}