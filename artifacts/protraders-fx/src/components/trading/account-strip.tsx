import { useState } from "react"
import { Wallet } from "lucide-react"
import { getGetMarketTickerQueryKey, useGetMarketTicker } from "@workspace/api-client-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatMoney } from "@/lib/format"

type AccountStripProps = {
  account?: any
  isLoading?: boolean
  error?: boolean
}

export function AccountStrip({ account, isLoading, error }: AccountStripProps) {
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

  return (
    <div className="flex justify-end rounded-xl border border-primary/20 bg-card/70 p-4 shadow-lg" data-testid="account-strip">
      <div className="w-full rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 md:w-[280px]">
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

    </div>
  )
}