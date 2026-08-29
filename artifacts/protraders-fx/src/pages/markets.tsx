import { useEffect, useState } from "react"
import { BarChart3, RefreshCw, Radio, Search, WifiOff } from "lucide-react"
import { useGetMarketCandles, getGetMarketCandlesQueryKey, useGetMarketTicker, getGetMarketTickerQueryKey, useListMarketSymbols, getListMarketSymbolsQueryKey, useGetAccount, getGetAccountQueryKey, useListBots, getListBotsQueryKey, useListBotRuns, getListBotRunsQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AccountStrip } from "@/components/trading/account-strip"
import { BotRunSummary } from "@/components/trading/bot-run-summary"
import { formatVolatility } from "@/lib/format"
import { ALL_MARKET_SYMBOLS } from "@/lib/markets"

const fallback = ALL_MARKET_SYMBOLS
export default function Markets() {
  const [symbol,setSymbol] = useState("R_100")
  const [marketSearch,setMarketSearch] = useState("")
  const symbols = useListMarketSymbols({query:{queryKey:getListMarketSymbolsQueryKey(),staleTime:30000}})
  const ticker = useGetMarketTicker(symbol,{query:{queryKey:getGetMarketTickerQueryKey(symbol),refetchInterval:3000}})
  const candles = useGetMarketCandles(symbol,{count:60,granularity:60},{query:{queryKey:getGetMarketCandlesQueryKey(symbol,{count:60,granularity:60}),staleTime:30000}})
  const account = useGetAccount({query:{queryKey:getGetAccountQueryKey(),refetchInterval:5000}})
  const bots = useListBots({query:{queryKey:getListBotsQueryKey(),refetchInterval:10000}})
  const botList = Array.isArray((bots.data as any)?.bots) ? (bots.data as any).bots : []
  const [selectedBotId,setSelectedBotId] = useState("")
  useEffect(() => {
    if (!selectedBotId && botList[0]?.id) setSelectedBotId(String(botList[0].id))
  }, [selectedBotId, botList])
  const botRuns = useListBotRuns(selectedBotId,{query:{queryKey:getListBotRunsQueryKey(selectedBotId),enabled:Boolean(selectedBotId),refetchInterval:5000}})
  const botRunRows = Array.isArray((botRuns.data as any)?.runs) ? (botRuns.data as any).runs : []
  const providerSymbols = Array.isArray((symbols.data as any)?.symbols) ? (symbols.data as any).symbols : []
  const list = providerSymbols.length ? providerSymbols : fallback
  const visibleSymbols = list.filter((item:any) => {
    const value = typeof item === "string" ? item : item.symbol
    return value?.toLowerCase().includes(marketSearch.toLowerCase())
  })
  const tick = ticker.data as any; const candle = candles.data as any
  const tickerOffline = ticker.isError || tick?.available === false
  return <Workspace title="Markets" eyebrow="TradeView · Market observatory" description="Transparent Deriv data with freshness visible at every layer.">
     <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />
    <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
       <Card><CardHeader><CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Instruments</CardTitle></CardHeader><CardContent className="space-y-2">
         <div className="relative mb-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input aria-label="Search symbols" data-testid="input-symbol-search" className="pl-9" placeholder="Filter symbols" value={marketSearch} onChange={event => setMarketSearch(event.target.value)}/></div>
         {visibleSymbols.length ? visibleSymbols.map((s:any) => { const value=typeof s==="string"?s:s.symbol; return <Button key={value} variant={value===symbol?"secondary":"ghost"} className="w-full justify-between" onClick={()=>setSymbol(value)} data-testid={`button-symbol-${value}`}><span>{value}</span><span className="font-mono text-xs text-muted-foreground">DERIV</span></Button>}) : <div className="px-2 py-5 text-center text-sm text-muted-foreground">No symbols found.</div>}
      </CardContent></Card>
      <div className="space-y-5">
         <Card className="overflow-hidden"><CardHeader className="flex-row items-center justify-between border-b bg-secondary/30"><div><CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5 text-primary"/>{symbol}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Synthetic index · live quote</p></div><Badge variant={tickerOffline?"destructive":"success"}><Radio className="mr-1 h-3 w-3"/>{tickerOffline?"OFFLINE":"LIVE"}</Badge></CardHeader><CardContent className="p-6"><div className="flex items-end gap-5"><div className="font-numeric text-5xl">{tick?.quote ?? tick?.price ?? "—"}</div><div className="pb-2 text-sm text-muted-foreground">{tickerOffline ? "Quote unavailable" : "last price"}</div></div><div className="mt-6 h-56 rounded-lg border bg-[linear-gradient(150deg,hsl(var(--secondary)),transparent)] p-3"><ChartGrid data={candle}/></div><div className="mt-3 grid grid-cols-4 gap-2 text-xs">{["open","high","low","close"].map(k=><div key={k} className="rounded bg-secondary/60 p-2"><div className="uppercase text-muted-foreground">{k}</div><div className="mt-1 font-numeric">{candle?.candles?.at?.(-1)?.[k]??"—"}</div></div>)}</div><div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>Source: Deriv market endpoint · actual price scale</span><span>{candles.isLoading ? "Requesting history…" : candle ? `As of ${candle.asOf??"server timestamp"}` : "History unavailable"}</span></div></CardContent></Card>
         <div className="grid gap-5 md:grid-cols-4"><DataCard label="Bid / ask" value={tick?.bid && tick?.ask ? `${tick.bid} / ${tick.ask}` : "Unavailable"} /><DataCard label="Freshness" value={ticker.isFetching?"Syncing":"Auto-refresh 3s"} /><DataCard label="Volatility" value={candle?.indicators ? formatVolatility(candle.indicators.volatilityLevel, candle.indicators.volatilityPct) : "Not available"} /><DataCard label="Analysis" value={candle?.indicators ? "Deterministic indicators" : "Not available"} /></div>
      </div>
    </div>
     {botList.length ? (
       <Card>
         <CardHeader className="flex flex-col gap-3 border-b bg-secondary/10 sm:flex-row sm:items-center sm:justify-between">
           <div><CardTitle className="text-lg">Bot results in TradeView</CardTitle><p className="mt-1 text-xs text-muted-foreground">Review recorded runs alongside the live market context.</p></div>
           <Select value={selectedBotId} onValueChange={setSelectedBotId}>
             <SelectTrigger className="w-full bg-background sm:w-[240px]" data-testid="select-tradeview-bot"><SelectValue placeholder="Choose a bot" /></SelectTrigger>
             <SelectContent>{botList.map((bot:any) => <SelectItem key={bot.id} value={String(bot.id)}>{bot.name ?? bot.symbol ?? "Unnamed bot"}</SelectItem>)}</SelectContent>
           </Select>
         </CardHeader>
         <CardContent className="pt-5"><BotRunSummary runs={botRunRows} accountCurrency={account.data?.currency ?? undefined} /></CardContent>
       </Card>
     ) : null}
  </Workspace>
}
function ChartGrid({data}:{data:any}) { const points=Array.isArray(data?.candles)?data.candles:[]; const closes=points.map((p:any)=>Number(p.close)).filter(Number.isFinite); const min=Math.min(...closes),max=Math.max(...closes),range=max-min||1; return <div className="relative h-full w-full">{[25,50,75].map(y=><div key={y} className="absolute left-0 right-0 border-t border-dashed border-border/70" style={{top:`${y}%`}}/>)}{points.length>1?<><svg viewBox="0 0 600 200" preserveAspectRatio="none" className="h-full w-full"><polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="2" points={points.map((p:any,i:number)=>`${i/(points.length-1)*600},${185-((Number(p.close)-min)/range)*165}`).join(" ")}/></svg><div className="absolute left-1 top-1 text-[10px] text-muted-foreground">{max.toFixed(4)}</div><div className="absolute bottom-1 left-1 text-[10px] text-muted-foreground">{min.toFixed(4)}</div></>:<div className="grid h-full place-items-center text-sm text-muted-foreground"><WifiOff className="mr-2 inline h-4 w-4"/>No candle history returned</div>}</div> }
function DataCard({label,value}:{label:string,value:string}){return <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-3 font-numeric text-lg">{value}</div></CardContent></Card>}
export function Workspace({title,eyebrow,description,children}:{title:string,eyebrow:string,description:string,children:any}){return <div className="mx-auto max-w-[1400px] space-y-7 p-5 md:p-9"><div><div className="text-xs font-semibold uppercase tracking-[.24em] text-primary">{eyebrow}</div><h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1><p className="mt-2 text-muted-foreground">{description}</p></div>{children}</div>}