import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check, Hash, LineChart, ListChecks, Radio } from "lucide-react"
import { Link } from "wouter"
import { cn } from "@/lib/utils"
import { CONTRACT_LABELS } from "@/lib/markets"

type JourneyStep = "markets" | "analysis" | "manual" | "results"

const JOURNEY_STEPS: Array<{ key: JourneyStep; label: string; detail: string }> = [
  { key: "markets", label: "Markets", detail: "Read live quote" },
  { key: "analysis", label: "Analysis", detail: "Review context" },
  { key: "manual", label: "Manual Trader", detail: "Review order" },
  { key: "results", label: "Results", detail: "Confirm settlement" },
]

const stepIcon: Record<JourneyStep, typeof BarChart3> = {
  markets: BarChart3,
  analysis: LineChart,
  manual: ListChecks,
  results: Check,
}

export function TradingJourney({
  current,
  symbol,
  contractType,
  resultReady = false,
}: {
  current: JourneyStep
  symbol?: string
  contractType?: string
  resultReady?: boolean
}) {
  const marketQuery = symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""
  const contractQuery = contractType && CONTRACT_LABELS[contractType] ? `&contract=${encodeURIComponent(contractType)}` : ""
  const destinations: Record<JourneyStep, string> = {
    markets: `/markets${marketQuery}`,
    analysis: `/analysis${marketQuery}`,
    manual: `/create-bot${marketQuery ? `${marketQuery}${contractQuery}` : contractQuery ? `?${contractQuery.slice(1)}` : ""}`,
    results: "#results",
  }

  return (
    <nav aria-label="Trading journey" className="rounded-xl border border-border/80 bg-card/75 p-2 shadow-sm" data-testid="nav-trading-journey">
      <div className="flex items-center justify-between gap-3 px-2 pb-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-primary">
          <Radio className="h-3.5 w-3.5" />
          Trading route
        </div>
        <div className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground sm:block">
          {contractType && CONTRACT_LABELS[contractType] ? `${CONTRACT_LABELS[contractType].action} contract` : "Demo-first workflow"}
        </div>
      </div>
      <ol className="grid gap-1 sm:grid-cols-4">
        {JOURNEY_STEPS.map((step, index) => {
          const Icon = stepIcon[step.key]
          const active = current === step.key
          const completed = JOURNEY_STEPS.findIndex(item => item.key === current) > index
          const available = step.key !== "results" || resultReady
          const content = (
            <>
              <span className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[10px] transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : completed ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground",
              )}>
                {completed ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 text-left">
                <span className={cn("block truncate text-xs font-semibold", active ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                <span className="hidden truncate text-[9px] text-muted-foreground md:block">{step.detail}</span>
              </span>
              {index < JOURNEY_STEPS.length - 1 && <ArrowRight className="ml-auto hidden h-3.5 w-3.5 text-border sm:block" />}
            </>
          )

          return (
            <li key={step.key} className="min-w-0">
              {available ? (
                <Link
                  href={destinations[step.key]}
                  className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/70", active && "bg-primary/[.07]")}
                  aria-current={active ? "step" : undefined}
                  data-testid={`link-journey-${step.key}`}
                >
                  {content}
                </Link>
              ) : (
                <span className="flex min-h-11 w-full cursor-not-allowed items-center gap-2 rounded-lg px-2 py-1.5 opacity-50" aria-disabled="true" data-testid={`status-journey-${step.key}`}>
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function ContractExplainer({
  contractType,
  barrier,
  lastDigit,
}: {
  contractType: string
  barrier?: string
  lastDigit?: number | null
}) {
  const label = CONTRACT_LABELS[contractType]
  if (!label) return null
  const isRise = contractType === "CALL"
  const isFall = contractType === "PUT"
  const digit = lastDigit == null ? "7" : String(lastDigit)
  const barrierValue = barrier || "5"
  const example = isRise
    ? "Example: entry 123.450 → final quote above 123.450 settles as Rise."
    : isFall
      ? "Example: entry 123.450 → final quote below 123.450 settles as Fall."
      : contractType === "DIGITOVER"
        ? `Example: last digit ${digit} > barrier ${barrierValue} settles as Over.`
        : contractType === "DIGITUNDER"
          ? `Example: last digit ${digit} < barrier ${barrierValue} settles as Under.`
          : contractType === "DIGITEVEN"
            ? `Example: last digit ${digit} is ${Number(digit) % 2 === 0 ? "even" : "odd"}; the final digit decides settlement.`
            : `Example: last digit ${digit} is ${Number(digit) % 2 === 1 ? "odd" : "even"}; the final digit decides settlement.`
  const Icon = isRise ? ArrowUpRight : isFall ? ArrowDownRight : Hash

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/[.045] p-3" data-testid="card-contract-explainer">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Selected contract</span>
            <span className="rounded-sm border border-primary/20 bg-background/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider">{contractType}</span>
          </div>
          <p className="mt-1 text-sm font-semibold">{label.action} · {label.family}</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{label.hint || "The provider settles this contract from the final market condition."}</p>
          <p className="mt-2 border-t border-primary/10 pt-2 text-[11px] leading-5 text-foreground/75">{example}</p>
        </div>
      </div>
    </section>
  )
}