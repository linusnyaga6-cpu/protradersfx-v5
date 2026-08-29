import { useEffect, useMemo } from "react"
import { ArrowDownRight, ArrowUpRight, Clock3, RefreshCw, ReceiptText } from "lucide-react"
import { useListTransactions, getListTransactionsQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"

type TransactionLedgerProps = {
  compact?: boolean
  accountBalance?: number | null
  accountCurrency?: string | null
}

function money(value: unknown, currency = "USD") {
  return formatMoney(value, currency)
}

function statusVariant(status: string) {
  if (status === "won") return "success" as const
  if (status === "lost") return "destructive" as const
  return "outline" as const
}

export function TransactionLedger({ compact = false, accountBalance, accountCurrency }: TransactionLedgerProps) {
  const query = useListTransactions({
    query: {
      queryKey: getListTransactionsQueryKey(),
      refetchInterval: 5000,
    },
  })
  const rows = Array.isArray((query.data as any)?.transactions) ? (query.data as any).transactions : []
  const pendingIds = rows.filter((row: any) => row.status === "pending" && row.id).map((row: any) => row.id).join(",")

  useEffect(() => {
    if (!pendingIds) return
    let active = true
    const refresh = async () => {
      const ids = pendingIds.split(",").slice(0, 8)
      await Promise.all(ids.map((id: string) => fetch(`/api/transactions/${id}/refresh`, { method: "POST" }).catch(() => undefined)))
      if (active) query.refetch()
    }
    refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [pendingIds])

  const summary = useMemo(() => rows.reduce((acc: { net: number; staked: number; runs: number; wins: number; losses: number }, row: any) => {
    const net = Number(row.netProfit)
    const stake = Number(row.stake)
    return {
      net: acc.net + (Number.isFinite(net) ? net : 0),
      staked: acc.staked + (Number.isFinite(stake) ? stake : 0),
      runs: acc.runs + 1,
      wins: acc.wins + (row.status === "won" ? 1 : 0),
      losses: acc.losses + (row.status === "lost" ? 1 : 0),
    }
  }, { net: 0, staked: 0, runs: 0, wins: 0, losses: 0 }), [rows])
  const summaryCurrency = accountCurrency || rows.find((row: any) => row.currency)?.currency || "USD"
  const signedNet = `${summary.net >= 0 ? "+" : "-"}${formatMoney(Math.abs(summary.net), summaryCurrency)}`

  return (
    <Card className={compact ? "shadow-sm" : "shadow-md"} data-testid="card-transaction-ledger">
      <CardHeader className="border-b bg-secondary/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ReceiptText className="h-5 w-5 text-primary" /> Transactions
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Account results and settlement history.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh transactions">
            <RefreshCw className={query.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Summary label="Cumulative P/L" value={signedNet} positive={summary.net >= 0} />
          <Summary label="Runs" value={String(summary.runs)} />
          <Summary label="Wins" value={String(summary.wins)} positive={summary.wins > 0} />
          <Summary label="Losses" value={String(summary.losses)} positive={summary.losses === 0} />
          <Summary label="Balance" value={accountBalance == null ? "—" : formatMoney(accountBalance, summaryCurrency)} />
        </div>
        {query.isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
        ) : query.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Transactions could not be loaded. Reconnect Deriv and retry.
          </div>
        ) : rows.length ? (
          <div className="divide-y rounded-lg border">
            {rows.slice(0, compact ? 5 : 12).map((row: any) => {
              const net = Number(row.netProfit)
              const currency = row.currency || "USD"
              return (
                <div key={row.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${row.contractType === "CALL" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {row.contractType === "CALL" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <span>{row.symbol}</span>
                        <span className="text-xs font-mono text-muted-foreground">{row.contractType}</span>
                        <Badge variant={statusVariant(row.status)} className="text-[10px] uppercase">{row.status}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                        <span>{row.source?.replace("_", " ") || "manual"}</span>
                        <span>Stake {money(row.stake, currency)}</span>
                        {row.contractId && <span className="font-mono">#{row.contractId}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className={`font-mono text-sm font-semibold ${Number.isFinite(net) ? (net >= 0 ? "text-success" : "text-destructive") : "text-muted-foreground"}`}>
                      {Number.isFinite(net) ? `${net >= 0 ? "+" : ""}${money(net, currency)}` : "Awaiting settlement"}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground sm:justify-end">
                      <Clock3 className="h-3 w-3" /> {row.createdAt ? new Date(row.createdAt).toLocaleString() : "Time unavailable"}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-7 text-center text-sm text-muted-foreground">
            No transactions yet. A receipt appears here after a controlled Deriv order is accepted.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Summary({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${positive === undefined ? "" : positive ? "text-success" : "text-destructive"}`}>{value}</div>
    </div>
  )
}