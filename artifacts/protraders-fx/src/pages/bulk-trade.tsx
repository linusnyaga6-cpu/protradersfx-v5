import { useState } from "react"
import { ArrowRight, Check, Layers3, ShieldCheck } from "lucide-react"
import { Link } from "wouter"
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

  const toggle = (symbol: string) => {
    setPreviewed(false)
    setSelected(current => current.includes(symbol) ? current.filter(item => item !== symbol) : [...current, symbol])
  }

  return (
    <Workspace title="Bulk Trade" eyebrow="Review queue" description="Prepare a multi-market batch. No orders are sent from this screen.">
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
          <p className="text-xs text-muted-foreground">This preview does not call the trade endpoint.</p>
          <Button variant="outline" asChild><Link href="/dashboard">Review manual trade <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      </Card>
    </Workspace>
  )
}

function Summary({ label, value }: { label: string, value: string }) {
  return <div className="rounded-lg border bg-secondary/30 p-4"><div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-2 font-numeric text-xl">{value}</div></div>
}