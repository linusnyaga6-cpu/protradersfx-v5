import { Octagon, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TradingRunSessionState } from "@/hooks/use-trading-run-session"
import { useDisplayCurrency } from "@/hooks/use-display-currency"

export function RunSessionSummary({ state, currency, onStart, onStop, disabled, label = "Run Bot", runNoun: requestedRunNoun }: {
  state: TradingRunSessionState
  currency: string
  onStart?: () => void
  onStop?: () => void
  disabled?: boolean
  label?: string
  runNoun?: string
}) {
  const active = state.status === "running" || state.status === "stopping"
  const display = useDisplayCurrency(currency)
  const signedProfit = display.formatSignedMoney(state.netProfit)
  const runNoun = requestedRunNoun || "Bot"
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4" data-testid="card-run-session">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Live trade results</span>
          <Badge variant={active ? "success" : state.status === "failed" ? "destructive" : "outline"} className="uppercase">{state.status}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={display.currency} onValueChange={display.chooseCurrency}>
            <SelectTrigger className="h-8 w-[112px] bg-background text-xs" data-testid="select-session-currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="KES">KES (KSh)</SelectItem>
            </SelectContent>
          </Select>
          {active ? (
              <Button type="button" variant="destructive" size="sm" onClick={onStop} disabled={state.status === "stopping"} data-testid="button-stop-bot">
               <Octagon className="mr-2 h-3.5 w-3.5" />{state.status === "stopping" ? `Stopping ${runNoun}…` : `Stop ${runNoun}`}
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={onStart} disabled={disabled} data-testid="button-run-bot">
              <Play className="mr-2 h-3.5 w-3.5" />{label}
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SessionMetric label="Completed runs" value={`${state.completedRuns}/${state.totalRuns || "—"}`} />
        <SessionMetric label="Net profit" value={state.completedRuns ? signedProfit : "Not settled"} />
        <SessionMetric label="Current run" value={active ? `${state.currentRun}/${state.totalRuns}` : state.status === "idle" ? "Ready" : "Finished"} />
      </div>
      {state.message && <p className="text-xs leading-5 text-muted-foreground" aria-live="polite">{state.message}</p>}
      {state.results.length > 0 && (
        <div className="space-y-2 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest">
            <span>Results as they arrive</span>
            <span>{display.conversionLabel}</span>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {state.results.map(item => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-background/40 p-2.5" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">Run {item.run} · {item.status}</span>
                <span className="font-mono">{item.netProfit == null ? (item.status === "pending" ? "Awaiting settlement" : "No realized P/L") : display.formatSignedMoney(item.netProfit)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {item.symbol && <span>{item.symbol}</span>}
                {item.stake != null && <span>Stake {display.formatMoney(item.stake)}</span>}
                {item.payout != null && <span>Payout {display.formatMoney(item.payout)}</span>}
                {item.outcome && <span>Outcome {item.outcome}</span>}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
      {state.results.length === 0 && state.status === "idle" && <p className="text-xs text-muted-foreground">Start the session to see each proposal, open contract, and provider settlement here.</p>}
    </div>
  )
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-background/50 p-2"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xs font-semibold">{value}</div></div>
}