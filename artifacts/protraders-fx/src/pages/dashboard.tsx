import { useEffect } from "react"
import { Activity, ArrowRight, Bot, CircleAlert, Layers3, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react"
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
import { formatMoney } from "@/lib/format"

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

  const accountTypeLabel = account.data?.accountType === "real" ? "REAL" : account.data?.accountType === "demo" ? "DEMO" : "SELECT"
  const balance = account.data?.balance == null
    ? "Syncing…"
    : formatMoney(account.data.balance, account.data.currency || "USD")

  return (
    <div className="min-h-full bg-[#fcfaf8]">
      <section className="relative overflow-hidden bg-[#091a2d] px-4 py-12 text-white md:px-8 md:py-16">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#e96751]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-[#194d70]/35 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#ffb2a1]">Dashboard / command center</div>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => account.refetch()} disabled={account.isFetching} aria-label="Refresh account" data-testid="button-refresh-account">
              <RefreshCw className={account.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
          <div className="mt-10 grid items-end gap-10 lg:grid-cols-[1fr_340px] lg:gap-16">
            <div>
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[.98] tracking-[-.04em] md:text-7xl">
                Turn market context <br /><span className="text-[#e96751]">into a clear next move.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/65 md:text-lg">
                Everything you need to scan, review, execute, and learn—organized around your selected Deriv account.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild className="h-11 rounded-full bg-[#e96751] px-5 text-white shadow-[0_12px_24px_rgba(233,103,81,.18)] hover:bg-[#d95743]" data-testid="button-dashboard-manual-trader">
                  <Link href="/create-bot">Open Manual Trader <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-full border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/markets">View Markets</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[.07] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.2em] text-white/55">
                <span>Available balance</span>
                <span className="rounded-full border border-[#6ee2cb]/30 bg-[#6ee2cb]/10 px-2 py-1 text-[#6ee2cb]">{accountTypeLabel}</span>
              </div>
              <div className="mt-3 font-mono text-3xl font-bold tracking-tight text-white">{balance}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-[#6ee2cb]" /> Account context is synced live</div>
            </div>
          </div>
          <div className="mt-12 grid gap-2 border-t border-white/10 pt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-white/50 sm:grid-cols-3">
            <div>01 · Scan fresh markets</div>
            <div>02 · Review the contract</div>
            <div>03 · See settlement clearly</div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-8 md:px-8 md:py-12">
        <section>
          <div className="mb-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#c84c3d]">Account & balance</div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#14243a]">Your workspace is ready.</h2>
          </div>
          <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />
        </section>

        {account.isError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span>Account data unavailable.</span>
              <Button size="sm" variant="outline" onClick={() => account.refetch()}>Retry</Button>
            </CardContent>
          </Card>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#c84c3d]">Choose a trading type</div>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#14243a]">Start with the tool that fits the moment.</h2>
            </div>
            <span className="hidden text-xs text-[#748092] sm:block">You stay in control of every order.</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <ActionCard href="/create-bot" icon={<Activity className="h-4 w-4" />} title="Manual Trader" description="Review one setup and place a deliberate order." featured />
            <ActionCard href="/bulk-trade" icon={<Layers3 className="h-4 w-4" />} title="Bulk Trader" description="Scan markets and run a bounded sequence." />
            <ScannerCard />
            <ActionCard href="/markets" icon={<TrendingUp className="h-4 w-4" />} title="Markets" description="Compare live quotes, candles, and context." />
          </div>
        </section>

        <section>
          <div className="mb-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#c84c3d]">Monitor & learn</div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#14243a]">Keep the full picture visible.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ActionCard href="/bots" icon={<Bot className="h-4 w-4" />} title="Trading Bots" description="Use transparent templates with review-first controls." />
            <ActionCard href="/activity" icon={<Activity className="h-4 w-4" />} title="Activity" description="Review account events and completed sessions." />
            <ActionCard href="/recovery" icon={<CircleAlert className="h-4 w-4" />} title="Recovery" description="Monitor recovery context without automatic trades." />
          </div>
        </section>

        <section>
          <div className="mb-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.22em] text-[#c84c3d]">Recent execution</div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#14243a]">Settlement stays visible.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <TransactionLedger accountBalance={account.data?.balance} accountCurrency={account.data?.currency} />
            <Card className="h-fit border-[#e96751]/25 bg-[#fff4f0]">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[#c84c3d]">
                  <ShieldCheck className="h-4 w-4" /> Execution guard
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#14243a]">Review before entry</div>
                  <p className="mt-1 text-xs leading-5 text-[#748092]">Every order stays bounded to the selected account and plan.</p>
                </div>
                <Link href="/analysis" className="inline-flex text-xs font-semibold text-[#c84c3d] hover:underline" data-testid="link-dashboard-analysis">Open market analysis <span className="ml-1">→</span></Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}

function ActionCard({ href, icon, title, description, featured }: { href: string; icon: React.ReactNode; title: string; description: string; featured?: boolean }) {
  return (
    <Link href={href} className={`group flex min-h-[150px] flex-col rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(20,36,58,.1)] ${featured ? "border-[#e96751]/45 bg-[#fff0ec]" : "border-[#dce3e7] bg-white"}`} data-testid={`link-dashboard-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${featured ? "bg-[#e96751] text-white" : "bg-[#eaf8f6] text-[#159884]"}`}>{icon}</span>
      <span className="mt-5 flex items-center justify-between gap-2 font-semibold text-[#14243a]">{title}<ArrowRight className="h-4 w-4 text-[#9aa5b0] transition-transform group-hover:translate-x-1" /></span>
      <span className="mt-2 text-xs leading-5 text-[#748092]">{description}</span>
    </Link>
  )
}

function ScannerCard() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("protraders:open-scanner"))}
      className="group flex min-h-[150px] flex-col rounded-2xl border border-[#dce3e7] bg-white p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:border-[#159884]/40 hover:shadow-[0_14px_30px_rgba(20,36,58,.1)]"
      data-testid="button-dashboard-ai-scanner"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf8f6] text-[#159884]"><Activity className="h-4 w-4" /></span>
      <span className="mt-5 flex items-center justify-between gap-2 font-semibold text-[#14243a]">AI Scanner <ArrowRight className="h-4 w-4 text-[#9aa5b0] transition-transform group-hover:translate-x-1" /></span>
      <span className="mt-2 text-xs leading-5 text-[#748092]">Get advisory market context—never automatic execution.</span>
    </button>
  )
}