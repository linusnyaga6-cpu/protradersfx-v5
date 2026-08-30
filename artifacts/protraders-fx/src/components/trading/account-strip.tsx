import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Landmark, Loader2, Wallet } from "lucide-react"
import { getAccount, getGetAccountQueryKey, getGetMarketTickerQueryKey, useGetMarketTicker } from "@workspace/api-client-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"

type AccountStripProps = {
  account?: any
  isLoading?: boolean
  error?: boolean
  switchingDisabled?: boolean
}

export function AccountStrip({ account, isLoading, error, switchingDisabled = false }: AccountStripProps) {
  const queryClient = useQueryClient()
  const [switchingTo, setSwitchingTo] = useState<"demo" | "real" | null>(null)
  const [switchError, setSwitchError] = useState("")
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
  const accountStatusLabel = account?.accountType === "real"
    ? "Real account selected"
    : account?.accountType === "demo"
      ? "Demo account selected"
      : "Choose an account"
  const switchAccount = async (accountType: "demo" | "real") => {
    if (account?.accountType === accountType || switchingTo || switchingDisabled) return
    setSwitchingTo(accountType)
    setSwitchError("")
    try {
      await queryClient.cancelQueries({ queryKey: getGetAccountQueryKey() })
      const nextAccount = await getAccount({ account_type: accountType })
      queryClient.setQueryData(getGetAccountQueryKey(), nextAccount)
    } catch (accountError) {
      const failure = accountError as { data?: { error?: string; message?: string }; message?: string }
      setSwitchError(failure.data?.message || failure.data?.error || failure.message || "Account switch unavailable.")
    } finally {
      setSwitchingTo(null)
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-3 shadow-[0_10px_35px_hsl(215_40%_20%/.06)] md:grid-cols-[1fr_300px]" data-testid="account-strip">
      <div className="rounded-lg border border-border/80 bg-background/70 p-3.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">
          <Landmark className="h-3.5 w-3.5 text-primary" /> Account
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2" role="tablist" aria-label="Deriv account type">
          {(["demo", "real"] as const).map(type => (
            <Button
              key={type}
              type="button"
              size="sm"
               variant={account?.accountType === type ? "default" : "outline"}
               className="h-9 justify-start"
              role="tab"
              aria-selected={account?.accountType === type}
              onClick={() => void switchAccount(type)}
              disabled={isLoading || switchingDisabled || Boolean(switchingTo)}
              data-testid={`tab-account-${type}`}
            >
              {switchingTo === type && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {type === "demo" ? "Demo" : "Real"}
            </Button>
          ))}
        </div>
        {switchingDisabled && <p className="mt-2 text-xs text-amber-700">Active session · switching locked</p>}
        <p className="mt-2 text-[10px] text-muted-foreground">
          {account?.loginid || "Account unavailable"} · {accountStatusLabel}
        </p>
        {(switchError || error) && <p className="mt-2 text-xs text-destructive">{switchError || "Account data unavailable."}</p>}
      </div>
      <div className="w-full rounded-lg border border-primary/20 bg-primary/5 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-primary">
            <Wallet className="h-3.5 w-3.5" /> Available balance
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
        <div className="mt-1 font-mono text-2xl font-bold tracking-tight">
          {isLoading ? "Syncing…" : convertedBalance != null ? formatMoney(convertedBalance, balanceCurrency) : "Unavailable"}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
           Base currency: {currency}
          {isConverted ? ` · 1 USD = ${conversionRate.toFixed(2)} KSh` : canConvert && displayCurrency !== currency ? " · live conversion unavailable" : " · actual balance"}
        </div>
      </div>
    </div>
  )
}

export function AccountBalancePill({ account, isLoading = false }: { account?: any; isLoading?: boolean }) {
  const currency = String(account?.currency || "USD").toUpperCase()
  const balance = account?.balance
  return (
    <div className="min-w-0 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5" data-testid="account-balance-pill">
      <div className="text-[8px] uppercase tracking-wider text-primary">Balance · {account?.accountType === "real" ? "Real" : account?.accountType === "demo" ? "Demo" : "Account"}</div>
      <div className="truncate font-mono text-xs font-bold">
        {isLoading ? "Syncing…" : balance != null ? formatMoney(balance, currency) : "Unavailable"}
      </div>
    </div>
  )
}