import { Activity, CheckCircle2, LayoutDashboard, LineChart, SlidersHorizontal, Sparkles } from "lucide-react"

export function FreeVertexPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-[#9bd7e3] bg-[#f4fbfd] shadow-[0_10px_28px_rgba(15,64,97,.12)] ${compact ? "" : "mt-4"}`}
      data-testid="freevertex-preview"
    >
      <div className="flex items-center justify-between gap-3 bg-[#123b68] px-3 py-2 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded bg-[#19bfd0] text-[9px] font-bold text-[#12304f]">FV</div>
          <div className="min-w-0">
           <div className="truncate text-[10px] font-bold tracking-[.12em]">VERTEX BOT</div>
            <div className="text-[8px] uppercase tracking-[.14em] text-[#b7d9e9]">Signal workspace</div>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[#68d8df]/50 bg-[#0e5a83] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[#bff9f4]">
          Observe only
        </span>
      </div>

      <div className="grid grid-cols-[34px_minmax(0,1fr)]">
         <aside className="flex flex-col items-center gap-3 bg-[#0d3155] py-3 text-[#9fc9dd]" aria-label="Vertex Bot navigation">
          <LayoutDashboard className="h-3.5 w-3.5 text-[#62e0e0]" />
          <LineChart className="h-3.5 w-3.5" />
          <Activity className="h-3.5 w-3.5" />
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </aside>

        <div className={`min-w-0 bg-[#f7fcfe] ${compact ? "p-2.5" : "p-3"}`}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
               <div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#17648d]">Vertex Bot signal board</div>
              <div className="mt-0.5 text-[9px] text-[#58768b]">EMA direction · review before action</div>
            </div>
            <div className="flex items-center gap-1 rounded border border-[#9bd7e3] bg-white px-1.5 py-1 text-[8px] font-semibold text-[#17648d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22b9a1]" />
              DEMO READY
            </div>
          </div>

          <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-[1.2fr_.8fr]"}`}>
            <div className="rounded border border-[#d2e8ee] bg-white p-2">
              <div className="flex items-center justify-between text-[8px] font-semibold uppercase tracking-wider text-[#6a8798]">
                <span>Market direction</span>
                <span className="font-mono text-[#17648d]">R_100 · 1m</span>
              </div>
               <svg viewBox="0 0 180 54" preserveAspectRatio="none" className="mt-2 h-16 w-full" aria-label="Vertex Bot market direction preview">
                <path d="M0 10H180M0 27H180M0 44H180" stroke="#dbeef2" strokeWidth=".6" />
                <path d="M0 43 L13 38 L24 40 L36 27 L47 31 L59 24 L72 29 L85 19 L98 25 L111 15 L124 21 L137 13 L150 17 L163 8 L180 12" fill="none" stroke="#10a8b5" strokeWidth="1.8" />
                <path d="M0 47 L13 44 L24 45 L36 38 L47 40 L59 35 L72 37 L85 32 L98 34 L111 27 L124 30 L137 25 L150 27 L163 21 L180 22" fill="none" stroke="#2b6b99" strokeDasharray="2 2" strokeWidth="1" />
                <circle cx="180" cy="12" r="2.2" fill="#f2a62b" />
              </svg>
              <div className="mt-1 flex items-center justify-between text-[8px] text-[#6a8798]">
                <span>EMA 9 / EMA 21</span>
                <span className="font-semibold text-[#159884]">Bullish bias</span>
              </div>
            </div>

            <div className="space-y-1.5 rounded border border-[#d2e8ee] bg-[#eef9fb] p-2">
              <div className="text-[8px] font-semibold uppercase tracking-[.14em] text-[#6a8798]">Signal checks</div>
              <SignalRow label="EMA 9" value="Rising" tone="positive" />
              <SignalRow label="EMA 21" value="Confirming" tone="positive" />
              <SignalRow label="Entry" value="Review" tone="neutral" />
              <div className="mt-1 flex items-center gap-1 border-t border-[#cbe5eb] pt-1.5 text-[8px] text-[#58768b]">
                <Sparkles className="h-3 w-3 text-[#f2a62b]" />
                No automatic order
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SignalRow({ label, value, tone }: { label: string; value: string; tone: "positive" | "neutral" }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-white px-1.5 py-1 text-[8px]">
      <span className="text-[#58768b]">{label}</span>
      <span className={`flex items-center gap-1 font-semibold ${tone === "positive" ? "text-[#159884]" : "text-[#17648d]"}`}>
        <CheckCircle2 className="h-2.5 w-2.5" />
        {value}
      </span>
    </div>
  )
}