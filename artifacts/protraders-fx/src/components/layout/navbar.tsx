import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { Activity, ShieldCheck, Home, LayoutDashboard, LogOut, BarChart3, Bot, Camera, CircleAlert } from "lucide-react"
import { useGetSessionStatus, useLogout } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const [location] = useLocation()
  const { data: session } = useGetSessionStatus()
  const logout = useLogout()

  const navItems = [
    { path: "/", label: "Home", icon: Home, show: true },
    { path: "/dashboard", label: "Workspace", icon: LayoutDashboard, show: session?.authenticated },
    { path: "/readiness", label: "Preflight", icon: ShieldCheck, show: true },
    { path: "/activity", label: "Activity", icon: Activity, show: true },
    { path: "/markets", label: "Markets", icon: BarChart3, show: session?.authenticated },
    { path: "/bots", label: "Bots", icon: Bot, show: session?.authenticated },
    { path: "/snapshots", label: "Snapshots", icon: Camera, show: session?.authenticated },
    { path: "/recovery", label: "Recovery", icon: CircleAlert, show: session?.authenticated },
  ]

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/"
      }
    })
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex h-16 items-center">
          <Link href="/" className="mr-4 flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-primary sm:mr-8 sm:text-lg">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              PT
            </div>
            <span className="truncate">ProTraders FX</span>
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
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-4">
            {session?.authenticated ? (
              <div className="flex items-center gap-4">
                <span className="hidden text-xs text-muted-foreground sm:inline-block">Secure Session</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button asChild size="sm" className="font-semibold" data-testid="link-login">
                <a href="/api/deriv/login">Terminal Access</a>
              </Button>
            )}
          </div>
        </div>
        <div className="-mx-4 flex gap-1 overflow-x-auto border-t px-4 py-2 md:hidden">
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
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
