import { Badge } from "@/components/ui/badge"
import { Activity, Crosshair, Radar } from "lucide-react"

export function DigitRail({
  activeDigit,
  selectedDigit = null,
  digitPercentages = [],
}: {
  activeDigit: number | null
  selectedDigit?: number | null
  digitPercentages?: number[]
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-primary/20 bg-card/80" data-testid="live-digit-rail">
      <div className="flex flex-col gap-3 border-b border-border/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Radar className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              Last-digit monitor
              <span className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-success">
                <Activity className="h-3 w-3" /> observed
              </span>
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[.14em] text-muted-foreground">Frequency from the visible candle window</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedDigit != null && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Crosshair className="h-3 w-3" /> barrier {selectedDigit}
            </span>
          )}
          <Badge variant={activeDigit == null ? "secondary" : "outline"} className="font-mono text-[10px]">
            {activeDigit == null ? "WAITING" : `LIVE ${activeDigit}`}
          </Badge>
        </div>
      </div>
      <div className="relative px-3 pb-3 pt-5 sm:px-4">
        {activeDigit != null && (
          <div
            className="absolute top-2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-primary bg-primary transition-[left] duration-500 ease-out"
            style={{ left: `calc(${activeDigit * 10}% + 5%)` }}
            aria-hidden="true"
          />
        )}
        <div className="grid grid-cols-10 gap-1.5">
          {Array.from({ length: 10 }, (_, digit) => {
            const isLive = activeDigit === digit
            const isBarrier = selectedDigit === digit
            const percentage = digitPercentages[digit]
            return (
              <div key={digit} className="text-center" data-testid={`digit-monitor-${digit}`}>
                <div
                  className={`mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full border font-mono text-xs font-semibold transition-all duration-300 ${
                    isLive
                      ? "scale-110 border-primary bg-primary text-primary-foreground shadow-[0_6px_18px_hsl(var(--primary)/.22)]"
                      : isBarrier
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 ring-2 ring-amber-500/20 dark:text-amber-300"
                        : "border-success/30 bg-success/[.06] text-success/80"
                  }`}
                  aria-label={`Digit ${digit}, ${percentage != null && digitPercentages.length ? `${percentage}% observed` : "no observations"}${isBarrier ? ", selected barrier" : ""}`}
                >
                  {digit}
                </div>
                <div className={`mt-1 font-mono text-[9px] font-semibold ${isLive ? "text-primary" : isBarrier ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                  {percentage != null && digitPercentages.length ? `${percentage}%` : "—"}
                </div>
                {isBarrier && <div className="text-[8px] uppercase tracking-wider text-amber-700 dark:text-amber-300">chosen</div>}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-[9px] uppercase tracking-[.13em] text-muted-foreground">
          <span>0 — 9 last digit</span>
          <span className="font-mono">{digitPercentages.length ? "Observed %" : "Awaiting ticks"}</span>
        </div>
      </div>
    </div>
  )
}