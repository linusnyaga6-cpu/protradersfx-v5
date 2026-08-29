import { useState } from "react"
import { Layers3, Loader2, TrendingDown, TrendingUp } from "lucide-react"
import {
  getGetAccountQueryKey,
  getGetProtradersPreflightQueryKey,
  getGetSessionStatusQueryKey,
  useCreateTrade,
  useGetAccount,
  useGetProtradersPreflight,
  useGetSessionStatus,
} from "@workspace/api-client-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AccountStrip } from "@/components/trading/account-strip"
import { formatMoney } from "@/lib/format"

const instruments = [
  "R_10", "R_25", "R_50", "R_75", "R_100",
  "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V", "1HZ150V", "1HZ250V",
]

export default function BulkTrade() {
  const [selected, setSelected] = useState(["R_100", "R_75"])
  const [stake, setStake] = useState("10")
  const [duration, setDuration] = useState("5")
  const [direction, setDirection] = useState<"CALL" | "PUT">("CALL")
  const [results, setResults] = useState<any[]>([])
  const createTrade = useCreateTrade()
  const { data: session } = useGetSessionStatus({ query: { queryKey: getGetSessionStatusQueryKey() } })
  const preflight = useGetProtradersPreflight({ query: { queryKey: getGetProtradersPreflightQueryKey() } })
  const account = useGetAccount({
    query: {
      queryKey: getGetAccountQueryKey(),
      enabled: !!session?.authenticated,
      refetchInterval: 5000,
    },
  })
  const accountCurrency = account.data?.currency || "USD"
  const canRun = Boolean(session?.authenticated && account.data?.accountType === "demo" && preflight.data?.tradingEnabled && preflight.data?.demoOnly)

  const toggle = (symbol: string) => {
    setSelected(current => current.includes(symbol) ? current.filter(item => item !== symbol) : [...current, symbol])
  }

  const executeBatch = async () => {
    if (!selected.length || !canRun) return
    setResults([])
    const next: any[] = []
    for (const symbol of selected) {
      try {
        const result = await createTrade.mutateAsync({
          data: {
            symbol,
            contract_type: direction,
            stake: Number(stake),
            duration: Number(duration),
            source: "bulk",
            request_label: "Bulk order",
          } as any,
        })
        next.push({ symbol, ok: result.ok, status: result.status, message: result.message })
      } catch (error) {
        next.push({ symbol, ok: false, message: error instanceof Error ? error.message : "Order rejected" })
      }
      setResults([...next])
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-8">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.22em] text-primary">Bulk</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bulk trader</h1>
        </div>
        <Badge variant={account.data?.accountType === "real" ? "destructive" : "outline"}>
          {account.data?.accountType === "real" ? "Real account" : "Demo account"}
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="border-b bg-secondary/10">
            <CardTitle className="flex items-center gap-2 text-lg"><Layers3 className="h-5 w-5 text-primary" />Markets</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-5 sm:grid-cols-3">
            {instruments.map(symbol => (
              <Button
                key={symbol}
                type="button"
                variant={selected.includes(symbol) ? "secondary" : "outline"}
                className="justify-between"
                onClick={() => toggle(symbol)}
                data-testid={`button-bulk-symbol-${symbol}`}
              >
                <span>{symbol}</span>
                {selected.includes(symbol) && <span className="text-primary">✓</span>}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-lg">Order</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="bulk-stake">Stake ({accountCurrency})</Label>
              <Input id="bulk-stake" type="number" min="0.01" step="0.01" value={stake} onChange={event => setStake(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-duration">Duration</Label>
              <Input id="bulk-duration" type="number" min="1" step="1" value={duration} onChange={event => setDuration(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={direction === "CALL" ? "default" : "outline"} onClick={() => setDirection("CALL")}><TrendingUp className="mr-2 h-4 w-4" />CALL</Button>
              <Button type="button" variant={direction === "PUT" ? "destructive" : "outline"} onClick={() => setDirection("PUT")}><TrendingDown className="mr-2 h-4 w-4" />PUT</Button>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Markets</span><span>{selected.length}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Total stake</span><span>{formatMoney(Number(stake || 0) * selected.length, accountCurrency)}</span></div>
            </div>
            <Button className="w-full" onClick={executeBatch} disabled={!selected.length || !canRun || createTrade.isPending} data-testid="button-execute-bulk">
              {createTrade.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {account.data?.accountType === "real" ? "Demo account required" : "Run selected"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card data-testid="card-bulk-results">
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-base">Results</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {results.map((result: any) => (
              <div key={result.symbol} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="font-mono">{result.symbol}</span>
                <span className={result.ok ? "text-success" : "text-destructive"}>{result.ok ? result.status || "accepted" : result.message || "rejected"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}