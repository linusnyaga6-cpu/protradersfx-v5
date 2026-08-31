import { Link } from "wouter"
import { ArrowUpRight, HeartPulse, ShieldCheck, BookOpen } from "lucide-react"

export function Footer() {
  return (
    <footer className="mt-auto border-t border-sidebar-border bg-sidebar text-sidebar-foreground/80">
      <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary font-mono text-xs font-bold text-sidebar-primary-foreground">
              PT
            </span>
            <span className="tracking-wide text-sidebar-foreground">ProTraders <span className="text-sidebar-primary">FX</span></span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-sidebar-foreground/60">
            Live market context, controlled execution, and visible risk limits.
          </p>
        </div>
        <div>
          <div className="text-xs font-mono font-semibold uppercase tracking-widest text-sidebar-foreground/45">Explore</div>
          <div className="mt-5 flex flex-col items-start gap-3 text-sm text-sidebar-foreground/60">
            <Link href="/about" className="transition-colors hover:text-sidebar-foreground">About the author</Link>
            <Link href="/course" className="inline-flex items-center gap-1.5 transition-colors hover:text-sidebar-foreground" data-testid="link-footer-course">
              Explore the course <BookOpen className="h-3.5 w-3.5 opacity-70" />
            </Link>
            <a href="/api/deriv/signup" className="inline-flex items-center gap-1.5 transition-colors hover:text-sidebar-foreground" data-testid="link-footer-signup">
              Create free account <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
            </a>
          </div>
        </div>
        <div>
          <div className="text-xs font-mono font-semibold uppercase tracking-widest text-sidebar-foreground/45">Built with intent</div>
          <div className="mt-5 space-y-4 text-sm text-sidebar-foreground/60">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md border border-sidebar-border bg-sidebar-accent p-1">
                <HeartPulse className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
              </div>
              <span className="leading-snug">Careful observation before action.</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md border border-sidebar-border bg-sidebar-accent p-1">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
              </div>
              <span className="leading-snug">Risk boundaries stay visible.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-sidebar-border">
        <div className="container mx-auto px-4 py-6 text-xs font-mono text-sidebar-foreground/40 md:px-8">
          ProTraders FX · By Issay-KE.
        </div>
      </div>
    </footer>
  )
}
