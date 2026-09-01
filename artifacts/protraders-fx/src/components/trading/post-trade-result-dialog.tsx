import { CircleCheck, CircleX, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { TradingRunSessionState } from "@/hooks/use-trading-run-session"
import { useDisplayCurrency } from "@/hooks/use-display-currency"

type PostTradeResultDialogProps = {
  result: TradingRunSessionState["results"][number]
  sessionMessage: string
  sessionStatus: TradingRunSessionState["status"]
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRunAgain?: () => void
}

export function PostTradeResultDialog({
  result,
  sessionMessage,
  sessionStatus,
  currency,
  open,
  onOpenChange,
  onRunAgain,
}: PostTradeResultDialogProps) {
  const display = useDisplayCurrency(currency)
  const profit = result.netProfit == null ? null : Number(result.netProfit)
  const positive = profit != null ? profit >= 0 : ["won", "settled"].includes(result.status)
  const takeProfitReached = /take-profit target reached/i.test(sessionMessage)
  const title = takeProfitReached ? "Take Profit Reached" : positive ? "Trade Profit Recorded" : "Trade Closed"
  const resultLabel = result.outcome || result.status || "settled"
  const isTerminal = ["completed", "stopped", "failed"].includes(sessionStatus)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm overflow-hidden rounded-2xl border-border/80 bg-card p-0 shadow-[0_24px_80px_hsl(var(--foreground)/.22)]"
        data-testid="dialog-post-trade-result"
      >
        <DialogHeader className={`border-b px-6 py-5 pr-12 ${positive ? "bg-success/10" : "bg-destructive/10"}`}>
          <div className="flex items-center gap-3 text-left">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
              {positive ? <CircleCheck className="h-5 w-5" /> : <CircleX className="h-5 w-5" />}
            </span>
            <div>
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <DialogDescription className="mt-1 text-xs capitalize">{resultLabel}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-7 text-center">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[.24em] text-muted-foreground">Net profit</div>
          <div className={`mt-2 font-mono text-3xl font-bold tracking-tight ${profit == null ? "text-muted-foreground" : positive ? "text-success" : "text-destructive"}`}>
            {profit == null ? "Unavailable" : display.formatSignedMoney(profit)}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
             {isTerminal ? "All runs in this session are complete." : "This trade has settled. The session is continuing."}
          </p>
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground/70">
            {result.symbol || "Market unavailable"} · Run {String(result.run).padStart(2, "0")}
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 border-t bg-secondary/20 p-4 sm:space-x-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-trade-result">
            Close
          </Button>
          {onRunAgain && (
            <Button type="button" variant="destructive" onClick={onRunAgain} data-testid="button-run-again">
              <RotateCcw className="h-3.5 w-3.5" />
              Run Again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}