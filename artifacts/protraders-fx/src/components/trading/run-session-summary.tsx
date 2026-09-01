import { useEffect, useRef, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Octagon, Play, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TradingRunSessionState } from "@/hooks/use-trading-run-session"
import { useDisplayCurrency } from "@/hooks/use-display-currency"
import { PostTradeResultDialog } from "./post-trade-result-dialog"

export function RunSessionSummary({ state, currency, onStart, onStop, onReset, disabled, label = "Run Bot" }: {
  state: TradingRunSessionState
  currency: string
  onStart?: () => void
  onStop?: () => void
  onReset?: () => void
  disabled?: boolean
  label?: string
  runNoun?: string
}) {
  const active = state.status === "running" || state.status === "stopping"
  const display = useDisplayCurrency(currency)
  const signedProfit = display.formatSignedMoney(state.netProfit)
  const [resultDialogOpen, setResultDialogOpen] = useState(false)
  const shownResultId = useRef<string | null>(null)
  const sessionFinished = ["completed", "stopped", "failed"].includes(state.status)
  const terminalResult = sessionFinished
    ? [...state.results].reverse().find(item => ["won", "lost", "settled", "rejected"].includes(item.status))
    : undefined

  useEffect(() => {
    if (!terminalResult || shownResultId.current === terminalResult.id) return
    shownResultId.current = terminalResult.id
    setResultDialogOpen(true)
  }, [terminalResult])

  const resetResults = () => {
    setResultDialogOpen(false)
    shownResultId.current = null
    onReset?.()
  }

  const runAgain = () => {
    setResultDialogOpen(false)
    shownResultId.current = null
    onStart?.()
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-[0_8px_25px_hsl(174_69%_35%/.06)]" data-testid="card-run-session">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
           <span className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Session</span>
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
                <Octagon className="mr-2 h-3.5 w-3.5" />{state.status === "stopping" ? "Stopping…" : "Stop"}
            </Button>
          ) : (
            <>
              {(state.results.length > 0 || state.status !== "idle") && onReset && (
                <Button type="button" variant="outline" size="sm" onClick={resetResults} data-testid="button-reset-results">
                   <RotateCcw className="mr-2 h-3.5 w-3.5" />Reset
                </Button>
              )}
              <Button type="button" size="sm" onClick={onStart} disabled={disabled} data-testid="button-run-bot">
                <Play className="mr-2 h-3.5 w-3.5" />{label}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
         <SessionMetric label="Runs" value={`${state.completedRuns}/${state.totalRuns || "—"}`} />
         <SessionMetric label="P/L" value={state.completedRuns ? signedProfit : "Not settled"} />
         <SessionMetric label="Run" value={active ? `${state.currentRun}/${state.totalRuns}` : state.status === "idle" ? "Ready" : "Closed"} />
      </div>
       {state.message && <p className="truncate text-xs text-muted-foreground" title={state.message} aria-live="polite">{compactSessionMessage(state)}</p>}
      {state.results.length > 0 && (
        <div className="space-y-2 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest">
             <span>Transactions</span>
            <span>{display.conversionLabel}</span>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {state.results.map(item => (
             <div
               key={item.id}
               className="grid min-w-0 grid-cols-[minmax(68px,.68fr)_minmax(96px,1fr)_minmax(82px,.8fr)] items-center gap-1.5 rounded-md border border-border/80 bg-background/55 px-2 py-2"
               aria-label={resultA11yLabel(item, display.currency)}
               aria-live="polite"
             >
               <div className="flex min-w-0 items-center gap-2">
                 <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${item.contractType === "PUT" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                   {item.contractType === "PUT" ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                 </span>
                 <div className="min-w-0">
                   <div className="flex items-center gap-1.5">
                     <span className="font-mono text-[10px] font-semibold text-foreground">{item.contractType || "—"}</span>
                     <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${resultStatusTone(item.status)}`} />
                   </div>
                   <div className="truncate text-[9px] text-muted-foreground">#{String(item.run).padStart(2, "0")} · {item.symbol || "—"}</div>
                 </div>
               </div>
               <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
                 <SpotValue label="Entry" value={formatSpot(item.entrySpot)} />
                 <span className="text-muted-foreground/60">→</span>
                 <SpotValue label="Exit" value={formatSpot(item.exitSpot)} />
               </div>
               <div className="min-w-0 text-right">
                 <div className="truncate font-mono text-[10px] font-semibold text-foreground">{item.buyPrice == null ? "—" : display.formatMoney(item.buyPrice)}</div>
                 <div className={`truncate font-mono text-[10px] font-semibold ${item.netProfit == null ? "text-muted-foreground" : item.netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                   {item.netProfit == null ? "Pending" : display.formatSignedMoney(item.netProfit)}
                 </div>
               </div>
            </div>
          ))}
          </div>
        </div>
      )}
       {state.results.length === 0 && state.status === "idle" && <p className="text-xs text-muted-foreground">Transactions will appear here.</p>}
       {terminalResult && (
         <PostTradeResultDialog
           result={terminalResult}
           sessionMessage={state.message}
           sessionStatus={state.status}
           currency={currency}
           open={resultDialogOpen}
           onOpenChange={setResultDialogOpen}
           onRunAgain={onStart && !active ? runAgain : undefined}
         />
       )}
    </div>
  )
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/80 bg-background/65 p-2.5"><div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xs font-semibold">{value}</div></div>
}

function SpotValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-[10px] font-semibold text-foreground">{value}</div>
    </div>
  )
}

function resultStatusTone(status: string) {
  if (status === "won" || status === "settled") return "bg-success"
  if (status === "lost" || status === "rejected") return "bg-destructive"
  if (status === "pending") return "animate-pulse bg-amber-500"
  return "bg-muted-foreground"
}

function compactSessionMessage(state: TradingRunSessionState) {
  if (state.status === "running") return `Run ${state.currentRun}/${state.totalRuns} · live`
  if (state.status === "stopping") return "Stopping after current contract"
  if (state.status === "completed") return "Run plan complete"
  if (state.status === "stopped") return "Stopped"
   if (state.status === "failed") return state.message || "Run failed"
  return state.message
}

function resultA11yLabel(item: TradingRunSessionState["results"][number], currency: string) {
  const fields = [
    `Run ${item.run}`,
    item.status,
    item.contractType || "contract type unavailable",
    item.symbol || "market unavailable",
    `entry ${formatSpot(item.entrySpot)}`,
    `exit ${formatSpot(item.exitSpot)}`,
    `buy price ${item.buyPrice == null ? "unavailable" : `${item.buyPrice} ${currency}`}`,
    `P/L ${item.netProfit == null ? "pending" : `${item.netProfit} ${currency}`}`,
    item.stake == null ? "" : `stake ${item.stake} ${currency}`,
    item.payout == null ? "" : `payout ${item.payout} ${currency}`,
    item.outcome ? `outcome ${item.outcome}` : "",
    item.message,
  ]
  return fields.filter(Boolean).join(". ")
}

function formatSpot(value: number | null | undefined) {
  return value == null || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(5).replace(/0+$/, "").replace(/\.$/, "")
}
