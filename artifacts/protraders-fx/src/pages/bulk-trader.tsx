import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Activity, BarChart3, CheckCircle2, Loader2, ScanSearch, ShieldCheck } from "lucide-react"
import {
  getGetAccountQueryKey,
  getGetProtradersPreflightQueryKey,
  useGetAccount,
  useGetMarketContracts,
  getGetMarketContractsQueryKey,
  useGetProtradersPreflight,
  useScanBestMarket,
} from "@workspace/api-client-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AccountStrip } from "@/components/trading/account-strip"
import { RunSessionSummary } from "@/components/trading/run-session-summary"
import { useTradingRunSession } from "@/hooks/use-trading-run-session"
import { DEFAULT_MARKET_SYMBOL, CONTRACT_LABELS, marketLabel } from "@/lib/markets"
import { formatVolatility } from "@/lib/format"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"
import { Workspace } from "./markets"
import { TradingTabs } from "@/components/trading/trading-tabs"
import { MarketAnalysisBar } from "@/components/trading/market-analysis-bar"

export default function BulkTrader() {
  const queryClient = useQueryClient()
  const account = useGetAccount(undefined, { query: { queryKey: getGetAccountQueryKey(), refetchInterval: 5000 } })
  const [selectedAccount, setSelectedAccount] = useState<any>(null)
  const preflight = useGetProtradersPreflight({ query: { queryKey: getGetProtradersPreflightQueryKey() } })
  const activeAccount = selectedAccount || account.data
  const marketQuery = useDerivMarkets()
  useEffect(() => {
    if (account.data) setSelectedAccount(account.data)
  }, [account.data])
  const scan = useScanBestMarket()
  const [setupOpen, setSetupOpen] = useState(false)
  const [stake, setStake] = useState("1")
  const [runCount, setRunCount] = useState("3")
  const [scanData, setScanData] = useState<any>(null)
  const [selectedSymbol, setSelectedSymbol] = useState("")
  const [scanError, setScanError] = useState("")
  const [notice, setNotice] = useState("")

  const runSession = useTradingRunSession("protraders-run-session:bulk-trader", () => {
    queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
  })

  const bestMarket = scanData?.best || scanData?.markets?.[0]
  const scannedSymbol = String(bestMarket?.symbol || marketQuery.defaultSymbol || DEFAULT_MARKET_SYMBOL)
  const requestedSymbol = selectedSymbol || scannedSymbol
  const contracts = useGetMarketContracts(requestedSymbol, {
    query: {
      queryKey: getGetMarketContractsQueryKey(requestedSymbol),
      enabled: Boolean(requestedSymbol),
      staleTime: 60_000,
    },
  })
  const availableTypes = Array.isArray((contracts.data as any)?.availableContractTypes)
    ? (contracts.data as any).availableContractTypes.filter((item: string) => CONTRACT_LABELS[item])
    : []
  const fallbackSymbol = marketQuery.defaultSymbol || DEFAULT_MARKET_SYMBOL
  const scannedContractUnavailable = !contracts.isLoading
    && (contracts.isError || Boolean(contracts.data && availableTypes.length === 0))
  const fallbackContracts = useGetMarketContracts(fallbackSymbol, {
    query: {
      queryKey: getGetMarketContractsQueryKey(fallbackSymbol),
      enabled: Boolean(scannedSymbol !== fallbackSymbol && scannedContractUnavailable),
      staleTime: 60_000,
    },
  })
  const fallbackTypes = Array.isArray((fallbackContracts.data as any)?.availableContractTypes)
    ? (fallbackContracts.data as any).availableContractTypes.filter((item: string) => CONTRACT_LABELS[item])
    : []
  const usingFallback = requestedSymbol !== fallbackSymbol && scannedContractUnavailable && fallbackTypes.length > 0
  const executionSymbol = usingFallback ? fallbackSymbol : requestedSymbol
  const executionTypes = usingFallback ? fallbackTypes : availableTypes
  const selectedContract = executionTypes.includes("CALL") ? "CALL" : executionTypes[0] || "CALL"
  const contractReady = executionTypes.length > 0
    && !(usingFallback ? fallbackContracts.isLoading || fallbackContracts.isError : contracts.isLoading || contracts.isError)
  const availableBalance = Number(activeAccount?.balance)
  const totalRuns = Number(runCount)
  const stakeValue = Number(stake)
  const validSetup = Number.isInteger(totalRuns) && totalRuns >= 1 && totalRuns <= 100
    && Number.isFinite(availableBalance) && availableBalance > 0
    && Number.isFinite(stakeValue) && stakeValue > 0 && stakeValue < availableBalance
  const selectedAccountType = activeAccount?.accountType
  const accountSessionLabel = selectedAccountType === "real"
    ? "real-account"
    : selectedAccountType === "demo"
      ? "demo-account"
      : "selected-account"
  const accountBadgeLabel = selectedAccountType === "real"
    ? "Real account"
    : selectedAccountType === "demo"
      ? "Demo account"
      : "Select account"
  const accountCanTrade = selectedAccountType === "real"
    ? preflight.data?.readyForRealTrading
    : selectedAccountType === "demo" && preflight.data?.tradingEnabled
  const accountGateMessage = !selectedAccountType
    ? "Select a Demo or Real account before running Bulk Trader."
    : selectedAccountType === "real"
    ? preflight.data && !preflight.data.readyForRealTrading
      ? "Real trading is not ready for this account."
      : ""
    : selectedAccountType === "demo"
      ? preflight.data && !preflight.data.tradingEnabled
        ? "Bulk Trader requires enabled Demo trading."
        : ""
      : ""
  const canRun = Boolean(
    accountCanTrade
    && validSetup
    && contractReady
    && !runSession.isBusy,
  )
  const scanRows = useMemo(() => Array.isArray(scanData?.markets) ? scanData.markets.slice(0, 5) : [], [scanData])

  const performScan = async () => {
    setScanError("")
    try {
      const result = await scan.mutateAsync() as any
      setScanData(result)
      return result
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Market scan unavailable.")
      return null
    }
  }

  useEffect(() => {
    void performScan()
  }, [])

  useEffect(() => {
    if (!runSession.isBusy) return
    const timer = window.setInterval(() => { void performScan() }, 15_000)
    return () => window.clearInterval(timer)
  }, [runSession.isBusy])

  const startBulkRun = async () => {
    if (!canRun) return
    setNotice("")
    const freshScan = await performScan()
    const market = freshScan?.best || freshScan?.markets?.[0] || bestMarket
    const freshSymbol = String(market?.symbol || executionSymbol)
    if (freshSymbol !== executionSymbol) {
      setScanData(freshScan)
      setNotice(`The scan changed to ${freshSymbol}. Review the updated market before starting.`)
      return
    }
    const symbol = String(market?.symbol || executionSymbol)
    const preferredDirection = market?.symbol === symbol && market?.bias === "bearish" ? "PUT" : "CALL"
    const contractTypesForSymbol = symbol === executionSymbol ? executionTypes : []
    const contractType = contractTypesForSymbol.includes(preferredDirection)
      ? preferredDirection
      : contractTypesForSymbol.includes(selectedContract)
        ? selectedContract
        : selectedContract
    setSetupOpen(false)
    await runSession.start({
      account_id: String(activeAccount?.loginid || ""),
      account_type: activeAccount?.accountType,
      symbol,
      contract_type: contractType,
      stake: stakeValue,
      duration: 1,
      stop_loss: Math.min(1, stakeValue),
       source: "bulk",
      request_label: "Bulk Trader quick run",
    }, totalRuns, Number.POSITIVE_INFINITY)
  }

  const scanProgress = runSession.isBusy ? 72 : scanData ? 100 : scan.isPending ? 42 : 0
  const activeStatus = runSession.isBusy
    ? `Scanning live volatility markets while run ${runSession.state.currentRun || 1} of ${runSession.state.totalRuns} is in progress.`
    : scan.isPending
      ? "Comparing fresh Deriv candles and market conditions…"
      : scanData
        ? "Market scan is ready. Start a bounded bulk session when you are ready."
        : "Market scan has not returned yet."

  return (
        <Workspace title="Bulk Trader" eyebrow={selectedAccountType === "real" ? "Real-account execution" : "Fast, bounded execution"} description={`Run a bounded ${accountSessionLabel} session.`}>
      <AccountStrip account={activeAccount} isLoading={account.isLoading} error={account.isError} switchingDisabled={runSession.isBusy} onAccountChange={setSelectedAccount} />
       <TradingTabs active="bulk" />
       <MarketAnalysisBar
         symbol={executionSymbol}
         onSymbolChange={value => setSelectedSymbol(value)}
         disabled={runSession.isBusy}
       />

      <div className="overflow-hidden rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.18),transparent_38%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--secondary)/.45))] shadow-[0_18px_60px_rgba(0,0,0,.16)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Live Deriv market scan
          </div>
          <Badge variant="outline" className="border-primary/30 bg-background/40"><ShieldCheck className="mr-1 h-3 w-3 text-primary" />{accountBadgeLabel}</Badge>
        </div>
        <div className="grid gap-8 px-5 py-10 md:grid-cols-[1.1fr_.9fr] md:px-10">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[.25em] text-primary">Scan · select · run</p>
            <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">A faster way to run a bounded plan.</h2>
             <p className="mt-4 max-w-xl leading-7 text-muted-foreground">Scan live markets, then execute the exact number of runs entered.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => setSetupOpen(true)} disabled={runSession.isBusy} data-testid="button-open-bulk-setup">
                 <Activity className="mr-2 h-4 w-4" />{runSession.isBusy ? "Bulk Trader active" : "Run Bulk Trader"}
              </Button>
              <span className="text-xs text-muted-foreground">Stake + run count only</span>
            </div>
          </div>
          <ScanPanel
            rows={scanRows}
            bestMarket={bestMarket}
            status={activeStatus}
            progress={scanProgress}
            isScanning={scan.isPending}
            error={scanError}
          />
        </div>
      </div>

      {notice && (
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertTitle>Bulk Trader</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="border-b bg-secondary/10">
            <CardTitle className="flex items-center gap-2 text-lg"><ScanSearch className="h-5 w-5 text-primary" />What Bulk Trader is doing</CardTitle>
            <CardDescription>Observed state from live Deriv data, not a simulated performance claim.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <ScanStep label="Discover active volatility markets" done={Boolean(scanData)} active={scan.isPending} />
            <ScanStep label="Compare fresh candle history" done={Boolean(scanData?.markets?.length)} active={scan.isPending} />
            <ScanStep label={bestMarket ? `Selected ${marketLabel(undefined, scannedSymbol)} for the session` : "Select the best available market"} done={Boolean(bestMarket)} active={Boolean(scanData) && !bestMarket} />
             <ScanStep label={runSession.isBusy ? "Execute runs and wait for settlement" : "Ready to execute the run plan"} done={runSession.isBusy || runSession.state.status === "completed"} active={!runSession.isBusy && Boolean(scanData)} />
              <p className="pt-2 text-xs leading-5 text-muted-foreground">Scan refreshes during a run. Orders settle one at a time.</p>
          </CardContent>
        </Card>
        <RunSessionSummary
          state={runSession.state}
          currency={activeAccount?.currency || "USD"}
          onStart={() => setSetupOpen(true)}
          onStop={runSession.stop}
          onReset={runSession.reset}
          disabled={!canRun}
           label="Run Bulk Trader"
           runNoun="Bulk Trader"
        />
      </div>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader>
           <DialogTitle>Run Bulk Trader</DialogTitle>
           <DialogDescription>Enter the stake and number of runs. Starting submits the bounded session immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="quick-bulk-stake">Stake ({activeAccount?.currency || "account currency"})</Label>
              <Input id="quick-bulk-stake" type="number" min="0.01" step="0.01" value={stake} onChange={event => setStake(event.target.value)} autoFocus data-testid="input-bulk-stake" />
              <p className="text-xs text-muted-foreground">Enter any trader-selected amount below the available account balance.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-bulk-runs">Number of runs</Label>
              <Input id="quick-bulk-runs" type="number" min="1" max="100" step="1" value={runCount} onChange={event => setRunCount(event.target.value)} data-testid="input-bulk-runs" />
              <p className="text-xs text-muted-foreground">Runs are sequential and stop at the count entered here.</p>
            </div>
            {accountGateMessage && <p className="text-xs text-destructive">{accountGateMessage}</p>}
            {!validSetup && <p className="text-xs text-destructive">Enter a stake below the available account balance and a whole-number run count from 1 to 100.</p>}
            {usingFallback && <p className="text-xs text-amber-600">{scannedSymbol} did not return usable contracts, so this run will use the verified fallback market {fallbackSymbol}.</p>}
            {!contractReady && !contracts.isLoading && !fallbackContracts.isLoading && <p className="text-xs text-amber-600">A supported Deriv contract is not currently verified. Run the scan again before starting.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
            <Button type="button" onClick={startBulkRun} disabled={!canRun} data-testid="button-start-bulk-run">
              {scan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
               Run Bulk Trader
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Workspace>
  )
}

function ScanPanel({ rows, bestMarket, status, progress, isScanning, error }: { rows: any[]; bestMarket?: any; status: string; progress: number; isScanning: boolean; error: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/55 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-primary" />Market scanner</div>
        <Badge variant={isScanning ? "outline" : bestMarket ? "success" : "secondary"}>{isScanning ? "SCANNING" : bestMarket ? "READY" : "WAITING"}</Badge>
      </div>
      <Progress value={progress} className="mt-4 h-1.5" />
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{status}</p>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-4 space-y-2">
        {rows.length ? rows.map((row, index) => (
          <div key={row.symbol || index} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${index === 0 ? "border-primary/30 bg-primary/10" : "border-white/10 bg-white/[.03]"}`}>
            <div><span className="mr-2 font-mono text-muted-foreground">0{index + 1}</span><span className="font-medium">{row.displayName || row.symbol}</span><span className="ml-2 font-mono text-[10px] text-muted-foreground">{row.symbol}</span></div>
            <div className="text-right"><span className="block font-mono">{formatVolatility(row.indicators?.volatilityLevel, row.indicators?.volatilityPct)}</span><span className="text-muted-foreground">{row.score == null ? "—" : `${row.score}/100`} · {row.bias || "neutral"}</span></div>
          </div>
        )) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 p-4 text-xs text-muted-foreground">
            {isScanning && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />} Waiting for live market candidates…
          </div>
        )}
      </div>
      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">Scores are observed historical scan context only. They are not Deriv win rates or profit guarantees.</p>
    </div>
  )
}

function ScanStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5 text-sm">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? "bg-primary/15 text-primary" : active ? "bg-amber-500/15 text-amber-500" : "bg-secondary text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  )
}