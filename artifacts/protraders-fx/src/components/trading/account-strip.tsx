import { useState } from "react"
import { ArrowLeftRight, UserRound, Wallet } from "lucide-react"
import { getGetMarketTickerQueryKey, useGetMarketTicker } from "@workspace/api-client-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatMoney } from "@/lib/format"

type AccountStripProps = {
  account?: any
  isLoading?: boolean
  error?: boolean
}

export function AccountStrip({ account, isLoading, error }: AccountStripProps) {
  const accountType = account?.accountType === "real" ? "real" : "demo"
  const currency = String(account?.currency || "USD").toUpperCase()
  const canConvert = currency === "USD" || currency === "KES"
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "KES">(() => {
    if (typeof window === "undefined") return "USD"
    return window.localStorage.getItem("protraders-display-currency") === "KES" ? "KES" : "USD"
  })
  const conversion = useGetMarketTicker("frxUSDKES", {
    query: {
      queryKey: getGetMarketTickerQueryKey("frxUSDKES"),
      enabled: canConvert && account?.balance != null && displayCurrency !== currency,
      refetchInterval: 30000,
    },
  })

  const setCurrency = (next: string) => {
    if (next !== "USD" && next !== "KES") return
    setDisplayCurrency(next)
    window.localStorage.setItem("protraders-display-currency", next)
  }

  const conversionRate = Number((conversion.data as any)?.quote ?? (conversion.data as any)?.price)
  const hasRate = Number.isFinite(conversionRate) && conversionRate > 0 && (conversion.data as any)?.available !== false
  const isConverted = canConvert && currency !== displayCurrency && hasRate && account?.balance != null
  const convertedBalance = isConverted
    ? currency === "USD" && displayCurrency === "KES"
      ? Number(account.balance) * conversionRate
      : Number(account.balance) / conversionRate
    : account?.balance
  const balanceCurrency = isConverted ? displayCurrency : currency

  const switchAccount = (target: string) => {
    if (target !== accountType && (target === "demo" || target === "real")) {
      window.location.href = `/api/deriv/login?target=${target}`
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-primary/20 bg-card/70 p-4 shadow-lg md:grid-cols-[1.2fr_1fr_auto] md:items-center" data-testid="account-strip">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Account owner</div>
          <div className="truncate font-semibold">Linus Nyaga Ndambiri</div>
          <div className="truncate font-mono text-xs text-muted-foreground">{account?.loginid || (error ? "Reconnect required" : "Loading account")}</div>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-primary">
            <Wallet className="h-3.5 w-3.5" /> Balance
          </div>
          <Select value={canConvert ? displayCurrency : currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-7 w-[78px] border-primary/20 bg-background/60 px-2 text-[10px]" data-testid="select-display-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canConvert ? (
                <>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="KES">KES (KSh)</SelectItem>
                </>
              ) : <SelectItem value={currency}>{currency}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-1 font-mono text-xl font-bold">
          {isLoading ? "Syncing…" : convertedBalance != null ? formatMoney(convertedBalance, balanceCurrency) : "Unavailable"}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          Account currency: {currency}
          {isConverted ? " · converted at live USD/KES rate" : canConvert && displayCurrency !== currency ? " · conversion unavailable" : " · actual balance"}
        </div>
      </div>

      <div className="min-w-[170px]">
        <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">
          <ArrowLeftRight className="h-3 w-3" /> Account
        </div>
        <Select value={accountType} onValueChange={switchAccount}>
          <SelectTrigger className="h-10 bg-background/70" data-testid="select-account-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="demo">Demo account</SelectItem>
            <SelectItem value="real">Real account</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}