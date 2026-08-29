import { useState } from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { Activity, ShieldCheck, Home, LayoutDashboard, LogOut, BarChart3, Bot, Camera, CircleAlert, UserRound } from "lucide-react"
import { useGetSessionStatus } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { GlobalSearch } from "./global-search"
import { endSession } from "@/lib/logout"

export function Navbar() {
  const [location] = useLocation()
  const { data: session } = useGetSessionStatus()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const navItems = [
    { path: "/", label: "Home", icon: Home, show: true },
    { path: "/dashboard", label: "Workspace", icon: LayoutDashboard, show: session?.authenticated },
    { path: "/readiness", label: "Preflight", icon: ShieldCheck, show: !!session?.authenticated },
    { path: "/activity", label: "Activity", icon: Activity, show: !!session?.authenticated },
    { path: "/about", label: "About", icon: UserRound, show: true },
    { path: "/markets", label: "Markets", icon: BarChart3, show: session?.authenticated },
    { path: "/bots", label: "Bots", icon: Bot, show: session?.authenticated },
    { path: "/snapshots", label: "Snapshots", icon: Camera, show: session?.authenticated },
    { path: "/recovery", label: "Recovery", icon: CircleAlert, show: session?.authenticated },
    { path: "/bulk-trade", label: "Bulk", icon: BarChart3, show: session?.authenticated },
  ]

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await endSession()
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex h-16 items-center">
          <Link href="/" className="mr-4 flex min-w-0 items-center gap-3 text-base font-bold tracking-tight text-foreground sm:mr-8 sm:text-lg">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.2)]">
              <span className="font-mono text-sm">PT</span>
            </div>
            <span className="truncate tracking-wide">ProTraders <span className="text-primary font-medium">FX</span></span>
          </Link>
          <div className="hidden flex-1 gap-1 md:flex">
            {navItems.filter(item => item.show).map((item) => {
              const Icon = item.icon
              const active = location === item.path
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-white/5 text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
                  {item.label}
                </Link>
              )
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            {session?.authenticated && <GlobalSearch />}
            {session?.authenticated ? (
              <div className="flex items-center gap-4">
                <span className="hidden text-xs text-muted-foreground font-mono sm:inline-block border border-white/10 px-2 py-1 rounded-md bg-white/5">Secure Session</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                   disabled={isLoggingOut}
                  className="gap-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
                  data-testid="button-logout"
                >
                   <LogOut className="h-4 w-4" />
                   {isLoggingOut ? "Signing out…" : "Log out"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:bg-white/5 hover:text-foreground" data-testid="link-login">
                  <a href="/api/deriv/login">Log In</a>
                </Button>
                <Button asChild size="sm" className="font-semibold shadow-md bg-primary text-primary-foreground hover:bg-primary/90" data-testid="link-signup">
                  <a href="/api/deriv/signup">Create Account</a>
                </Button>
              </div>
            )}
          </div>
        </div>
        {session?.authenticated && <div className="-mx-4 flex gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 md:hidden">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon
            const active = location === item.path
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/5 text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
                {item.label}
              </Link>
            )
          })}
        </div>}
      </div>
    </nav>
  )
}
