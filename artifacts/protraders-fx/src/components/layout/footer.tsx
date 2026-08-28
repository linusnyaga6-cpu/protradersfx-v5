import { Link } from "wouter"
import { ArrowUpRight, HeartPulse, ShieldCheck } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-sidebar text-sidebar-foreground">
      <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary font-mono text-xs font-bold text-sidebar-primary-foreground">
              PT
            </span>
            <span>ProTraders <span className="text-sidebar-primary">FX</span></span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-sidebar-foreground/60">
            A review-first trading workspace built around transparent market data,
            controlled execution, and responsible decision-making.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-sidebar-foreground/40">Explore</div>
          <div className="mt-4 flex flex-col items-start gap-3 text-sm text-sidebar-foreground/70">
            <Link href="/about" className="transition-colors hover:text-sidebar-foreground">About the author</Link>
            <Link href="/readiness" className="transition-colors hover:text-sidebar-foreground">System readiness</Link>
            <a href="https://www.traderscheme.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-sidebar-foreground">
              Public reference <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-sidebar-foreground/40">Built with intent</div>
          <div className="mt-4 space-y-3 text-sm text-sidebar-foreground/60">
            <div className="flex items-start gap-2"><HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" /><span>Careful observation before action.</span></div>
            <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" /><span>Risk boundaries stay visible.</span></div>
          </div>
        </div>
      </div>
      <div className="border-t border-sidebar-border">
        <div className="container mx-auto px-4 py-5 text-xs text-sidebar-foreground/55 md:px-8">
          © 2026 ProTraders FX · Designed and owned by Linus Nyaga Ndambiri.
        </div>
      </div>
    </footer>
  )
}