import { ReactNode } from "react"
import { Link, useLocation } from "wouter"
import { Activity, BarChart3, Bot, Camera, ChevronRight, CircleAlert, LayoutDashboard, LogOut, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLogout } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"

const links = [
  ["/dashboard","Overview",LayoutDashboard],["/markets","Markets",BarChart3],["/bots","Bots",Bot],
  ["/snapshots","Snapshots",Camera],["/recovery","Recovery",CircleAlert],["/readiness","Readiness",Settings2],["/activity","Activity",Activity],
] as const
export function Shell({ children }: { children: ReactNode }) {
  const [path] = useLocation()
  const logout = useLogout()
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => { window.location.href = "/" } })
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <Link href="/" className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6" data-testid="link-brand">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">PT</span>
        <span className="font-semibold tracking-tight">ProTraders <span className="text-sidebar-primary">FX</span></span>
      </Link>
      <div className="px-5 pt-8 text-[10px] font-semibold uppercase tracking-[.24em] text-sidebar-foreground/45">Workspace</div>
      <nav className="space-y-1 px-3 pt-3">{links.map(([href,label,Icon]) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors", path===href ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground")}><Icon className="h-4 w-4" />{label}{path===href && <ChevronRight className="ml-auto h-3.5 w-3.5 text-sidebar-primary" />}</Link>)}</nav>
       <div className="mt-auto border-t border-sidebar-border p-5">
         <div className="text-[10px] uppercase tracking-[.2em] text-sidebar-foreground/40">Execution mode</div>
         <div className="mt-2 flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-sidebar-primary" /> Controlled / review-first</div>
         <Button variant="ghost" size="sm" className="mt-4 w-full justify-start gap-2 px-2 text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={handleLogout} disabled={logout.isPending} data-testid="button-sidebar-logout">
           <LogOut className="h-4 w-4" /> {logout.isPending ? "Signing out…" : "Log out"}
         </Button>
       </div>
    </aside>
    <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/90 px-4 backdrop-blur md:ml-64 md:hidden"><Link href="/" className="font-semibold">ProTraders <span className="text-primary">FX</span></Link></header>
    <main className="md:ml-64">{children}</main>
  </div>
}