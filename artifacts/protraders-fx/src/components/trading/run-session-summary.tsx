import { Octagon, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"
import type { TradingRunSessionState } from "@/hooks/use-trading-run-session"

export function RunSessionSummary({ state, currency, onStart, onStop, disabled, label = "Run Bot" }: {
  state: TradingRunSessionState
  currency: string
  onStart?: () => void
  onStop?: () => void
  disabled?: boolean
  label?: string
}) {
  const active = state.status === "running" || state.status === "stopping"
  const signedProfit = `${state.netProfit >= 0 ? "+" : "-"}${formatMoney(Math.abs(state.netProfit), currency)}`
  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4" data-testid="card-run-session">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Trading session</span>
          <Badge variant={active ? "success" : state.status === "failed" ? "destructive" : "outline"} className="uppercase">{state.status}</Badge>
        </div>
        {active ? (
          <Button type="button" variant="destructive" size="sm" onClick={onStop} disabled={state.status === "stopping"} data-testid="button-stop-bot">
            <Octagon className="mr-2 h-3.5 w-3.5" />{state.status === "stopping" ? "Stopping…" : "Stop Bot"}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={onStart} disabled={disabled} data-testid="button-run-bot">
            <Play className="mr-2 h-3.5 w-3.5" />{label}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SessionMetric label="Completed runs" value={`${state.completedRuns}/${state.totalRuns || "—"}`} />
        <SessionMetric label="Net profit" value={state.completedRuns ? signedProfit : "Not settled"} />
        <SessionMetric label="Current run" value={active ? `${state.currentRun}/${state.totalRuns}` : state.status === "idle" ? "Ready" : "Finished"} />
      </div>
      {state.message && <p className="text-xs leading-5 text-muted-foreground">{state.message}</p>}
      {state.results.length > 0 && <div className="space-y-1 text-[11px] text-muted-foreground">{state.results.slice(-3).map(item => <div key={item.id} className="flex justify-between gap-3"><span>Run {item.run} · {item.status}</span><span>{item.netProfit == null ? "Awaiting settlement" : `${item.netProfit >= 0 ? "+" : ""}${formatMoney(item.netProfit, currency)}`}</span></div>)}</div>}
    </div>
  )
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-background/50 p-2"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xs font-semibold">{value}</div></div>
}