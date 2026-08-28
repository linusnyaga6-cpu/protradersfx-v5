import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { Activity, ShieldCheck, Home, LayoutDashboard, LogOut } from "lucide-react"
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
      <div className="container mx-auto flex h-16 items-center px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight mr-8 text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            PT
          </div>
          ProTraders FX
        </Link>
        <div className="hidden md:flex gap-1 flex-1">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon
            const active = location === item.path
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
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
        <div className="flex items-center gap-4 ml-auto">
          {session?.authenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground hidden sm:inline-block">Secure Session</span>
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
    </nav>
  )
}
