import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Activity, GripHorizontal, Loader2, Maximize2, RefreshCw, ShieldCheck, X } from "lucide-react"
import {
  getGetMarketCandlesQueryKey,
  getGetMarketTickerQueryKey,
  getGetSessionStatusQueryKey,
  useAnalyzeMarket,
  useGetMarketCandles,
  useGetMarketTicker,
  useGetSessionStatus,
} from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const symbols = ["R_100", "R_75", "R_50", "R_25", "1HZ100V"]

type ScannerResult = {
  symbol: string
  asOf: string
  source: "deterministic" | "ai-advisory"
  advisoryOnly: true
  indicators: { ema9: number; ema21: number; rsi14: number; macdHistogram: number; trend: string }
  analysis: { summary: string; bias: "bullish" | "bearish" | "neutral"; observations: string[]; limitations: string }
}

export function FloatingScanner() {
  const { data: session } = useGetSessionStatus({ query: { queryKey: getGetSessionStatusQueryKey() } })
  const [open, setOpen] = useState(false)
  const [symbol, setSymbol] = useState("R_100")
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [result, setResult] = useState<ScannerResult | null>(null)
  const [error, setError] = useState("")
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const analyzeMarket = useAnalyzeMarket()
  const ticker = useGetMarketTicker(symbol, { query: { queryKey: getGetMarketTickerQueryKey(symbol), enabled: !!session?.authenticated && open, refetchInterval: 5000 } })
  const candleParams = { count: 60, granularity: 60 }
  const candles = useGetMarketCandles(symbol, candleParams, { query: { queryKey: getGetMarketCandlesQueryKey(symbol, candleParams), enabled: !!session?.authenticated && open, staleTime: 30000 } })

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener("protraders:open-scanner", show)
    return () => window.removeEventListener("protraders:open-scanner", show)
  }, [])

  if (!session?.authenticated) return null

  const analyze = () => {
    setError("")
    analyzeMarket.mutate({ data: { symbol } }, {
      onSuccess: (body) => setResult(body as ScannerResult),
      onError: (scannerError) => setError(scannerError instanceof Error ? scannerError.message : "Scanner unavailable"),
    })
  }

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.matchMedia("(max-width: 767px)").matches) return
    drag.current = { x: position.x, y: position.y, startX: event.clientX, startY: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setPosition({
      x: Math.min(0, Math.max(-(window.innerWidth - 390), drag.current.x + event.clientX - drag.current.startX)),
      y: Math.min(window.innerHeight - 180, Math.max(-(window.innerHeight - 220), drag.current.y + event.clientY - drag.current.startY)),
    })
  }

  if (!open) {
    return (
      <Button
        className="fixed bottom-5 right-5 z-[70] gap-2 rounded-full shadow-[0_14px_50px_rgba(0,0,0,.45)]"
        onClick={() => setOpen(true)}
        data-testid="button-open-scanner"
      >
        <Activity className="h-4 w-4" /> AI Scanner
      </Button>
    )
  }

  const tick = ticker.data as any
  const candleData = candles.data as any
  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[70] max-h-[82vh] overflow-hidden rounded-2xl border border-primary/25 bg-card/95 shadow-[0_24px_90px_rgba(0,0,0,.6)] backdrop-blur-xl md:inset-auto md:right-5 md:top-24 md:w-[370px]"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      aria-label="Movable AI market scanner"
      data-testid="panel-ai-scanner"
    >
      <div
        className="flex touch-none cursor-grab items-center justify-between border-b border-white/10 bg-secondary/40 px-4 py-3 active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => { drag.current = null }}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="hidden h-4 w-4 text-muted-foreground md:block" />
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Market Scanner</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close scanner">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="max-h-[calc(82vh-48px)] space-y-4 overflow-y-auto p-4">
        <div className="flex gap-2">
          <Select value={symbol} onValueChange={(value) => { setSymbol(value); setResult(null); setError("") }}>
            <SelectTrigger className="bg-background/70"><SelectValue /></SelectTrigger>
            <SelectContent>{symbols.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={analyze} disabled={analyzeMarket.isPending || ticker.isLoading || candles.isLoading} data-testid="button-run-scanner">
            {analyzeMarket.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Run analysis</span>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Latest quote" value={tick?.available === false ? "Offline" : String(tick?.quote ?? "—")} />
          <Metric label="Data status" value={candles.isFetching ? "Syncing" : candleData?.confidence ?? "Unavailable"} />
        </div>
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
        {!result && !error && (
          <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
            Select a market and run a fresh advisory scan.
          </div>
        )}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant={result.analysis.bias === "neutral" ? "outline" : result.analysis.bias === "bullish" ? "success" : "destructive"}>
                {result.analysis.bias.toUpperCase()}
              </Badge>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{result.source === "ai-advisory" ? "AI explained" : "Deterministic fallback"}</span>
            </div>
            <p className="text-sm leading-6">{result.analysis.summary}</p>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="RSI 14" value={result.indicators.rsi14.toFixed(1)} />
              <Metric label="EMA trend" value={result.indicators.trend} />
              <Metric label="MACD hist." value={result.indicators.macdHistogram.toFixed(4)} />
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {result.analysis.observations.map(item => <li key={item} className="rounded-md bg-secondary/35 p-2">• {item}</li>)}
            </ul>
            <p className="text-[11px] leading-5 text-muted-foreground">{result.analysis.limitations}</p>
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Advisory only · no order execution
        </div>
      </div>
    </aside>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/5 bg-background/55 p-2"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs">{value}</div></div>
}