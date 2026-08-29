import { useMemo, useState } from "react"
import { getGetMarketTickerQueryKey, useGetMarketTicker } from "@workspace/api-client-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatMoney } from "@/lib/format"

export function BotRunSummary({ runs, accountCurrency }: { runs: any[]; accountCurrency?: string }) {
  const [currency, setCurrency] = useState<"USD" | "KES">(() => {
    if (typeof window === "undefined") return "USD"
    return window.localStorage.getItem("protraders-display-currency") === "KES" ? "KES" : "USD"
  })
  const sourceCurrency = String(accountCurrency || "USD").toUpperCase()
  const canConvert = sourceCurrency === "USD" || sourceCurrency === "KES"
  const conversion = useGetMarketTicker("frxUSDKES", {
    query: {
      queryKey: getGetMarketTickerQueryKey("frxUSDKES"),
      enabled: canConvert && sourceCurrency !== currency,
      refetchInterval: 30000,
    },
  })
  const conversionRate = Number((conversion.data as any)?.quote ?? (conversion.data as any)?.price)
  const hasRate = sourceCurrency === currency || (Number.isFinite(conversionRate) && conversionRate > 0 && (conversion.data as any)?.available !== false)
  const displayAmount = (value: number) => {
    if (!hasRate) return "Rate unavailable"
    const converted = sourceCurrency === currency
      ? value
      : sourceCurrency === "USD" && currency === "KES"
        ? value * conversionRate
        : value / conversionRate
    return formatMoney(converted, currency)
  }
  const summary = useMemo(() => {
    const result = runs.reduce((acc: { stake: number; payout: number; profitLoss: number; runs: number; won: number; lost: number; settled: number }, run: any) => {
      const result = run.result ?? {}
      const contract = result.contract ?? result.settlement ?? {}
      const stake = numeric(result.exactInputs?.stake ?? result.stake ?? contract.stake)
      const payout = numeric(result.payout ?? contract.payout)
      const explicitProfitLoss = numeric(result.netProfit ?? result.profitLoss ?? contract.profitLoss ?? contract.profit)
      const profitLoss = explicitProfitLoss ?? (payout != null && stake != null ? payout - stake : null)
      const outcome = String(result.outcome ?? contract.outcome ?? contract.status ?? "").toLowerCase()
      return {
        stake: acc.stake + (stake ?? 0),
        payout: acc.payout + (payout ?? 0),
        profitLoss: acc.profitLoss + (profitLoss ?? 0),
        runs: acc.runs + 1,
        won: acc.won + (outcome === "won" || outcome === "win" || contract.isWin === true ? 1 : 0),
        lost: acc.lost + (outcome === "lost" || outcome === "loss" || contract.isWin === false ? 1 : 0),
        settled: acc.settled + (payout != null || profitLoss != null || outcome === "won" || outcome === "win" || outcome === "lost" || outcome === "loss" ? 1 : 0),
      }
    }, { stake: 0, payout: 0, profitLoss: 0, runs: 0, won: 0, lost: 0, settled: 0 })
    return result
  }, [runs])
  const hasStake = summary.stake > 0
  const hasSettlement = summary.settled > 0
  const chooseCurrency = (next: string) => {
    if (next !== "USD" && next !== "KES") return
    setCurrency(next)
    window.localStorage.setItem("protraders-display-currency", next)
  }
  const profitValue = hasSettlement
    ? hasRate
      ? `${summary.profitLoss >= 0 ? "+" : "-"}${displayAmount(Math.abs(summary.profitLoss))}`
      : "Rate unavailable"
    : "Not settled"

  return (
    <Card className="border-primary/20 bg-primary/[.03] shadow-sm" data-testid="card-bot-run-summary">
      <CardHeader className="border-b bg-secondary/10 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Run summary</CardTitle>
            <CardDescription className="mt-1">Totals for this bot’s recorded runs.</CardDescription>
          </div>
          <Select value={currency} onValueChange={chooseCurrency}>
            <SelectTrigger className="h-9 w-[112px] bg-background" data-testid="select-bot-summary-currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="KES">KES (KSh)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <RunMetric label="Total stake" value={hasStake ? displayAmount(summary.stake) : "—"} />
          <RunMetric label="Payout" value={hasSettlement ? displayAmount(summary.payout) : "Not settled"} />
          <RunMetric label="Runs" value={String(summary.runs)} />
          <RunMetric label="Won contracts" value={String(summary.won)} positive={summary.won > 0} />
          <RunMetric label="Lost contracts" value={String(summary.lost)} positive={summary.lost === 0} />
          <RunMetric label="Total profit/loss" value={profitValue} positive={hasSettlement ? summary.profitLoss >= 0 : undefined} />
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {hasSettlement ? `${summary.settled} settled contract${summary.settled === 1 ? "" : "s"} included. Display currency: ${currency}${sourceCurrency !== currency ? " · converted at live USD/KES rate." : "."}` : "Dry-run only: no contracts were placed, so payout and profit/loss remain unavailable. Stake is simulation metadata."}
        </div>
      </CardContent>
    </Card>
  )
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return value == null || value === "" || !Number.isFinite(parsed) ? null : parsed
}

function RunMetric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${positive === undefined ? "" : positive ? "text-success" : "text-destructive"}`}>{value}</div>
    </div>
  )
}