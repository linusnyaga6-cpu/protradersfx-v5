import "./_group.css";
import { ArrowDownRight, ArrowUpRight, Octagon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const rows = [
  { run: 1, status: "won", type: "CALL", symbol: "Volatility 100 (1s)", entry: "766119.54", exit: "766119.54", buy: "200.00 USD", pnl: "+172.44 USD" },
  { run: 2, status: "won", type: "CALL", symbol: "Volatility 100 (1s)", entry: "766197.70", exit: "766197.70", buy: "360.00 USD", pnl: "+310.39 USD" },
  { run: 3, status: "lost", type: "PUT", symbol: "Volatility 100 (1s)", entry: "766203.01", exit: "766203.01", buy: "200.00 USD", pnl: "-200.00 USD" },
  { run: 4, status: "pending", type: "CALL", symbol: "Volatility 100 (1s)", entry: "766187.76", exit: "—", buy: "200.00 USD", pnl: "Pending" },
];

export function Compact() {
  return (
    <main className="trade-run-mockup">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Session</span>
            <Badge variant="outline" className="border-success/40 bg-success/10 text-success uppercase">running</Badge>
            <span className="text-[10px] text-muted-foreground">2/5 runs</span>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" defaultValue="USD" aria-label="Currency">
              <option>USD</option>
              <option>KES</option>
            </select>
            <Button type="button" variant="destructive" size="sm">
              <Octagon className="mr-2 h-3.5 w-3.5" />Stop
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-3 border-b border-border bg-secondary/25">
          <Summary label="P/L" value="+172.44 USD" tone="positive" />
          <Summary label="Run" value="3/5" />
          <Summary label="Status" value="Live" tone="positive" />
        </div>

        <div>
          <div className="grid grid-cols-[minmax(68px,.68fr)_minmax(96px,1fr)_minmax(82px,.8fr)] gap-1.5 border-b border-border px-2 py-2 text-[8px] font-semibold uppercase tracking-[.12em] text-muted-foreground sm:grid-cols-[minmax(120px,.8fr)_minmax(170px,1fr)_minmax(125px,.8fr)] sm:gap-3 sm:px-3 sm:text-[9px] sm:tracking-[.14em]">
            <span>Type</span>
            <span>Entry / Exit spot</span>
            <span className="text-right">Buy / P/L</span>
          </div>
          {rows.map((row) => (
              <div key={row.run} className="grid grid-cols-[minmax(68px,.68fr)_minmax(96px,1fr)_minmax(82px,.8fr)] items-center gap-1.5 border-b border-border/70 px-2 py-2 last:border-b-0 sm:grid-cols-[minmax(120px,.8fr)_minmax(170px,1fr)_minmax(125px,.8fr)] sm:gap-3 sm:px-3 sm:py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${row.type === "PUT" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {row.type === "PUT" ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-semibold">{row.type}</span>
                      <span className={`h-1.5 w-1.5 rounded-full ${row.status === "won" ? "bg-success" : row.status === "lost" ? "bg-destructive" : "animate-pulse bg-amber-500"}`} />
                    </div>
                    <div className="truncate text-[9px] text-muted-foreground">#{String(row.run).padStart(2, "0")} · {row.symbol}</div>
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <Spot label="Entry" value={row.entry} />
                  <span className="text-muted-foreground/60">→</span>
                  <Spot label="Exit" value={row.exit} />
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] font-semibold">{row.buy}</div>
                  <div className={`font-mono text-[10px] font-semibold ${row.status === "won" ? "text-success" : row.status === "lost" ? "text-destructive" : "text-muted-foreground"}`}>{row.pnl}</div>
                </div>
              </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "positive" }) {
  return (
    <div className="border-r border-border px-3 py-2.5 last:border-r-0">
      <div className="text-[9px] uppercase tracking-[.14em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-xs font-semibold ${tone === "positive" ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}

function Spot({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-[10px] font-semibold">{value}</div>
    </div>
  );
}