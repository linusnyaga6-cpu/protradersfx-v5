import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDisplayCurrency } from "@/hooks/use-display-currency"

export function BotRunSummary({ runs, accountCurrency }: { runs: any[]; accountCurrency?: string }) {
  const display = useDisplayCurrency(accountCurrency)
  const displayAmount = (value: number) => {
    return display.formatMoney(value)
  }
  const summary = useMemo(() => {
    const result = runs.reduce((acc: { stake: number; payout: number; profitLoss: number; runs: number; won: number; lost: number; settled: number; payoutKnown: number; profitKnown: number }, run: any) => {
      const result = run.result ?? {}
      const settlement = findSettlement(result)
      const exactInputs = result.exactInputs ?? {}
      const stake = numeric(settlement?.stake ?? settlement?.buyPrice)
      const configuredStake = numeric(exactInputs.stake ?? result.stake)
      const payout = numeric(settlement?.payout)
      const explicitProfitLoss = numeric(settlement?.netProfit ?? settlement?.profit)
      const profitLoss = explicitProfitLoss
      const outcome = String(settlement?.outcome ?? settlement?.status ?? "").toLowerCase()
      return {
        stake: acc.stake + (stake ?? configuredStake ?? 0),
        payout: acc.payout + (payout ?? 0),
        profitLoss: acc.profitLoss + (profitLoss ?? 0),
        runs: acc.runs + 1,
        won: acc.won + (outcome === "won" || outcome === "win" || settlement?.isWin === true ? 1 : 0),
        lost: acc.lost + (outcome === "lost" || outcome === "loss" || settlement?.isWin === false ? 1 : 0),
        settled: acc.settled + (settlement ? 1 : 0),
        payoutKnown: acc.payoutKnown + (settlement && payout != null ? 1 : 0),
        profitKnown: acc.profitKnown + (settlement && profitLoss != null ? 1 : 0),
      }
    }, { stake: 0, payout: 0, profitLoss: 0, runs: 0, won: 0, lost: 0, settled: 0, payoutKnown: 0, profitKnown: 0 })
    return result
  }, [runs])
  const hasStake = summary.stake > 0
  const hasSettlement = summary.settled > 0
  const profitValue = hasSettlement
    ? summary.profitKnown < summary.settled
      ? "Unavailable"
      : display.formatSignedMoney(summary.profitLoss)
    : "Not settled"

  return (
    <Card className="border-primary/20 bg-primary/[.03] shadow-sm" data-testid="card-bot-run-summary">
      <CardHeader className="border-b bg-secondary/10 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Run summary</CardTitle>
            <CardDescription className="mt-1">Totals for this bot’s recorded runs.</CardDescription>
          </div>
          <Select value={display.currency} onValueChange={display.chooseCurrency}>
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
           <RunMetric label="Configured stake" value={hasStake ? displayAmount(summary.stake) : "—"} />
           <RunMetric label="Payout" value={hasSettlement ? (summary.payoutKnown < summary.settled ? "Unavailable" : displayAmount(summary.payout)) : "Not settled"} />
          <RunMetric label="Runs" value={String(summary.runs)} />
          <RunMetric label="Won contracts" value={String(summary.won)} positive={summary.won > 0} />
          <RunMetric label="Lost contracts" value={String(summary.lost)} positive={summary.lost === 0} />
            <RunMetric label="Settled net profit" value={profitValue} positive={hasSettlement && summary.profitKnown === summary.settled ? summary.profitLoss >= 0 : undefined} />
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {hasSettlement ? `${summary.settled} provider-settled contract${summary.settled === 1 ? "" : "s"} included. ${display.conversionLabel}.` : "Recorded bot evaluations are dry-run or advisory only. No provider settlement means no realized payout or net profit."}
        </div>
      </CardContent>
    </Card>
  )
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return value == null || value === "" || !Number.isFinite(parsed) ? null : parsed
}

function findSettlement(result: any) {
  const candidates = [result.providerSettlement, result.settlement, result.contract]
  return candidates.find((candidate: any) => {
    if (!candidate || typeof candidate !== "object") return false
    const status = String(candidate.status ?? candidate.outcome ?? "").toLowerCase()
    return candidate.settled === true
      || candidate.isSettled === true
      || ["won", "lost", "settled", "sold", "expired"].includes(status)
  }) ?? null
}

function RunMetric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border bg-background/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${positive === undefined ? "" : positive ? "text-success" : "text-destructive"}`}>{value}</div>
    </div>
  )
}