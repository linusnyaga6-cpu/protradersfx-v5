import { useState } from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { Activity, Home, LayoutDashboard, LogOut, BarChart3, Bot, CircleAlert, UserRound, BookOpen, LineChart, Layers3 } from "lucide-react"
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
     { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: session?.authenticated },
     { path: "/create-bot", label: "Manual Trader", icon: Activity, show: session?.authenticated },
    { path: "/bulk-trade", label: "Bulk Trader", icon: Layers3, show: session?.authenticated },
     { path: "/bots", label: "Bots", icon: Bot, show: true },
     { path: "/markets", label: "Markets", icon: BarChart3, show: session?.authenticated },
     { path: "/activity", label: "Activity", icon: Activity, show: !!session?.authenticated },
     { path: "/recovery", label: "Recovery", icon: CircleAlert, show: session?.authenticated },
    { path: "/about", label: "About", icon: UserRound, show: true },
    { path: "/course", label: "Course", icon: BookOpen, show: true },
    { path: "/analysis", label: "Analysis Tools", icon: LineChart, show: true },
  ]

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await endSession()
  }

  return (
    <nav className="sticky top-0 z-50 w-full overflow-x-clip border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_8px_30px_hsl(var(--foreground)/.12)] backdrop-blur-xl">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex h-16 items-center">
          <Link href="/" className="mr-4 flex min-w-0 items-center gap-2.5 text-base font-bold tracking-tight text-sidebar-foreground sm:mr-8 sm:text-lg" data-testid="link-brand">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_0_3px_hsl(var(--sidebar-primary)/.12)]">
              <span className="font-mono text-xs font-bold">PT</span>
            </div>
            <span className="truncate tracking-tight">ProTraders <span className="font-medium text-sidebar-primary">FX</span></span>
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
                      "relative flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all duration-200",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm after:absolute after:inset-x-3 after:-bottom-[17px] after:h-0.5 after:bg-sidebar-primary"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-sidebar-primary" : "")} />
                  {item.label}
                </Link>
              )
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            {session?.authenticated && <GlobalSearch />}
             {session?.authenticated ? (
              <div className="flex items-center gap-4">
                  <span className="hidden rounded-md border border-sidebar-primary/25 bg-sidebar-primary/10 px-2 py-1 font-mono text-[10px] text-sidebar-primary sm:inline-block">SECURE</span>
                 {location !== "/" && <Button
                   variant="ghost"
                   size="sm"
                   onClick={handleLogout}
                   disabled={isLoggingOut}
                     className="gap-2 text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                   data-testid="button-logout"
                 >
                   <LogOut className="h-4 w-4" />
                   {isLoggingOut ? "Signing out…" : "Log out"}
                 </Button>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="ghost" className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-login">
                  <a href="/api/deriv/login">Log In</a>
                </Button>
                  <Button asChild size="sm" className="bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-md hover:bg-sidebar-primary/90" data-testid="link-signup">
                   <a href="/api/deriv/signup">Get Started</a>
                </Button>
              </div>
            )}
          </div>
        </div>
         {<div className="flex w-full max-w-full gap-1 overflow-x-auto border-t border-sidebar-border py-2 md:hidden">
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
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                )}
              >
                 <Icon className={cn("h-4 w-4", active ? "text-sidebar-primary" : "")} />
                {item.label}
              </Link>
            )
          })}
        </div>}
      </div>
    </nav>
  )
}
