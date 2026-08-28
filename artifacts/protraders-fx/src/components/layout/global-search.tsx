import { useEffect, useState } from "react"
import { BarChart3, Bot, Search, ShieldCheck } from "lucide-react"
import { useLocation } from "wouter"
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

const markets = ["R_100", "R_75", "R_50", "R_25", "1HZ100V", "BOOM_500"]

const pages = [
  { label: "Markets", hint: "Quotes, charts, and instruments", href: "/markets", icon: BarChart3 },
  { label: "Bots", hint: "Templates and visual builder", href: "/bots", icon: Bot },
  { label: "Bulk Trade", hint: "Review a multi-market batch", href: "/bulk-trade", icon: BarChart3 },
  { label: "Readiness", hint: "Connection and system checks", href: "/readiness", icon: ShieldCheck },
]

export function GlobalSearch() {
  const [, navigate] = useLocation()
  const [open, setOpen] = useState(false)

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
        className="h-9 gap-2 border-white/10 bg-white/5 px-3 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Search ProTraders FX"
        data-testid="button-global-search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <CommandShortcut className="hidden border-l border-white/10 pl-2 text-[10px] sm:inline font-mono text-muted-foreground/80">⌘K</CommandShortcut>
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
            {markets.map(symbol => (
              <CommandItem key={symbol} value={symbol} onSelect={() => go("/markets")}>
                <BarChart3 className="text-primary/70 mr-2" />
                <span className="font-mono">{symbol}</span>
                <span className="ml-auto text-xs text-muted-foreground">Open market</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
