import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Activity, ArrowRight, GripHorizontal, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react"
import {
  getGetMarketCandlesQueryKey,
  getGetMarketTickerQueryKey,
  getGetSessionStatusQueryKey,
  getGetAccountQueryKey,
  useAnalyzeMarket,
  useScanBestMarket,
  useGetMarketCandles,
  useGetMarketTicker,
  useGetSessionStatus,
  useGetAccount,
} from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatVolatility } from "@/lib/format"
import { DEFAULT_MARKET_SYMBOL, marketLabel } from "@/lib/markets"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"
import { useLocation } from "wouter"
import { AccountBalancePill } from "@/components/trading/account-strip"

type ScannerResult = {
  symbol: string
  asOf: string
  source: "deterministic" | "ai-advisory"
  advisoryOnly: true
  winRate?: number
  indicators: { ema9: number; ema21: number; rsi14: number; macdHistogram: number; trend: string; volatilityPct?: number; volatilityLevel?: string }
  analysis: { summary: string; bias: "bullish" | "bearish" | "neutral"; observations: string[]; limitations: string }
}

export function FloatingScanner() {
  const { data: session } = useGetSessionStatus({ query: { queryKey: getGetSessionStatusQueryKey() } })
  const account = useGetAccount(undefined, {
    query: {
      queryKey: getGetAccountQueryKey(),
      enabled: !!session?.authenticated,
      refetchInterval: 5000,
    },
  })
  const [, setLocation] = useLocation()
  const [open, setOpen] = useState(false)
  const [symbol, setSymbol] = useState(DEFAULT_MARKET_SYMBOL)
  const marketQuery = useDerivMarkets()
  const scannerMarkets = marketQuery.volatilityMarkets.length ? marketQuery.volatilityMarkets : marketQuery.markets

  useEffect(() => {
    if (scannerMarkets.length && !scannerMarkets.some(item => item.symbol === symbol)) setSymbol(marketQuery.defaultSymbol)
  }, [scannerMarkets, marketQuery.defaultSymbol, symbol])

  const [position, setPosition] = useState(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 }
    try {
      const saved = JSON.parse(window.localStorage.getItem("protraders-ai-position") || "null")
      return Number.isFinite(saved?.x) && Number.isFinite(saved?.y) ? { x: saved.x, y: saved.y } : { x: 0, y: 0 }
    } catch {
      return { x: 0, y: 0 }
    }
  })
  const [result, setResult] = useState<ScannerResult | null>(null)
  const [bestMarket, setBestMarket] = useState<any>(null)
  const [scannerMode, setScannerMode] = useState<"analyze" | "scan">("analyze")
  const [error, setError] = useState("")
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const wasDragged = useRef(false)

  const analyzeMarket = useAnalyzeMarket()
  const scanBestMarket = useScanBestMarket()

  const ticker = useGetMarketTicker(symbol, { query: { queryKey: getGetMarketTickerQueryKey(symbol), enabled: !!session?.authenticated && open, refetchInterval: 15000 } })
  const candleParams = { count: 60, granularity: 60 }
  const candles = useGetMarketCandles(symbol, candleParams, { query: { queryKey: getGetMarketCandlesQueryKey(symbol, candleParams), enabled: !!session?.authenticated && open, staleTime: 30000 } })

  const openAiScanner = () => {
    setOpen(false)
    setLocation("/ai-scanner")
  }

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener("protraders:open-scanner", show)
    return () => window.removeEventListener("protraders:open-scanner", show)
  }, [])

  useEffect(() => {
    window.localStorage.setItem("protraders-ai-position", JSON.stringify(position))
  }, [position])

  const analyze = () => {
    setError("")
    setBestMarket(null)
    analyzeMarket.mutate({ data: { symbol } }, {
      onSuccess: (body) => setResult(body as ScannerResult),
      onError: (scannerError) => setError(scannerError instanceof Error ? scannerError.message : "Scanner unavailable"),
    })
  }

  const runBestMarketScan = () => {
    setScannerMode("scan")
    setError("")
    scanBestMarket.mutate(undefined, {
      onSuccess: (body) => {
        const best = (body as any)?.best
        if (!best) {
          setBestMarket(null)
          setError("No volatility market returned enough fresh data to rank.")
          return
        }
        setSymbol(best.symbol)
        setBestMarket(best)
        analyzeMarket.mutate({ data: { symbol: best.symbol } }, {
          onSuccess: (analysisBody) => setResult(analysisBody as ScannerResult),
          onError: () => setResult(null),
        })
      },
      onError: (scanError) => setError(scanError instanceof Error ? scanError.message : "Best-market scan unavailable"),
    })
  }

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    drag.current = { x: position.x, y: position.y, startX: event.clientX, startY: event.clientY }
    wasDragged.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return
    if (Math.abs(event.clientX - drag.current.startX) > 4 || Math.abs(event.clientY - drag.current.startY) > 4) {
      wasDragged.current = true
    }
    const mobile = window.innerWidth < 768
    const minX = mobile ? 0 : -(window.innerWidth - 390)
    const minY = -(window.innerHeight - (mobile ? 220 : 320))
    setPosition({
      x: Math.min(0, Math.max(minX, drag.current.x + event.clientX - drag.current.startX)),
      y: Math.min(0, Math.max(minY, drag.current.y + event.clientY - drag.current.startY)),
    })
  }

  if (!open) {
    return (
      <Button
         className="fixed bottom-5 right-5 z-[70] h-14 w-14 touch-none select-none cursor-grab rounded-full border-2 border-white/80 bg-[#20c7c2] p-0 text-[#072d3a] shadow-[0_0_0_6px_rgba(32,199,194,.16),0_14px_34px_rgba(9,72,88,.32)] active:cursor-grabbing hover:bg-[#72e0c8]"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        onLostPointerCapture={() => { drag.current = null }}
        onClick={(event) => {
          if (wasDragged.current) {
            event.preventDefault()
            wasDragged.current = false
            return
          }
          setOpen(true)
        }}
         title="Drag AI Scanner to move it, or click to open"
         aria-label="Open AI Scanner"
        data-testid="button-open-scanner"
      >
         <span className="pointer-events-none absolute inset-1 rounded-full border border-[#072d3a]/20" aria-hidden="true" />
         <Activity className="relative h-6 w-6" />
      </Button>
    )
  }

  const tick = ticker.data as any
  const candleData = candles.data as any
  const aiWinRate = Number.isFinite(Number(result?.winRate)) ? `${Number(result?.winRate).toFixed(1)}%` : "N/A"

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[70] max-h-[82vh] overflow-hidden rounded-sm border border-border bg-card/95 shadow-2xl backdrop-blur-xl md:inset-auto md:right-5 md:top-24 md:w-[380px] flex flex-col"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      aria-label="Movable AI market scanner"
      data-testid="panel-ai-scanner"
    >
      <div
        className="flex touch-none select-none cursor-grab items-center justify-between border-b border-border bg-secondary/40 px-4 py-3 active:cursor-grabbing shrink-0"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
        onLostPointerCapture={() => { drag.current = null }}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="hidden h-4 w-4 text-muted-foreground md:block" />
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-widest font-medium">AI Market Scanner</span>
        </div>
        <div className="flex items-center gap-2">
          {session?.authenticated && <AccountBalancePill account={account.data} isLoading={account.isLoading} />}
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm" onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)} aria-label="Close scanner">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
        <Tabs value={scannerMode} onValueChange={(value) => setScannerMode(value as "analyze" | "scan")}>
          <TabsList className="grid h-9 w-full grid-cols-2 rounded-sm border border-border bg-background/50 p-1">
            <TabsTrigger value="analyze" className="rounded-sm text-[10px] uppercase tracking-wider">Analyze market</TabsTrigger>
            <TabsTrigger value="scan" className="rounded-sm text-[10px] uppercase tracking-wider">Scan best market</TabsTrigger>
          </TabsList>
        </Tabs>
        {!session?.authenticated ? (
          <div className="space-y-4">
            <div className="rounded-sm border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Authentication Required
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Connect your account to scan live markets and receive advisory context.
              </p>
            </div>
            <Button asChild className="w-full rounded-sm font-mono text-xs uppercase tracking-widest" data-testid="button-connect-scanner">
               <a href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/deriv/login`}>Connect <ArrowRight className="ml-2 h-3.5 w-3.5" /></a>
            </Button>
            <div className="flex items-center gap-2 border-t border-border pt-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Advisory only · no execution
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Select value={symbol} onValueChange={(value) => { setSymbol(value); setResult(null); setBestMarket(null); setError("") }}>
                <SelectTrigger className="bg-background/70 rounded-sm font-mono text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-sm font-mono text-xs">
                  {scannerMarkets.map(item => <SelectItem key={item.symbol} value={item.symbol}>{marketLabel(item, item.symbol)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={analyze} disabled={analyzeMarket.isPending || ticker.isLoading || candles.isLoading} data-testid="button-run-scanner" className="rounded-sm px-3">
                {analyzeMarket.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="sr-only">Run analysis</span>
              </Button>
            </div>

             <Button className="w-full rounded-sm font-mono text-xs normal-case tracking-normal" variant="outline" onClick={runBestMarketScan} disabled={scanBestMarket.isPending || analyzeMarket.isPending} data-testid="button-scan-best-market">
               {scanBestMarket.isPending || analyzeMarket.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
               {scanBestMarket.isPending ? "Ranking fresh markets..." : analyzeMarket.isPending ? "Analyzing top market..." : "Scan for best market"}
            </Button>

            <div className="grid grid-cols-3 gap-2">
              <Metric label="Latest quote" value={tick?.available === false ? "Offline" : String(tick?.quote ?? "—")} />
              <Metric label="Volatility" value={candleData?.indicators ? formatVolatility(candleData.indicators.volatilityLevel, candleData.indicators.volatilityPct) : "—"} />
              <Metric label="Observed Win" value={bestMarket?.observedSignalWinRate != null ? `${Number(bestMarket.observedSignalWinRate).toFixed(1)}%` : aiWinRate} />
            </div>

            {error && <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 font-mono text-[10px] text-destructive">{error}</div>}

            {!result && !error && !bestMarket && (
              <div className="rounded-sm border border-dashed border-border p-5 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Scan selected market
              </div>
            )}

            {bestMarket && (
              <div className="space-y-3 rounded-sm border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-primary">Top market scan</div>
                    <div className="mt-1 font-display text-lg font-medium text-foreground">{bestMarket.displayName || bestMarket.symbol}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{bestMarket.symbol}</div>
                  </div>
                  <Badge variant="success" className="rounded-sm font-mono text-[9px] uppercase">{Number(bestMarket.observedSignalWinRate).toFixed(1)}% observed</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Market" value={`${bestMarket.symbol}`} />
                  <Metric label="Volatility" value={formatVolatility(bestMarket.indicators?.volatilityLevel, bestMarket.indicators?.volatilityPct) || "—"} />
                  <Metric label="Historical Win" value={`${Number(bestMarket.observedSignalWinRate).toFixed(1)}%`} />
                  <Metric label="Signals" value={String(bestMarket.signalSampleSize)} />
                </div>
                 {result && (
                   <div className="rounded-sm border border-border bg-background/60 p-3">
                     <div className="font-mono text-[9px] uppercase tracking-widest text-primary">
                       {result.source === "ai-advisory" ? "AI view" : "Indicator view"} · {result.analysis.bias}
                     </div>
                     <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{result.analysis.summary}</p>
                   </div>
                 )}
                <p className="text-[10px] leading-relaxed text-muted-foreground">This is a recent one-step candle backtest, not a guaranteed Deriv win percentage. Review market and contract before placing an order.</p>
                 <Button className="w-full rounded-sm font-sans text-xs normal-case tracking-normal" variant="outline" onClick={openAiScanner} data-testid="button-open-ai-workspace">
                   Open AI Scanner workspace <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {result && !bestMarket && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={result.analysis.bias === "neutral" ? "outline" : result.analysis.bias === "bullish" ? "success" : "destructive"} className="rounded-sm font-mono text-[9px] uppercase tracking-widest">
                    {result.analysis.bias.toUpperCase()}
                  </Badge>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{result.source === "ai-advisory" ? "AI Advisory" : "Deterministic"}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">{result.analysis.summary}</p>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="RSI 14" value={result.indicators.rsi14.toFixed(1)} />
                  <Metric label="EMA trend" value={result.indicators.trend} />
                  <Metric label="MACD hist" value={result.indicators.macdHistogram.toFixed(4)} />
                </div>
                <div className="rounded-sm border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Observed Volatility</div>
                      <div className="mt-1 font-mono text-xs text-foreground">{formatVolatility(result.indicators.volatilityLevel, result.indicators.volatilityPct)}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                       <Button size="sm" variant="outline" className="rounded-sm font-sans text-xs normal-case tracking-normal h-8" onClick={openAiScanner} data-testid="button-open-ai-workspace">
                         Open AI workspace <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <ul className="space-y-1">
                  {result.analysis.observations.map(item => <li key={item} className="rounded-sm bg-secondary/20 p-2 text-xs text-muted-foreground border border-border/50">• {item}</li>)}
                </ul>
                <p className="text-[10px] leading-relaxed text-muted-foreground/80">{result.analysis.limitations}</p>
              </div>
            )}

             {Array.isArray((scanBestMarket.data as any)?.markets) && (
              <div className="space-y-2 rounded-sm border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Fresh-market ranking</div>
                  <span className="font-mono text-[9px] text-muted-foreground">{(scanBestMarket.data as any)?.availableCount || 0} available</span>
                </div>
                 {(scanBestMarket.data as any).markets.slice(0, 5).map((market: any, index: number) => (
                   <button key={market.symbol} type="button" className="flex w-full items-center justify-between rounded-sm border border-border/50 bg-background/50 px-3 py-2 text-left transition-colors hover:border-primary/40" onClick={openAiScanner}>
                    <span>
                      <span className="mr-2 font-mono text-[10px] text-primary">#{index + 1}</span>
                      <span className="text-xs font-medium text-foreground">{market.displayName}</span>
                      <span className="ml-2 font-mono text-[9px] text-muted-foreground">{market.symbol}</span>
                      <span className="ml-2 font-mono text-[9px] uppercase text-muted-foreground">{formatVolatility(market.indicators?.volatilityLevel, market.indicators?.volatilityPct)} · {market.bias}</span>
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{market.score} pts</span>
                  </button>
                ))}
                <p className="font-mono text-[9px] leading-relaxed text-muted-foreground/80">{(scanBestMarket.data as any).disclaimer}</p>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-border pt-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Advisory only · no execution
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground/80">The scanner ranks fresh markets by observed historical signal hit rate only. It does not claim a guaranteed win percentage.</p>
          </>
        )}
      </div>
    </aside>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border/50 bg-background/50 p-2 text-center">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-foreground">{value}</div>
    </div>
  )
}
