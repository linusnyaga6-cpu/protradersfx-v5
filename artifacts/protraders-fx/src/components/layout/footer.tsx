import { Link } from "wouter"
import { ArrowUpRight, HeartPulse, ShieldCheck } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-background text-foreground/80 mt-auto">
      <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary border border-primary/20">
              PT
            </span>
            <span className="tracking-wide text-foreground">ProTraders <span className="text-primary">FX</span></span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            A review-first trading workspace built around transparent market data,
            controlled execution, and responsible decision-making.
          </p>
        </div>
        <div>
          <div className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground/60">Explore</div>
          <div className="mt-5 flex flex-col items-start gap-3 text-sm text-muted-foreground">
            <Link href="/about" className="transition-colors hover:text-foreground">About the author</Link>
            <Link href="/readiness" className="transition-colors hover:text-foreground">System readiness</Link>
            <a href="https://www.traderscheme.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
              Public reference <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
            </a>
          </div>
        </div>
        <div>
          <div className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground/60">Built with intent</div>
          <div className="mt-5 space-y-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1 rounded-md bg-white/5 border border-white/5">
                <HeartPulse className="h-3.5 w-3.5 shrink-0 text-primary" />
              </div>
              <span className="leading-snug">Careful observation before action.</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1 rounded-md bg-white/5 border border-white/5">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              </div>
              <span className="leading-snug">Risk boundaries stay visible.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="container mx-auto px-4 py-6 text-xs text-muted-foreground/60 font-mono md:px-8">
          © 2026 ProTraders FX · Designed and owned by Linus Nyaga Ndambiri.
        </div>
      </div>
    </footer>
  )
}
