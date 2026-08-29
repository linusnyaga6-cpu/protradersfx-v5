import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react"
import { useLocation } from "wouter"
import { getGetAccountQueryKey, getGetSessionStatusQueryKey, useGetAccount, useGetSessionStatus } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"

export default function Initializing() {
  const [, setLocation] = useLocation()
  const [timedOut, setTimedOut] = useState(false)
  const session = useGetSessionStatus({ query: { queryKey: getGetSessionStatusQueryKey(), retry: 2, refetchInterval: 1500 } })
  const account = useGetAccount(undefined, { query: { queryKey: getGetAccountQueryKey(), enabled: !!session.data?.authenticated, retry: 2, refetchInterval: session.data?.authenticated ? 1800 : false } })

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 16000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (session.data?.authenticated && account.data?.loginid && account.data?.balance != null) {
      const timer = window.setTimeout(() => setLocation("/dashboard"), 700)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [session.data, account.data, setLocation])

  const failed = timedOut || session.isError || account.isError
  return (
    <section className="relative grid min-h-[70vh] place-items-center overflow-hidden px-5 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,hsl(var(--primary)/.12),transparent_55%)]" />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-card/80 p-7 text-center shadow-2xl backdrop-blur-xl md:p-10">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          {failed ? <AlertCircle className="h-7 w-7" /> : account.data?.loginid ? <CheckCircle2 className="h-7 w-7" /> : <Loader2 className="h-7 w-7 animate-spin" />}
        </div>
        <div className="mt-5 text-xs font-semibold uppercase tracking-[.24em] text-primary">Secure initialization</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{failed ? "Account sync needs attention" : account.data?.loginid ? "Workspace ready" : "Connecting your trading workspace"}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          {failed ? "Account data was not verified. Reconnect and try again." : "Checking your account, currency, and balance."}
        </p>
        <div className="mt-7 space-y-3 text-left text-sm">
          <Status label="Encrypted session" ready={!!session.data?.authenticated} />
          <Status label="Active Deriv account" ready={!!account.data?.loginid} />
          <Status label="Currency and balance" ready={account.data?.balance != null} />
        </div>
        {failed && (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1" asChild><a href="/api/deriv/login"><RefreshCw className="mr-2 h-4 w-4" />Reconnect Deriv</a></Button>
            <Button className="flex-1" variant="outline" onClick={() => window.location.reload()}>Retry sync</Button>
          </div>
        )}
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Tokens remain encrypted server-side</div>
      </div>
    </section>
  )
}

function Status({ label, ready }: { label: string; ready: boolean }) {
  return <div className="flex items-center justify-between rounded-lg border border-white/5 bg-background/45 px-4 py-3"><span>{label}</span><span className={ready ? "text-success" : "text-muted-foreground"}>{ready ? "Verified" : "Checking…"}</span></div>
}