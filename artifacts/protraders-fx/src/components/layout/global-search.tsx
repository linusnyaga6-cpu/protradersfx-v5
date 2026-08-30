import { useEffect, useState } from "react"
import { Activity, BarChart3, Bot, CircleAlert, LayoutDashboard, Layers3, Search } from "lucide-react"
import { useLocation } from "wouter"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"

const pages = [
  { label: "Dashboard", hint: "Account overview and results", href: "/dashboard", icon: LayoutDashboard },
  { label: "Manual Trader", hint: "Review and run a manual plan", href: "/create-bot", icon: Activity },
  { label: "Analysis Tools", hint: "Live quotes and movement", href: "/analysis", icon: BarChart3 },
  { label: "Markets", hint: "Quotes, charts, and instruments", href: "/markets", icon: BarChart3 },
  { label: "Bots", hint: "Templates and visual builder", href: "/bots", icon: Bot },
  { label: "Bulk Trader", hint: "Scan markets and run a bounded plan", href: "/bulk-trade", icon: Layers3 },
  { label: "Activity", hint: "Usage and settlement records", href: "/activity", icon: Activity },
  { label: "Recovery", hint: "Monitor-only recovery checks", href: "/recovery", icon: CircleAlert },
]

export function GlobalSearch() {
  const [, navigate] = useLocation()
  const [open, setOpen] = useState(false)
  const marketQuery = useDerivMarkets()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(value => !value)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    navigate(href)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
         className="h-9 gap-2 border-border bg-card px-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Search ProTraders FX"
        data-testid="button-global-search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
         <CommandShortcut className="hidden border-l border-border pl-2 font-mono text-[10px] text-muted-foreground/80 sm:inline">⌘K</CommandShortcut>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search markets, bots, or tools..." />
        <CommandList>
          <CommandEmpty>No matching tools or markets.</CommandEmpty>
          <CommandGroup heading="Workspace">
            {pages.map(({ label, hint, href, icon: Icon }) => (
              <CommandItem key={href} value={label} onSelect={() => go(href)}>
                <Icon className="text-primary/70 mr-2" />
                <span>{label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Markets">
            {marketQuery.markets.map(market => (
              <CommandItem key={market.symbol} value={`${market.displayName} ${market.symbol}`} onSelect={() => go("/markets")}>
                <BarChart3 className="text-primary/70 mr-2" />
                <span>{market.displayName}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{market.symbol}</span>
                <span className="ml-auto text-xs text-muted-foreground">Open market</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
