import { Activity, BarChart3, LineChart, ScanSearch } from "lucide-react"
import { useLocation } from "wouter"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TradingTab = "markets" | "manual" | "bulk" | "analysis" | "scanner"

export function TradingTabs({ active }: { active: TradingTab }) {
  const [, setLocation] = useLocation()

  const navigate = (value: string) => {
    if (value === "markets") setLocation("/markets")
    if (value === "manual") setLocation("/create-bot")
    if (value === "bulk") setLocation("/bulk-trade")
    if (value === "analysis") setLocation("/analysis")
    if (value === "scanner") setLocation("/ai-scanner")
  }

  return (
    <Tabs value={active} onValueChange={navigate} className="w-full overflow-x-auto">
       <TabsList className="h-10 w-max min-w-full justify-start rounded-md border border-border bg-card p-1 shadow-sm md:min-w-0">
        <TabsTrigger value="markets" className="gap-2 rounded-sm px-3 text-xs" data-testid="tab-markets">
          <BarChart3 className="h-3.5 w-3.5" /> Markets
        </TabsTrigger>
         <TabsTrigger value="manual" className="gap-2 rounded-sm px-3 text-xs" data-testid="tab-manual-trader">
          <Activity className="h-3.5 w-3.5" /> Manual Trader
        </TabsTrigger>
        <TabsTrigger value="bulk" className="gap-2 rounded-sm px-3 text-xs" data-testid="tab-bulk-trader">
          <ScanSearch className="h-3.5 w-3.5" /> Bulk Trader
        </TabsTrigger>
        <TabsTrigger value="analysis" className="gap-2 rounded-sm px-3 text-xs" data-testid="tab-market-analysis">
           <LineChart className="h-3.5 w-3.5" /> Market Analysis
        </TabsTrigger>
        <TabsTrigger value="scanner" className="gap-2 rounded-sm px-3 text-xs" data-testid="tab-ai-scanner">
          <Activity className="h-3.5 w-3.5" /> AI Scanner
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}