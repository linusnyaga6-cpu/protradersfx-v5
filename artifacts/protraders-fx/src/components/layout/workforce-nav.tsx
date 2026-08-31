import { useState } from "react"
import { Link } from "wouter"
import { Bot, ChevronDown, Cpu, Menu, RefreshCw, Sparkles, X } from "lucide-react"
import { getGetAccountQueryKey, useGetAccount } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"
import { endSession } from "@/lib/logout"

export function WorkforceNav({ authenticated }: { authenticated?: boolean }) {
  const account = useGetAccount(undefined, {
    query: {
      queryKey: getGetAccountQueryKey(),
      enabled: Boolean(authenticated),
      refetchInterval: 5000,
    },
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const balance = account.data?.balance == null
    ? "—"
    : formatMoney(account.data.balance, account.data.currency || "USD")

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await endSession()
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#20384d] bg-[#071321] text-white shadow-[0_8px_30px_rgba(0,0,0,.24)]">
      <div className="flex h-9 items-center justify-between gap-2 bg-[#f8fafb] px-3 text-[#132237] sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-[#516170] hover:bg-[#e7eef2] hover:text-[#132237]"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close workspace menu" : "Open workspace menu"}
            data-testid="button-workforce-menu"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <Link href="/" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#14263a] font-mono text-[9px] font-bold text-white" data-testid="link-workforce-brand">
            PT
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-[#1b9c9c] hover:bg-[#e7f7f4] hover:text-[#147e80]"
            onClick={() => account.refetch()}
            disabled={account.isFetching}
            aria-label="Refresh account balance"
            data-testid="button-workforce-refresh"
          >
            <RefreshCw className={account.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold sm:gap-3">
          <span className="hidden text-[#748391] sm:inline">USD</span>
          <span className="text-sm" aria-hidden="true">🇺🇸</span>
          <span className="font-mono text-[#168e90]">{balance}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[#607180]" />
        </div>
      </div>

      <div className="relative flex h-10 items-center gap-1 overflow-x-auto border-b border-[#1c3448] px-3 sm:px-5">
        <Link href="/bots" className="flex h-full shrink-0 items-center gap-2 border-b-2 border-[#20c7c2] px-3 font-mono text-[10px] font-semibold uppercase tracking-[.08em] text-white" data-testid="tab-workforce-builder">
          <Bot className="h-3.5 w-3.5 text-[#20c7c2]" /> Bot Builder
        </Link>
        <Link href="/bots#free-bots" className="flex h-full shrink-0 items-center gap-2 border-b-2 border-transparent px-3 font-mono text-[10px] font-semibold uppercase tracking-[.08em] text-white/50 transition-colors hover:border-[#20c7c2]/50 hover:text-white" data-testid="tab-workforce-free-bots">
          <Sparkles className="h-3.5 w-3.5 text-[#20c7c2]" /> Free Bots
        </Link>
        <Link href="/bots#premium-ai-bots" className="flex h-full shrink-0 items-center gap-2 border-b-2 border-transparent px-3 font-mono text-[10px] font-semibold uppercase tracking-[.08em] text-white/50 transition-colors hover:border-[#f0c95b]/50 hover:text-white" data-testid="tab-workforce-premium-bots">
          <Cpu className="h-3.5 w-3.5 text-[#f0c95b]" /> Premium AI Bots
        </Link>
      </div>

      {menuOpen && (
        <div className="absolute left-3 top-[85px] z-20 w-56 rounded-xl border border-[#2b455a] bg-[#0b1d2e] p-2 shadow-2xl sm:left-5">
          <div className="px-3 py-2 font-mono text-[9px] uppercase tracking-[.2em] text-white/40">Workspace</div>
          {[
            ["/bots", "Bot Builder"],
            ["/create-bot", "Manual Trader"],
            ["/bulk-trade", "Bulk Trader"],
            ["/markets", "Markets"],
            ["/activity", "Activity"],
          ].map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white">
              {label}
            </Link>
          ))}
          {authenticated && (
            <Button type="button" variant="ghost" onClick={handleLogout} disabled={isLoggingOut} className="mt-1 w-full justify-start px-3 text-sm text-white/50 hover:bg-white/10 hover:text-white">
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </Button>
          )}
        </div>
      )}
    </nav>
  )
}