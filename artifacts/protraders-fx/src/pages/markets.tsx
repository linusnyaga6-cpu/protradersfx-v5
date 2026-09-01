import { useEffect, useState } from "react"
import { Link } from "wouter"
import { BarChart3, Check, Radio, Search, WifiOff } from "lucide-react"
import { useGetMarketCandles, getGetMarketCandlesQueryKey, useGetMarketTicker, getGetMarketTickerQueryKey, useGetMarketContracts, getGetMarketContractsQueryKey, useGetAccount, getGetAccountQueryKey, useListBots, getListBotsQueryKey, useListBotRuns, getListBotRunsQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AccountStrip } from "@/components/trading/account-strip"
import { BotRunSummary } from "@/components/trading/bot-run-summary"
import { formatVolatility } from "@/lib/format"
import { CONTRACT_FAMILIES, CONTRACT_LABELS, DEFAULT_MARKET_SYMBOL } from "@/lib/markets"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"
import { TradingJourney } from "@/components/trading/trading-journey"
import { TradingTabs } from "@/components/trading/trading-tabs"

export default function Markets() {
  const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search)
  const [symbol,setSymbol] = useState(requested?.get("symbol") || DEFAULT_MARKET_SYMBOL)
  const [selectedContract, setSelectedContract] = useState(requested?.get("contract") || "CALL")
  const [marketSearch,setMarketSearch] = useState("")
  const marketQuery = useDerivMarkets()
  const ticker = useGetMarketTicker(symbol,{query:{queryKey:getGetMarketTickerQueryKey(symbol),refetchInterval:15000}})
  const candles = useGetMarketCandles(symbol,{count:60,granularity:60},{query:{queryKey:getGetMarketCandlesQueryKey(symbol,{count:60,granularity:60}),staleTime:30000}})
  const contracts = useGetMarketContracts(symbol, { query: { queryKey: getGetMarketContractsQueryKey(symbol), staleTime: 60000 } })
  const account = useGetAccount(undefined, {query:{queryKey:getGetAccountQueryKey(),refetchInterval:5000}})
  const bots = useListBots({query:{queryKey:getListBotsQueryKey(),refetchInterval:10000}})
  const botList = Array.isArray((bots.data as any)?.bots) ? (bots.data as any).bots : []
  const [selectedBotId,setSelectedBotId] = useState("")
  
  useEffect(() => {
    if (!selectedBotId && botList[0]?.id) setSelectedBotId(String(botList[0].id))
  }, [selectedBotId, botList])
  
  const botRuns = useListBotRuns(selectedBotId,{query:{queryKey:getListBotRunsQueryKey(selectedBotId),enabled:Boolean(selectedBotId),refetchInterval:5000}})
  const botRunRows = Array.isArray((botRuns.data as any)?.runs) ? (botRuns.data as any).runs : []
  const list = marketQuery.markets
  
  const visibleSymbols = list.filter((item:any) => {
    const value = typeof item === "string" ? item : item.symbol
    return value?.toLowerCase().includes(marketSearch.toLowerCase())
  })
  
  const tick = ticker.data as any; const candle = candles.data as any
  const tickerOffline = ticker.isError || tick?.available === false
  const availableContractTypes = Array.isArray((contracts.data as any)?.availableContractTypes)
    ? (contracts.data as any).availableContractTypes.filter((type: string) => CONTRACT_LABELS[type])
    : []
  useEffect(() => {
    if (availableContractTypes.length && !availableContractTypes.includes(selectedContract)) {
      setSelectedContract(availableContractTypes.includes("CALL") ? "CALL" : availableContractTypes[0])
    }
  }, [availableContractTypes.join("|"), selectedContract])
  
  return (
    <Workspace title="Markets" eyebrow="TradeView · Market observatory" description="Transparent Deriv data with freshness visible at every layer.">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />
      <TradingTabs active="markets" />
      <TradingJourney current="markets" symbol={symbol} contractType={availableContractTypes.includes(selectedContract) ? selectedContract : undefined} />
      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        <Card className="rounded-sm border-border bg-card/50">
          <CardHeader className="rounded-t-sm border-b border-border/50 bg-secondary/20 pb-4">
            <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Instruments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/>
              <Input aria-label="Search symbols" data-testid="input-symbol-search" className="pl-9 rounded-sm font-mono text-xs" placeholder="Filter symbols" value={marketSearch} onChange={event => setMarketSearch(event.target.value)}/>
            </div>
            {marketQuery.isLoading ? (
              <div className="px-2 py-5 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Loading from Deriv…</div>
            ) : visibleSymbols.length ? visibleSymbols.map((s:any) => { 
              const value=s.symbol; 
              return (
                <Button key={value} variant={value===symbol?"secondary":"ghost"} className={`w-full justify-between rounded-sm ${value===symbol ? "border border-border/50 bg-secondary/30" : ""}`} onClick={()=>setSymbol(value)} data-testid={`button-symbol-${value}`}>
                  <span className="text-left">
                    <span className="block font-display text-sm">{s.displayName}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{value}</span>
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">DERIV</span>
                </Button>
              )
            }) : <div className="px-2 py-5 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{marketQuery.isError ? "Market list unavailable" : "No symbols found"}</div>}
          </CardContent>
        </Card>
        
        <div className="space-y-5">
          <Card className="overflow-hidden rounded-sm border-border bg-card/50">
            <CardHeader className="flex-row items-center justify-between border-b border-border/50 bg-secondary/20">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-xl"><BarChart3 className="h-5 w-5 text-primary"/>{symbol}</CardTitle>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Synthetic index · live quote</p>
              </div>
              <Badge variant={tickerOffline?"destructive":"success"} className="rounded-sm font-mono text-[9px] uppercase tracking-widest">
                <Radio className="mr-1 h-3 w-3"/>{tickerOffline?"OFFLINE":"LIVE"}
              </Badge>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-end gap-5">
                <div className="font-mono text-5xl tabular-nums tracking-tight">{tick?.quote ?? tick?.price ?? "—"}</div>
                <div className="pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{tickerOffline ? "Quote unavailable" : "last price"}</div>
              </div>
              <div className="mt-6 h-56 rounded-sm border border-border bg-[linear-gradient(150deg,rgba(var(--secondary),0.3),transparent)] p-3">
                <ChartGrid data={candle}/>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-xs">
                {["open","high","low","close"].map(k=> (
                  <div key={k} className="rounded-sm border border-border/50 bg-secondary/10 p-2">
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
                    <div className="mt-1 tabular-nums">{candle?.candles?.at?.(-1)?.[k]??"—"}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Deriv Market Endpoint</span>
                <span>{candles.isLoading ? "Requesting history…" : candle ? `As of ${candle.asOf??"server time"}` : "History unavailable"}</span>
                 <Button asChild size="sm" variant="outline" className="rounded-sm font-sans text-xs normal-case tracking-normal">
                   <Link href={`/create-bot?symbol=${encodeURIComponent(symbol)}${availableContractTypes.includes(selectedContract) ? `&contract=${encodeURIComponent(selectedContract)}` : ""}`}>Review in Manual Trader</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-5 md:grid-cols-4">
            <DataCard label="Bid / ask" value={tick?.bid && tick?.ask ? `${tick.bid} / ${tick.ask}` : "Unavailable"} />
            <DataCard label="Freshness" value={ticker.isFetching?"Syncing":"Auto-refresh 3s"} />
            <DataCard label="Volatility" value={candle?.indicators ? formatVolatility(candle.indicators.volatilityLevel, candle.indicators.volatilityPct) : "Not available"} />
            <DataCard label="Analysis" value={candle?.indicators ? "Deterministic indicators" : "Not available"} />
          </div>
          <Card className="rounded-sm border-border bg-card/50" data-testid="card-market-contracts">
            <CardHeader className="border-b border-border/50 bg-secondary/10">
              <CardTitle className="font-display text-lg">Market contracts</CardTitle>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Verified by Deriv for {symbol}</p>
            </CardHeader>
            <CardContent className="p-5">
              {contracts.isLoading ? (
                <div className="font-mono text-xs text-muted-foreground">Checking contract types…</div>
              ) : contracts.isError ? (
                <div className="font-mono text-xs text-amber-600">Contract availability is temporarily unavailable.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {CONTRACT_FAMILIES.map(group => (
                    <div key={group.label} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{group.label}</span>
                        <span className="text-[9px] text-muted-foreground">{group.shortLabel}</span>
                      </div>
                      <div className="space-y-2">
                        {group.types.map(type => {
                          const available = availableContractTypes.includes(type)
                          return (
                            <Button key={type} type="button" variant="outline" disabled={!available} onClick={() => setSelectedContract(type)} aria-pressed={selectedContract === type} className={`flex h-auto w-full items-center justify-between rounded-sm px-3 py-2 text-xs ${selectedContract === type ? "border-primary bg-primary/10 text-foreground" : available ? "border-success/25 bg-success/5" : "border-border/60 bg-secondary/10 opacity-60"}`} data-testid={`market-contract-${type.toLowerCase()}`}>
                              <span className="flex items-center gap-2 font-medium"><span className={`grid h-4 w-4 place-items-center rounded-sm border ${selectedContract === type ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selectedContract === type && <Check className="h-3 w-3" />}</span>{CONTRACT_LABELS[type].action}</span>
                              <span className={`font-mono text-[9px] uppercase tracking-wider ${available ? "text-success" : "text-muted-foreground"}`}>{available ? "Choose" : "Unavailable"}</span>
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
               <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Choose a supported contract here to carry this market context into Manual Trader. Over and Under use the selected digit barrier there.</p>
            </CardContent>
          </Card>
        </div>
      </div>
      {botList.length ? (
        <Card className="rounded-sm border-border bg-card/50">
          <CardHeader className="flex flex-col gap-3 border-b border-border/50 bg-secondary/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display text-lg">Bot results in TradeView</CardTitle>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Review recorded runs alongside live market context.</p>
            </div>
            <Select value={selectedBotId} onValueChange={setSelectedBotId}>
              <SelectTrigger className="w-full rounded-sm bg-background font-mono text-xs sm:w-[240px]" data-testid="select-tradeview-bot"><SelectValue placeholder="Choose a bot" /></SelectTrigger>
              <SelectContent className="rounded-sm">
                {botList.map((bot:any) => <SelectItem key={bot.id} value={String(bot.id)} className="font-mono text-xs">{bot.name ?? bot.symbol ?? "Unnamed bot"}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="pt-5"><BotRunSummary runs={botRunRows} accountCurrency={account.data?.currency ?? undefined} /></CardContent>
        </Card>
      ) : null}
    </Workspace>
  )
}

function ChartGrid({data}:{data:any}) { 
  const points=Array.isArray(data?.candles)?data.candles:[]; 
  const closes=points.map((p:any)=>Number(p.close)).filter(Number.isFinite); 
  const min=Math.min(...closes),max=Math.max(...closes),range=max-min||1; 
  return (
    <div className="relative h-full w-full">
      {[25,50,75].map(y=><div key={y} className="absolute left-0 right-0 border-t border-dashed border-border/70" style={{top:`${y}%`}}/>)}
      {points.length>1? (
        <>
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="h-full w-full">
            <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" points={points.map((p:any,i:number)=>`${i/(points.length-1)*600},${185-((Number(p.close)-min)/range)*165}`).join(" ")}/>
          </svg>
          <div className="absolute left-1 top-1 font-mono text-[10px] text-muted-foreground">{max.toFixed(4)}</div>
          <div className="absolute bottom-1 left-1 font-mono text-[10px] text-muted-foreground">{min.toFixed(4)}</div>
        </>
      ) : (
        <div className="grid h-full place-items-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><WifiOff className="mr-2 inline h-4 w-4"/>No candle history</div>
      )}
    </div>
  ) 
}

function DataCard({label,value}:{label:string,value:string}){
  return (
    <Card className="rounded-sm border-border bg-card/50">
      <CardContent className="p-5">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-3 font-mono text-sm tabular-nums tracking-tight">{value}</div>
      </CardContent>
    </Card>
  )
}

export function Workspace({title,eyebrow,description,children}:{title:string,eyebrow:string,description:string,children:any}){
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
      <div className="relative overflow-hidden border-b border-border/80 pb-6">
        <div className="absolute bottom-0 left-0 h-px w-28 signal-line" />
        <div className="font-mono text-[10px] font-medium uppercase tracking-[.22em] text-primary">{eyebrow}</div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          <span className="hidden items-center gap-2 pb-1 font-mono text-[9px] uppercase tracking-[.18em] text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Deriv connected</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}
