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
              Live digits
              <span className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-success">
                <Activity className="h-3 w-3" /> live
              </span>
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[.14em] text-muted-foreground">Tick frequency</div>
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
            className="absolute top-2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-primary bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/.12)] transition-[left] duration-500 ease-out"
            style={{ left: `calc(${activeDigit * 10}% + 5%)` }}
            data-testid="digit-cursor"
            aria-hidden="true"
          />
        )}
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 sm:gap-1.5">
          {Array.from({ length: 10 }, (_, digit) => {
            const isLive = activeDigit === digit
            const isBarrier = selectedDigit === digit
            const percentage = digitPercentages[digit]
            return (
              <div key={digit} className="text-center" data-testid={`digit-monitor-${digit}`}>
                <div
                  className={`mx-auto flex aspect-square w-full max-w-[4.5rem] flex-col items-center justify-center rounded-full border font-mono transition-all duration-300 ${
                    isLive
                      ? "scale-105 border-primary bg-primary text-primary-foreground shadow-[0_6px_18px_hsl(var(--primary)/.22)]"
                      : isBarrier
                        ? "border-amber-500 bg-amber-500/10 text-amber-700 ring-2 ring-amber-500/20 dark:text-amber-300"
                        : "border-success/30 bg-success/[.06] text-success/80"
                  }`}
                  aria-label={`Digit ${digit}, ${percentage != null && digitPercentages.length ? `${percentage}% observed` : "no observations"}${isBarrier ? ", selected barrier" : ""}`}
                >
                  <span className="text-base font-semibold leading-none">{digit}</span>
                  <span className={`mt-1 text-[10px] font-semibold leading-none ${isLive ? "text-primary-foreground/80" : isBarrier ? "text-amber-700/80 dark:text-amber-200/80" : "text-success/75"}`}>
                    {percentage != null && digitPercentages.length ? `${percentage}%` : "—"}
                  </span>
                </div>
                {isBarrier && <div className="text-[8px] uppercase tracking-wider text-amber-700 dark:text-amber-300">chosen</div>}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-[9px] uppercase tracking-[.13em] text-muted-foreground">
          <span>Last digit · 0—9</span>
          <span className="font-mono">{digitPercentages.length ? "Tick share" : "Waiting"}</span>
        </div>
      </div>
    </div>
  )
}

export function OverUnderTabs({
  value,
  availableTypes,
  disabled = false,
  onSelect,
}: {
  value: string
  availableTypes: string[]
  disabled?: boolean
  onSelect: (contractType: "DIGITOVER" | "DIGITUNDER") => void
}) {
  const options = [
    { type: "DIGITOVER" as const, label: "Over", hint: "last digit > barrier", tone: "success" },
    { type: "DIGITUNDER" as const, label: "Under", hint: "last digit < barrier", tone: "destructive" },
  ]

  return (
    <div className="rounded-lg border border-primary/20 bg-card/80 p-3" data-testid="over-under-tabs">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Over / Under</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">One-tap run</div>
        </div>
        <span className="rounded-md border border-border/70 bg-background/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {value === "DIGITOVER" ? "OVER" : value === "DIGITUNDER" ? "UNDER" : "SELECT"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map(option => {
          const selected = value === option.type
          const available = availableTypes.includes(option.type)
          const activeClasses = option.tone === "success"
            ? "border-success bg-success text-success-foreground shadow-sm"
            : "border-destructive bg-destructive text-destructive-foreground shadow-sm"
          const idleClasses = option.tone === "success"
            ? "border-success/35 text-success hover:bg-success/10"
            : "border-destructive/35 text-destructive hover:bg-destructive/10"
          return (
            <button
              key={option.type}
              type="button"
              className={`min-h-[3.75rem] rounded-md border px-2 py-2 text-left transition-all ${selected ? activeClasses : `bg-background ${idleClasses}`} ${!available || disabled ? "cursor-not-allowed opacity-45" : ""}`}
              onClick={() => onSelect(option.type)}
              disabled={!available || disabled}
              aria-pressed={selected}
              data-testid={`button-quick-${option.type.toLowerCase()}`}
            >
              <span className="block text-sm font-bold uppercase tracking-wide">{option.label}</span>
              <span className={`mt-1 block text-[9px] font-normal leading-3 ${selected ? "opacity-80" : "opacity-70"}`}>{option.hint}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Uses current ticket values.</p>
    </div>
  )
}