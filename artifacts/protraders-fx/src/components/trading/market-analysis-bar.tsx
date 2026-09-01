import { useEffect, useMemo, useState } from "react"
import { Activity, ArrowRight, BarChart3, CandlestickChart, Gauge, RefreshCw } from "lucide-react"
import { Link } from "wouter"
import {
  getGetMarketCandlesQueryKey,
  useGetMarketCandles,
} from "@workspace/api-client-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatVolatility } from "@/lib/format"
import { marketLabel } from "@/lib/markets"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"

const TIMEFRAMES = [
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
  { value: 900, label: "15m" },
  { value: 3600, label: "1h" },
]

type MarketAnalysisBarProps = {
  symbol: string
  onSymbolChange: (symbol: string) => void
  disabled?: boolean
  showMarketSelect?: boolean
  tone?: "default" | "dark"
}

export function MarketAnalysisBar({
  symbol,
  onSymbolChange,
  disabled = false,
  showMarketSelect = true,
  tone = "default",
}: MarketAnalysisBarProps) {
  const [granularity, setGranularity] = useState(300)
  const marketQuery = useDerivMarkets()
  const candleParams = useMemo(() => ({ count: 60, granularity }), [granularity])
  const candles = useGetMarketCandles(symbol, candleParams, {
    query: {
      queryKey: getGetMarketCandlesQueryKey(symbol, candleParams),
      enabled: Boolean(symbol),
      staleTime: 30_000,
      refetchInterval: 30_000,
    },
  })
  const history = candles.data as any
  const indicators = history?.indicators
  const closes = Array.isArray(history?.candles)
    ? history.candles.map((candle: any) => Number(candle.close)).filter(Number.isFinite)
    : []
  const trend = closes.length > 1
    ? closes.at(-1)! > closes.at(-2)! ? "Rising" : closes.at(-1)! < closes.at(-2)! ? "Falling" : "Flat"
    : "Waiting"
  const market = marketQuery.markets.find(item => item.symbol === symbol)
  const dark = tone === "dark"
  const shell = dark
    ? "border-[#0d514e] bg-[#000403] text-white"
    : "border-border/80 bg-card/70"
  const muted = dark ? "text-white/55" : "text-muted-foreground"
  const control = dark
    ? "border-[#159e98] bg-[#06110f] text-white"
    : "bg-background"

  useEffect(() => {
    if (marketQuery.markets.length && !marketQuery.markets.some(item => item.symbol === symbol)) {
      onSymbolChange(marketQuery.defaultSymbol)
    }
  }, [marketQuery.defaultSymbol, marketQuery.markets, onSymbolChange, symbol])

  return (
    <section className={`rounded-xl border p-3 shadow-sm md:p-4 ${shell}`} data-testid="panel-market-analysis-controls">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${dark ? "bg-[#18b8ad]/15 text-[#6ee7df]" : "bg-primary/10 text-primary"}`}>
            <CandlestickChart className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] ${muted}`}>
              <Activity className="h-3 w-3" /> Market context
            </div>
            <div className="mt-1 truncate text-sm font-semibold">{marketLabel(market, symbol)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showMarketSelect ? (
            <Select value={symbol} onValueChange={onSymbolChange} disabled={disabled || marketQuery.isLoading || !marketQuery.markets.length}>
              <SelectTrigger className={`h-9 min-w-[190px] font-mono text-xs ${control}`} data-testid="select-volatility-market">
                <SelectValue placeholder={marketQuery.isLoading ? "Loading markets…" : "Choose volatility"} />
              </SelectTrigger>
              <SelectContent>
                {marketQuery.markets.map(item => (
                  <SelectItem key={item.symbol} value={item.symbol}>
                    <span>{item.displayName}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{item.symbol}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className={`font-mono text-[10px] ${dark ? "border-[#159e98]/60 text-[#a5f3ec]" : ""}`}>{symbol}</Badge>
          )}
          <Button asChild size="sm" variant="outline" className={dark ? "border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white" : ""}>
            <Link href={`/analysis?symbol=${encodeURIComponent(symbol)}`} data-testid="link-open-market-analysis">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Open analysis
            </Link>
          </Button>
        </div>
      </div>

      <div className={`mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between ${dark ? "border-white/10" : "border-border/70"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`mr-1 text-[10px] uppercase tracking-[.15em] ${muted}`}>Analysis window</span>
          {TIMEFRAMES.map(timeframe => (
            <Button
              key={timeframe.value}
              type="button"
              size="sm"
              variant={granularity === timeframe.value ? "default" : "ghost"}
              className={`h-8 px-3 text-xs ${dark && granularity !== timeframe.value ? "text-white/65 hover:bg-white/10 hover:text-white" : ""}`}
              onClick={() => setGranularity(timeframe.value)}
              disabled={disabled}
              data-testid={`button-market-timeframe-${timeframe.label}`}
            >
              {timeframe.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <ContextMetric icon={<Gauge className="h-3 w-3" />} label="Volatility" value={formatVolatility(indicators?.volatilityLevel, indicators?.volatilityPct)} muted={muted} valueClassName={dark ? "text-white" : "text-foreground"} />
          <ContextMetric label="Read" value={trend} muted={muted} valueClassName={dark ? "text-white" : "text-foreground"} />
          <ContextMetric label="RSI" value={indicators?.rsi14 == null ? "—" : String(indicators.rsi14)} muted={muted} valueClassName={dark ? "text-white" : "text-foreground"} />
          <Button type="button" size="icon" variant="ghost" onClick={() => void candles.refetch()} disabled={candles.isFetching || disabled} aria-label="Refresh market analysis" className={dark ? "text-white/65 hover:bg-white/10 hover:text-white" : ""}>
            <RefreshCw className={candles.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
        </div>
      </div>

      <div className={`mt-2 flex items-center justify-between gap-3 text-[10px] ${muted}`}>
        <span>{candles.isError ? "Analysis feed unavailable; try another window." : `${closes.length || "—"} candle closes · live Deriv context`}</span>
        <Link href={`/analysis?symbol=${encodeURIComponent(symbol)}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          Change analysis <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  )
}

function ContextMetric({ icon, label, value, muted, valueClassName }: { icon?: React.ReactNode; label: string; value: string; muted: string; valueClassName: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${muted} ${muted.includes("white") ? "border-white/10 bg-white/[.04]" : "border-border/70 bg-background/45"}`}>
      {icon}{label}: <strong className={`font-mono font-semibold ${valueClassName}`}>{value}</strong>
    </span>
  )
}