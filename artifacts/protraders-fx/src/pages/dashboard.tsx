import { useEffect } from "react"
import { Activity, Bot, Layers3, RefreshCw } from "lucide-react"
import { Link, useLocation } from "wouter"
import {
  getGetAccountQueryKey,
  getGetSessionStatusQueryKey,
  useGetAccount,
  useGetSessionStatus,
} from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountStrip } from "@/components/trading/account-strip"
import { TransactionLedger } from "@/components/trading/transaction-ledger"

export default function Dashboard() {
  const [, setLocation] = useLocation()
  const { data: session, isLoading: sessionLoading } = useGetSessionStatus({
    query: { queryKey: getGetSessionStatusQueryKey() },
  })
  const account = useGetAccount(undefined, {
    query: {
      queryKey: getGetAccountQueryKey(),
      enabled: !!session?.authenticated,
      refetchInterval: 5000,
    },
  })

  useEffect(() => {
    if (!sessionLoading && !session?.authenticated) setLocation("/")
  }, [session, sessionLoading, setLocation])

  if (sessionLoading || (session?.authenticated && account.isLoading)) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!session?.authenticated) return null

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.22em] text-primary">Overview</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Account activity</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={() => account.refetch()} disabled={account.isFetching} aria-label="Refresh account">
          <RefreshCw className={account.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>

      {account.isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span>Account data unavailable.</span>
            <Button size="sm" variant="outline" onClick={() => account.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <ActionCard href="/bulk-trade" icon={<Layers3 className="h-4 w-4" />} title="Bulk Trader" featured />
        <ActionCard href="/create-bot" icon={<Bot className="h-4 w-4" />} title="Create Bot" />
        <ActionCard href="/markets" icon={<Activity className="h-4 w-4" />} title="Scan market" />
        <ActionCard href="/bots" icon={<Bot className="h-4 w-4" />} title="Run bot" />
      </div>

      <TransactionLedger accountBalance={account.data?.balance} accountCurrency={account.data?.currency} />
    </div>
  )
}

function ActionCard({ href, icon, title, featured }: { href: string; icon: React.ReactNode; title: string; featured?: boolean }) {
  return (
    <Link href={href} className={`group flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-primary/60 hover:bg-card ${featured ? "border-primary/45 bg-primary/10 shadow-[0_8px_30px_rgba(190,240,40,.08)]" : "bg-card/60"}`}>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <span className="font-medium">{title}</span>
      <span className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
    </Link>
  )
}