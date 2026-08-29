import { ArrowRight, Check, Layers3, ShieldCheck, TrendingDown, TrendingUp, Loader2 } from "lucide-react"
import { Link } from "wouter"
import { useState } from "react"
import { useCreateTrade, useGetProtradersPreflight, getGetProtradersPreflightQueryKey, useGetSessionStatus, getGetSessionStatusQueryKey } from "@workspace/api-client-react"
import { Workspace } from "./markets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const instruments = ["R_100", "R_75", "R_50", "R_25", "1HZ100V", "BOOM_500"]

export default function BulkTrade() {
  const [selected, setSelected] = useState(["R_100", "R_75"])
  const [stake, setStake] = useState("10")
  const [duration, setDuration] = useState("5")
  const [previewed, setPreviewed] = useState(false)
  const [direction, setDirection] = useState<"CALL" | "PUT">("CALL")
  const [results, setResults] = useState<any[]>([])
  const createTrade = useCreateTrade()
  const { data: preflight } = useGetProtradersPreflight({ query: { queryKey: getGetProtradersPreflightQueryKey() } })
  const { data: session } = useGetSessionStatus({ query: { queryKey: getGetSessionStatusQueryKey() } })

  const toggle = (symbol: string) => {
    setPreviewed(false)
    setSelected(current => current.includes(symbol) ? current.filter(item => item !== symbol) : [...current, symbol])
  }

  const executeReviewedBatch = async () => {
    if (!selected.length || !previewed || !session?.authenticated || !preflight?.tradingEnabled || !preflight.demoOnly) return
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
            request_label: `Reviewed bulk ${direction} batch`,
          } as any,
        })
        next.push({ symbol, ok: result.ok, transactionId: result.transactionId, status: result.status, message: result.message })
      } catch (error) {
        next.push({ symbol, ok: false, message: error instanceof Error ? error.message : "Order rejected" })
      }
      setResults([...next])
    }
  }

  return (
      <Workspace title="Bulk Trade" eyebrow="Review queue" description="Prepare a multi-market batch, review it, then send each demo order through the same controlled execution path.">
      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertTitle>Review-only planner</AlertTitle>
        <AlertDescription>Build the batch here, then review each order in the controlled manual workspace.</AlertDescription>
      </Alert>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
         <Card>
          <CardHeader className="border-b bg-secondary/10">
            <CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-primary" />Select markets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {instruments.map(symbol => {
                const active = selected.includes(symbol)
                return (
                  <Button
                    key={symbol}
                    type="button"
                    variant={active ? "secondary" : "outline"}
                    className="h-14 justify-between"
                    onClick={() => toggle(symbol)}
                    data-testid={`button-bulk-symbol-${symbol}`}
                  >
                    <span className="font-mono">{symbol}</span>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </Button>
                )
              })}
            </div>
            {!selected.length && <p className="text-sm text-destructive">Select at least one market.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-base">Batch settings</CardTitle></CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-2">
              <Label htmlFor="bulk-stake">Stake per market</Label>
              <Input id="bulk-stake" type="number" min="0.01" step="0.01" value={stake} onChange={event => { setStake(event.target.value); setPreviewed(false) }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-duration">Duration in ticks</Label>
              <Input id="bulk-duration" type="number" min="1" step="1" value={duration} onChange={event => { setDuration(event.target.value); setPreviewed(false) }} />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={direction === "CALL" ? "default" : "outline"} onClick={() => { setDirection("CALL"); setPreviewed(false) }}><TrendingUp className="mr-2 h-4 w-4" />CALL</Button>
                <Button type="button" variant={direction === "PUT" ? "destructive" : "outline"} onClick={() => { setDirection("PUT"); setPreviewed(false) }}><TrendingDown className="mr-2 h-4 w-4" />PUT</Button>
              </div>
            </div>
            <Button className="w-full" disabled={!selected.length} onClick={() => setPreviewed(true)} data-testid="button-preview-bulk">
              Preview batch <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="flex-row items-center justify-between border-b bg-secondary/10">
          <CardTitle className="text-base">Batch preview</CardTitle>
          <Badge variant={previewed ? "success" : "outline"}>{previewed ? "READY FOR REVIEW" : "DRAFT"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <Summary label="Markets" value={String(selected.length)} />
          <Summary label="Total planned stake" value={`$${(Number(stake || 0) * selected.length).toFixed(2)}`} />
          <Summary label="Duration" value={`${duration || 0} ticks`} />
        </CardContent>
        <div className="flex flex-col gap-3 border-t bg-secondary/10 p-5 sm:flex-row sm:items-center sm:justify-between">
           <p className="text-xs text-muted-foreground">Every order is reviewed, demo-only by default, and recorded in the transaction ledger.</p>
           <div className="flex flex-wrap gap-2">
             <Button variant="outline" asChild><Link href="/dashboard">Open manual terminal <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
             <Button onClick={executeReviewedBatch} disabled={!previewed || !session?.authenticated || !preflight?.tradingEnabled || !preflight.demoOnly || createTrade.isPending} data-testid="button-execute-bulk">
               {createTrade.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
               Execute demo batch
             </Button>
           </div>
        </div>
      </Card>
      {results.length > 0 && (
        <Card data-testid="card-bulk-results">
          <CardHeader className="border-b bg-secondary/10"><CardTitle className="text-base">Batch receipts</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {results.map((result: any) => <div key={result.symbol} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="font-mono text-sm">{result.symbol} <span className="text-muted-foreground">{result.message}</span></div><Badge variant={result.ok ? "outline" : "destructive"}>{result.ok ? `${result.status} · ${result.transactionId}` : "rejected"}</Badge></div>)}
          </CardContent>
        </Card>
      )}
    </Workspace>
  )
}

function Summary({ label, value }: { label: string, value: string }) {
  return <div className="rounded-lg border bg-secondary/30 p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-2 font-numeric text-xl">{value}</div></div>
}