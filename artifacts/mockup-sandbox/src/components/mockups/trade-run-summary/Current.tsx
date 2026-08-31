import "./_group.css";
import { Octagon, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Result = {
  id: string;
  run: number;
  status: string;
  symbol: string;
  contractType: string;
  stake: number;
  buyPrice: number | null;
  entrySpot: number | null;
  exitSpot: number | null;
  payout: number | null;
  outcome: string | null;
  netProfit: number | null;
  message: string;
};

const results: Result[] = [
  {
    id: "1",
    run: 1,
    status: "won",
    symbol: "Volatility 100 (1s)",
    contractType: "CALL",
    stake: 20,
    buyPrice: 200,
    entrySpot: 766119.54,
    exitSpot: 766119.54,
    payout: 372.44,
    outcome: "won",
    netProfit: 172.44,
    message: "Settled by Deriv with net profit +172.44.",
  },
  {
    id: "2",
    run: 2,
    status: "won",
    symbol: "Volatility 100 (1s)",
    contractType: "CALL",
    stake: 20,
    buyPrice: 360,
    entrySpot: 766197.7,
    exitSpot: 766197.7,
    payout: 670.31,
    outcome: "won",
    netProfit: 310.39,
    message: "Settled by Deriv with net profit +310.39.",
  },
  {
    id: "3",
    run: 3,
    status: "lost",
    symbol: "Volatility 100 (1s)",
    contractType: "PUT",
    stake: 20,
    buyPrice: 200,
    entrySpot: 766203.01,
    exitSpot: 766203.01,
    payout: 0,
    outcome: "lost",
    netProfit: -200,
    message: "Settled by Deriv with net profit -200.00.",
  },
  {
    id: "4",
    run: 4,
    status: "pending",
    symbol: "Volatility 100 (1s)",
    contractType: "CALL",
    stake: 20,
    buyPrice: 200,
    entrySpot: 766187.76,
    exitSpot: null,
    payout: null,
    outcome: null,
    netProfit: null,
    message: "Contract 98223314 is open.",
  },
];

function money(value: number | null, currency = "USD") {
  return value == null ? "—" : `${value.toFixed(2)} ${currency}`;
}

function signedMoney(value: number | null, currency = "USD") {
  return value == null ? "Pending" : `${value >= 0 ? "+" : ""}${value.toFixed(2)} ${currency}`;
}

function spot(value: number | null) {
  return value == null ? "—" : value.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}

export function Current() {
  const status: "running" | "stopping" = "running";
  const active = status === "running" || status === "stopping";

  return (
    <main className="trade-run-mockup">
      <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-[0_8px_25px_hsl(174_69%_35%/.06)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Run session</span>
            <Badge variant="outline" className="border-success/40 bg-success/10 text-success uppercase">{status}</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" defaultValue="USD" aria-label="Currency">
              <option>USD</option>
              <option>KES</option>
            </select>
            <Button type="button" variant="destructive" size="sm">
              <Octagon className="mr-2 h-3.5 w-3.5" />Stop Manual Trader
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SessionMetric label="Runs complete" value="2/5" />
          <SessionMetric label="Session P/L" value={signedMoney(172.44)} />
          <SessionMetric label="Position" value={active ? "3/5" : "Closed"} />
        </div>

        <p className="text-xs leading-5 text-muted-foreground" aria-live="polite">
          Run 3 accepted. Waiting for authoritative Deriv settlement…
        </p>

        <div className="space-y-2 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest">
            <span>Results as they arrive</span>
            <span>1 USD = 1 USD</span>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {results.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/80 bg-background/55 p-2.5" aria-live="polite">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">Run {item.run} · {item.status}</span>
                  <span className="font-mono">
                    {item.netProfit == null ? (item.status === "pending" ? "Pending" : "No realized P/L") : signedMoney(item.netProfit)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <ResultMetric label="Type" value={item.contractType} />
                  <ResultMetric label="Entry spot" value={spot(item.entrySpot)} />
                  <ResultMetric label="Exit spot" value={spot(item.exitSpot)} />
                  <ResultMetric label="Buy price" value={money(item.buyPrice)} />
                  <ResultMetric label="P/L" value={item.netProfit == null ? "Pending" : signedMoney(item.netProfit)} tone={item.netProfit == null ? undefined : item.netProfit >= 0 ? "positive" : "negative"} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Market {item.symbol}</span>
                  <span>Stake {money(item.stake)}</span>
                  {item.payout != null && <span>Payout {money(item.payout)}</span>}
                  {item.outcome && <span>Outcome {item.outcome}</span>}
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background/65 p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xs font-semibold">{value}</div>
    </div>
  );
}

function ResultMetric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="rounded-md border border-border/80 bg-secondary/30 p-2">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate font-mono text-[11px] font-semibold ${tone === "positive" ? "text-success" : tone === "negative" ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}