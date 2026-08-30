import { Badge } from "@/components/ui/badge"

export function DigitRail({ activeDigit, selectedDigit = null }: { activeDigit: number | null; selectedDigit?: number | null }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background/60 p-4" data-testid="live-digit-rail">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold">Live last digit</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[.16em] text-muted-foreground">Cursor follows the latest quote</div>
        </div>
        <Badge variant={activeDigit == null ? "secondary" : "outline"} className="font-mono">
          {activeDigit == null ? "WAITING" : `DIGIT ${activeDigit}`}
        </Badge>
      </div>
      <div className="relative mt-6 pt-3">
        {activeDigit != null && (
          <div
            className="absolute top-0 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-primary bg-primary transition-[left] duration-500 ease-out"
            style={{ left: `calc(${activeDigit * 10}% + 5%)` }}
            aria-hidden="true"
          />
        )}
        <div className="grid grid-cols-10 gap-1.5">
          {Array.from({ length: 10 }, (_, digit) => {
            const isLive = activeDigit === digit
            const isBarrier = selectedDigit === digit
            return (
              <div key={digit} className="text-center">
                <div
                  className={`mx-auto grid aspect-square w-full max-w-9 place-items-center rounded-full border font-mono text-xs transition-all duration-300 ${
                    isLive
                      ? "scale-110 border-primary bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/.35)]"
                      : isBarrier
                        ? "border-amber-500/70 bg-amber-500/10 text-amber-500"
                        : "border-border bg-secondary/30 text-muted-foreground"
                  }`}
                >
                  {digit}
                </div>
                {isBarrier && <div className="mt-1 text-[8px] uppercase tracking-wider text-amber-500">barrier</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}