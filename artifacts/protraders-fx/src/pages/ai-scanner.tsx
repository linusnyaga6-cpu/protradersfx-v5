import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CircleDashed,
  Crosshair,
  Eye,
  Gauge,
  Loader2,
  Radar,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WifiOff,
  X,
} from "lucide-react"
import {
  getGetAccountQueryKey,
  getGetMarketContractsQueryKey,
  getGetProtradersPreflightQueryKey,
  useAnalyzeMarket,
  useGetAccount,
  useGetMarketContracts,
  useGetProtradersPreflight,
  useScanBestMarket,
} from "@workspace/api-client-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AccountStrip } from "@/components/trading/account-strip"
import { RunSessionSummary } from "@/components/trading/run-session-summary"
import { useTradingRunSession } from "@/hooks/use-trading-run-session"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"
import { DEFAULT_MARKET_SYMBOL, CONTRACT_LABELS, marketLabel } from "@/lib/markets"
import { formatVolatility } from "@/lib/format"
import { Workspace } from "./markets"
import { MarketAnalysisBar } from "@/components/trading/market-analysis-bar"

type ScanRecord = {
  symbol?: string
  displayName?: string
  score?: number
  bias?: string
  indicators?: { volatilityLevel?: string; volatilityPct?: number }
  quote?: number
  price?: number
}

type ScannerForm = {
  stake: string
  stopLoss: string
  runCount: string
  takeProfit: string
  direction: "CALL" | "PUT"
}

const initialForm: ScannerForm = {
  stake: "1",
  stopLoss: "1",
  runCount: "3",
  takeProfit: "3",
  direction: "CALL",
}

export default function AiScanner() {
  const queryClient = useQueryClient()
  const account = useGetAccount(undefined, {
    query: { queryKey: getGetAccountQueryKey(), refetchInterval: 5000 },
  })
  const preflight = useGetProtradersPreflight({
    query: { queryKey: getGetProtradersPreflightQueryKey() },
  })
  const marketQuery = useDerivMarkets()
  const scan = useScanBestMarket()
  const analyze = useAnalyzeMarket()
  const [form, setForm] = useState(initialForm)
  const [scanData, setScanData] = useState<any>(null)
  const [selectedSymbol, setSelectedSymbol] = useState("")
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [scanError, setScanError] = useState("")
  const [analysisError, setAnalysisError] = useState("")
  const [formTouched, setFormTouched] = useState(false)

  const runSession = useTradingRunSession("protraders-run-session:ai-scanner", () => {
    queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() })
  })

  const scanRows = useMemo<ScanRecord[]>(() => {
    if (!Array.isArray(scanData?.markets)) return []
    return scanData.markets.slice(0, 6) as ScanRecord[]
  }, [scanData])
  const bestMarket = (scanData?.best || scanRows[0]) as ScanRecord | undefined
  const scannedSymbol = String(bestMarket?.symbol || marketQuery.defaultSymbol || DEFAULT_MARKET_SYMBOL)
  const activeSymbol = selectedSymbol || scannedSymbol
  const marketAvailable = !marketQuery.isError && marketQuery.markets.length > 0
  const contracts = useGetMarketContracts(activeSymbol, {
    query: {
      queryKey: getGetMarketContractsQueryKey(activeSymbol),
      enabled: Boolean(scanData && activeSymbol),
      staleTime: 60_000,
    },
  })
  const availableTypes = useMemo(() => {
    const values = (contracts.data as any)?.availableContractTypes
    return Array.isArray(values) ? values.filter((item: string) => CONTRACT_LABELS[item]) : []
  }, [contracts.data])

  const availableBalance = Number(account.data?.balance)
  const stake = Number(form.stake)
  const stopLoss = Number(form.stopLoss)
  const runCount = Number(form.runCount)
  const takeProfit = Number(form.takeProfit)
  const selectedAccountType = account.data?.accountType
  const accountCanTrade = selectedAccountType === "real"
    ? preflight.data?.readyForRealTrading
    : selectedAccountType === "demo" && preflight.data?.tradingEnabled
  const inputErrors = getInputErrors({
    stake,
    stopLoss,
    runCount,
    takeProfit,
    availableBalance,
  })
  const contractReady = availableTypes.length > 0 && !contracts.isLoading && !contracts.isError
  const canStart = Boolean(
    scanData
    && analysisData
    && marketAvailable
    && contractReady
    && accountCanTrade
    && !inputErrors.length
    && account.data?.loginid
    && !runSession.isBusy,
  )
  const loading = account.isLoading || preflight.isLoading || marketQuery.isLoading
  const sessionStatus = runSession.state.status
  const terminal = ["stopped", "failed", "completed"].includes(sessionStatus)

  const updateForm = (key: keyof ScannerForm, value: string) => {
    setFormTouched(true)
    setForm(current => ({ ...current, [key]: value }))
  }

  const performScan = async () => {
    setScanError("")
    setAnalysisData(null)
    setAnalysisError("")
    try {
      const result = await scan.mutateAsync()
      setScanData(result)
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "The live market scan could not be completed.")
    }
  }

  const performAnalysis = async () => {
    if (!activeSymbol) return
    setAnalysisError("")
    try {
      const result = await analyze.mutateAsync({ data: { symbol: activeSymbol } })
      setAnalysisData(result)
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Advisory analysis is temporarily unavailable.")
    }
  }

  const startScanner = async () => {
    if (!canStart) return
    await runSession.start({
      account_id: String(account.data?.loginid || ""),
      account_type: selectedAccountType,
      symbol: activeSymbol,
      contract_type: form.direction,
      stake,
      stop_loss: stopLoss,
      duration: 1,
      run_count: runCount,
      risk_cap: stopLoss * runCount,
      source: "ai_assisted",
      request_label: "AI Scanner reviewed run",
    } as any, runCount, takeProfit, stopLoss * runCount)
  }

  if (loading) return <ScannerLoading />

  if (account.isError || preflight.isError) {
    return (
      <Workspace title="AI Scanner" eyebrow="Review-first execution" description="A controlled workspace for turning live Deriv context into a deliberate decision.">
        <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />
        <UnavailableState
          title="Scanner unavailable"
          description="The secure account context could not be loaded. No market scan or trade was started."
          actionLabel="Retry secure context"
          onAction={() => { void account.refetch(); void preflight.refetch() }}
        />
      </Workspace>
    )
  }

  if (!marketAvailable) {
    return (
      <Workspace title="AI Scanner" eyebrow="Review-first execution" description="A controlled workspace for turning live Deriv context into a deliberate decision.">
        <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />
        <UnavailableState
          title="No live market is available"
          description={marketQuery.isError ? "Deriv did not return a market list. Try again when the market stream is available." : "The market list is empty right now. The scanner needs an available Deriv instrument before it can prepare a review."}
          actionLabel="Refresh markets"
          onAction={() => { void marketQuery.refetch() }}
        />
      </Workspace>
    )
  }

  return (
    <Workspace title="AI Scanner" eyebrow="Review-first execution" description="Scan live Deriv markets, inspect the advisory context, then explicitly approve a bounded run.">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} switchingDisabled={runSession.isBusy} />
      <MarketAnalysisBar
        symbol={activeSymbol}
        onSymbolChange={value => {
          setSelectedSymbol(value)
          setAnalysisData(null)
          setAnalysisError("")
        }}
        disabled={runSession.isBusy}
      />

      <section className="relative overflow-hidden rounded-sm border border-[#233d52] bg-[#0d2134] text-[#eff8f5] shadow-[0_22px_60px_rgba(13,33,52,.18)]" data-testid="panel-ai-scanner-hero">
        <div className="pointer-events-none absolute inset-0 opacity-50" aria-hidden="true">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#ef765c]/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-[#35c6af]/15 blur-3xl" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/10" />
        </div>
        <div className="relative grid gap-8 p-5 md:p-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.24em] text-[#72e0c8]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#72e0c8]" />
              Advisory engine / live feed
            </div>
            <h2 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[.98] tracking-[-.045em] md:text-6xl">
              Read the setup.<br /><span className="text-[#ef765c]">Keep the decision.</span>
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/65 md:text-base">
              AI Scanner ranks the market and explains the context. It never opens a position from a scan. You review every setting, then choose whether to start.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button type="button" size="lg" onClick={() => { void performScan() }} disabled={scan.isPending || runSession.isBusy} className="h-11 rounded-sm bg-[#ef765c] px-5 text-white hover:bg-[#df624b]" data-testid="button-scan-markets">
                {scan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
                {scan.isPending ? "Scanning live markets" : scanData ? "Scan again" : "Scan live markets"}
              </Button>
              {scanData && (
                <Button type="button" size="lg" variant="outline" onClick={() => { void performAnalysis() }} disabled={analyze.isPending || runSession.isBusy} className="h-11 rounded-sm border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white" data-testid="button-analyze-market">
                  {analyze.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {analysisData ? "Refresh advisory" : "Review advisory"}
                </Button>
              )}
            </div>
            <p className="mt-4 text-[11px] text-white/45">Nothing is submitted by scanning or reviewing advisory context.</p>
          </div>
          <ScannerTelemetry
            rows={scanRows}
            bestMarket={bestMarket}
            scanning={scan.isPending}
            scanData={scanData}
            error={scanError}
            onRetry={() => { void performScan() }}
          />
        </div>
      </section>

      {(scanError || analysisError) && (
        <Alert className="border-destructive/35 bg-destructive/5" data-testid="alert-scanner-error">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle>Data request needs attention</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{scanError || analysisError}</span>
            <Button type="button" size="sm" variant="outline" onClick={scanError ? () => { void performScan() } : () => { void performAnalysis() }} data-testid="button-retry-scanner-data">Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
           <AdvisoryCard analysis={analysisData} bestMarket={bestMarket?.symbol === activeSymbol ? bestMarket : undefined} symbol={activeSymbol} />
          <ConfigurationCard
            form={form}
            updateForm={updateForm}
            currency={account.data?.currency || "USD"}
            availableBalance={availableBalance}
            errors={inputErrors}
            touched={formTouched}
            disabled={runSession.isBusy}
          />
        </div>
        <div className="space-y-5">
          <ReviewGate
            account={account.data}
            preflight={preflight.data}
            scanData={scanData}
            analysisData={analysisData}
            contractReady={contractReady}
            contractsLoading={contracts.isLoading}
            contractsError={contracts.isError}
            canStart={canStart}
            inputErrors={inputErrors}
            onStart={() => { void startScanner() }}
            busy={runSession.isBusy}
          />
          <RunSessionSummary
            state={runSession.state}
            currency={account.data?.currency || "USD"}
            onStart={() => { void startScanner() }}
            onStop={runSession.stop}
            onReset={runSession.reset}
            disabled={!canStart}
            label="Start AI Scanner"
            runNoun="AI Scanner"
          />
        </div>
      </div>

      <StatusRail status={sessionStatus} terminal={terminal} />
    </Workspace>
  )
}

function ScannerLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-8" aria-label="Loading AI Scanner" data-testid="loading-ai-scanner">
      <div className="h-24 animate-pulse border-b border-border bg-card/40" />
      <div className="h-24 animate-pulse rounded-sm bg-card" />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5"><div className="h-56 animate-pulse rounded-sm bg-card" /><div className="h-72 animate-pulse rounded-sm bg-card" /></div>
        <div className="h-80 animate-pulse rounded-sm bg-card" />
      </div>
    </div>
  )
}

function UnavailableState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <Card className="rounded-sm border-dashed border-[#ef765c]/40 bg-[#fff8f4]" data-testid="state-market-unavailable">
      <CardContent className="grid place-items-center px-6 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#ef765c]/10 text-[#c8523e]"><WifiOff className="h-5 w-5" /></div>
        <h2 className="mt-5 font-display text-2xl font-semibold text-[#182f43]">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        <Button type="button" variant="outline" className="mt-6 rounded-sm" onClick={onAction} data-testid="button-retry-market-state"><RefreshCw className="mr-2 h-4 w-4" />{actionLabel}</Button>
      </CardContent>
    </Card>
  )
}

function ScannerTelemetry({ rows, bestMarket, scanning, scanData, error, onRetry }: { rows: ScanRecord[]; bestMarket?: ScanRecord; scanning: boolean; scanData: any; error: string; onRetry: () => void }) {
  return (
    <div className="self-end rounded-sm border border-white/15 bg-[#081a2a]/65 p-4 backdrop-blur-sm" data-testid="panel-market-telemetry">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-white/65"><BarChart3 className="h-4 w-4 text-[#72e0c8]" />Market telemetry</div>
        <Badge variant="outline" className={`rounded-sm font-mono text-[9px] uppercase tracking-widest ${scanning ? "border-[#f0b864]/40 text-[#f0b864]" : bestMarket ? "border-[#72e0c8]/40 text-[#72e0c8]" : "border-white/20 text-white/50"}`}>
          {scanning ? "SCANNING" : bestMarket ? "REVIEW READY" : "NO SCAN"}
        </Badge>
      </div>
      <Progress value={scanning ? 54 : scanData ? 100 : 0} className="mt-4 h-1 bg-white/10" />
      <div className="mt-4 space-y-2">
        {rows.length ? rows.map((row, index) => (
          <div key={`${row.symbol}-${index}`} className={`flex items-center justify-between gap-3 rounded-sm border px-3 py-2.5 ${index === 0 ? "border-[#72e0c8]/35 bg-[#72e0c8]/10" : "border-white/10 bg-white/[.025]"}`} data-testid={`row-scanner-market-${index}`}>
            <div className="min-w-0"><div className="truncate text-xs font-medium text-white/90">{row.displayName || row.symbol}</div><div className="mt-0.5 font-mono text-[9px] text-white/45">{row.symbol || "SYMBOL"}</div></div>
            <div className="shrink-0 text-right"><div className="font-mono text-[10px] text-[#72e0c8]">{row.score == null ? "—" : `${row.score}/100`}</div><div className="font-mono text-[9px] uppercase text-white/45">{row.bias || "neutral"}</div></div>
          </div>
        )) : (
          <div className="grid min-h-32 place-items-center rounded-sm border border-dashed border-white/15 px-4 text-center text-xs text-white/45">
            {scanning ? <><Loader2 className="mb-2 h-4 w-4 animate-spin text-[#f0b864]" />Comparing active volatility markets</> : error ? <><span>{error}</span><Button type="button" variant="ghost" size="sm" onClick={onRetry} className="mt-2 text-[#72e0c8]" data-testid="button-retry-market-scan">Try again</Button></> : <><CircleDashed className="mb-2 h-4 w-4" />Scan results will appear here</>}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 font-mono text-[9px] uppercase tracking-widest text-white/35">
        <span>{bestMarket ? marketLabel(undefined, String(bestMarket.symbol)) : "Awaiting candidate"}</span>
        <span>{scanning ? "Fresh candles" : scanData ? "Observed context" : "Deriv feed"}</span>
      </div>
    </div>
  )
}

function AdvisoryCard({ analysis, bestMarket, symbol }: { analysis: any; bestMarket?: ScanRecord; symbol: string }) {
  const bias = String(analysis?.bias || bestMarket?.bias || "neutral").toLowerCase()
  const bullish = bias.includes("bull")
  const bearish = bias.includes("bear")
  const indicators = analysis?.indicators || bestMarket?.indicators
  const confidence = analysis?.confidence ?? analysis?.score ?? bestMarket?.score
  return (
    <Card className="rounded-sm border-border bg-card/75" data-testid="card-advisory-context">
      <CardHeader className="border-b border-border/60 bg-secondary/15 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-xl"><Eye className="h-5 w-5 text-primary" />Advisory context</CardTitle>
            <CardDescription className="mt-1">Evidence for review, not a guarantee or an instruction.</CardDescription>
          </div>
          <Badge variant={analysis ? "success" : "outline"} className="rounded-sm font-mono text-[9px] uppercase tracking-wider" data-testid="status-advisory-context">{analysis ? "ANALYZED" : "NO ANALYSIS"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {!analysis ? (
          <div className="grid min-h-32 place-items-center rounded-sm border border-dashed border-border p-6 text-center" data-testid="state-no-scan-yet">
            <div><ScanSearch className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{bestMarket ? "Review the advisory context before starting." : "No scan yet."}</p><p className="mt-1 text-xs text-muted-foreground">{bestMarket ? "Use Review advisory to generate bounded analysis for the selected market." : "Start with Scan live markets. Nothing is submitted at this stage."}</p></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><div className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Selected instrument</div><div className="mt-1 font-display text-2xl font-semibold">{bestMarket?.displayName || marketLabel(undefined, symbol)}</div><div className="font-mono text-[10px] text-muted-foreground">{symbol}</div></div>
              <div className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-wider ${bullish ? "border-success/30 bg-success/10 text-success" : bearish ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-accent/35 bg-accent/10 text-accent-foreground"}`}>
                {bullish ? <TrendingUp className="h-4 w-4" /> : bearish ? <TrendingDown className="h-4 w-4" /> : <Gauge className="h-4 w-4" />}{bias}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Evidence label="Signal score" value={confidence == null ? "Observed" : `${confidence}/100`} />
              <Evidence label="Volatility" value={formatVolatility(indicators?.volatilityLevel, indicators?.volatilityPct)} />
              <Evidence label="Suggested read" value={analysis?.recommendation || analysis?.signal || (bullish ? "Upward context" : bearish ? "Downward context" : "Mixed context")} />
            </div>
            <div className="rounded-sm border border-primary/20 bg-primary/[.04] p-3 text-xs leading-5 text-muted-foreground">{analysis?.summary || analysis?.message || "The advisory engine returned observed market context. Consider the signal alongside your own plan before approving a run."}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Evidence({ label, value }: { label: string; value: string }) {
  return <div className="rounded-sm border border-border/70 bg-background/55 p-3"><div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-2 truncate font-mono text-xs font-semibold" title={value}>{value}</div></div>
}

function ConfigurationCard({ form, updateForm, currency, availableBalance, errors, touched, disabled }: { form: ScannerForm; updateForm: (key: keyof ScannerForm, value: string) => void; currency: string; availableBalance: number; errors: string[]; touched: boolean; disabled: boolean }) {
  return (
    <Card className="rounded-sm border-border bg-card/75" data-testid="card-scanner-configuration">
      <CardHeader className="border-b border-border/60 bg-secondary/15 pb-4"><CardTitle className="flex items-center gap-2 font-display text-xl"><Crosshair className="h-5 w-5 text-primary" />Bounded run plan</CardTitle><CardDescription>Set the limits first. The scanner will not infer or change them.</CardDescription></CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Stake (${currency})`} id="scanner-stake" value={form.stake} onChange={value => updateForm("stake", value)} disabled={disabled} hint={`Available: ${Number.isFinite(availableBalance) ? availableBalance.toFixed(2) : "—"} ${currency}`} />
          <Field label={`Stop-loss (${currency})`} id="scanner-stop-loss" value={form.stopLoss} onChange={value => updateForm("stopLoss", value)} disabled={disabled} hint="Maximum loss budget for this run plan." />
          <Field label="Number of runs" id="scanner-run-count" value={form.runCount} onChange={value => updateForm("runCount", value)} disabled={disabled} hint="Sequential contracts, capped at 10." />
          <Field label={`Take-profit (${currency})`} id="scanner-take-profit" value={form.takeProfit} onChange={value => updateForm("takeProfit", value)} disabled={disabled} hint="Stops the plan when net profit reaches this amount." />
        </div>
        <div className="space-y-2">
          <Label>Direction</Label>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Contract direction">
            <DirectionButton value="CALL" selected={form.direction === "CALL"} onClick={() => updateForm("direction", "CALL")} disabled={disabled} />
            <DirectionButton value="PUT" selected={form.direction === "PUT"} onClick={() => updateForm("direction", "PUT")} disabled={disabled} />
          </div>
        </div>
        {touched && errors.length > 0 && <div className="space-y-1 rounded-sm border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive" data-testid="state-invalid-input"><div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-3.5 w-3.5" />Review the run plan</div>{errors.map(error => <div key={error} className="pl-5">{error}</div>)}</div>}
        <div className="flex items-start gap-2 border-t border-border/60 pt-4 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Settings are held for review. Starting is a separate, explicit action.</div>
      </CardContent>
    </Card>
  )
}

function Field({ label, id, value, onChange, disabled, hint }: { label: string; id: string; value: string; onChange: (value: string) => void; disabled: boolean; hint: string }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min="0.01" step="0.01" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} data-testid={`input-${id}`} /><p className="text-[10px] leading-4 text-muted-foreground">{hint}</p></div>
}

function DirectionButton({ value, selected, onClick, disabled }: { value: "CALL" | "PUT"; selected: boolean; onClick: () => void; disabled: boolean }) {
  const call = value === "CALL"
  return <button type="button" onClick={onClick} disabled={disabled} className={`flex h-12 items-center justify-between rounded-sm border px-3 text-left transition-colors ${selected ? call ? "border-success/50 bg-success/10 text-success" : "border-destructive/50 bg-destructive/10 text-destructive" : "border-border bg-background/40 text-muted-foreground hover:bg-secondary/50"} disabled:cursor-not-allowed disabled:opacity-60`} data-testid={`button-direction-${value.toLowerCase()}`}><span className="flex items-center gap-2 text-sm font-semibold">{call ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{value}</span>{selected && <Check className="h-4 w-4" />}</button>
}

function ReviewGate({ account, preflight, scanData, analysisData, contractReady, contractsLoading, contractsError, canStart, inputErrors, onStart, busy }: { account: any; preflight: any; scanData: any; analysisData: any; contractReady: boolean; contractsLoading: boolean; contractsError: boolean; canStart: boolean; inputErrors: string[]; onStart: () => void; busy: boolean }) {
  const accountReady = account?.accountType === "demo" ? preflight?.tradingEnabled : account?.accountType === "real" ? preflight?.readyForRealTrading : false
  const checks = [
    { label: "Market scan completed", done: Boolean(scanData) },
    { label: "Advisory context reviewed", done: Boolean(analysisData) },
    { label: "Supported contract verified", done: contractReady },
    { label: "Account execution gate open", done: Boolean(accountReady) },
    { label: "Run inputs valid", done: inputErrors.length === 0 },
  ]
  return (
    <Card className="rounded-sm border-[#ef765c]/30 bg-[#fff8f4]" data-testid="card-review-gate">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-display text-lg text-[#182f43]"><ShieldCheck className="h-5 w-5 text-[#c8523e]" />Review gate</CardTitle><CardDescription>Every check must pass before a session can begin.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {checks.map(check => <div key={check.label} className="flex items-center gap-3 rounded-sm border border-[#e9d9d1] bg-white/55 px-3 py-2.5 text-xs"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${check.done ? "bg-success/15 text-success" : "bg-[#e9d9d1] text-[#9d8a80]"}`}>{check.done ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span className={check.done ? "text-[#304b59]" : "text-[#7d706a]"}>{check.label}</span></div>)}
        {contractsLoading && <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Verifying available Deriv contracts</div>}
        {contractsError && <div className="flex items-center gap-2 pt-2 text-[11px] text-destructive"><X className="h-3.5 w-3.5" />No supported contract returned for this market.</div>}
        {!accountReady && account?.accountType && <p className="pt-2 text-[11px] leading-5 text-destructive">{account.accountType === "real" ? "Real trading is not enabled for this account." : "Demo trading is not enabled for this account."}</p>}
        <Button type="button" size="lg" onClick={onStart} disabled={!canStart || busy} className="mt-3 h-12 w-full rounded-sm bg-[#ef765c] text-white shadow-[0_10px_22px_rgba(200,82,62,.16)] hover:bg-[#df624b]" data-testid="button-start-ai-scanner">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}{busy ? "AI Scanner running" : "Start AI Scanner"}
        </Button>
        <p className="pt-1 text-center text-[10px] leading-4 text-muted-foreground">This is the only action that can submit a reviewed trade plan.</p>
      </CardContent>
    </Card>
  )
}

function StatusRail({ status, terminal }: { status: string; terminal: boolean }) {
  if (status === "idle") return null
  const labels: Record<string, string> = {
    running: "Session active · waiting for authoritative Deriv settlement",
    stopping: "Stop requested · current contract will settle, then no new run will start",
    stopped: "Session stopped safely · no new order was submitted after the stop request",
    failed: "Session failed · review the settlement rows and provider message below",
    completed: "Session completed · settlement rows below remain authoritative",
  }
  return <div className={`flex items-start gap-3 rounded-sm border px-4 py-3 text-xs ${status === "failed" ? "border-destructive/30 bg-destructive/5 text-destructive" : terminal ? "border-success/25 bg-success/5 text-success" : "border-primary/25 bg-primary/5 text-primary"}`} data-testid={`status-ai-scanner-${status}`}><div className="mt-0.5">{status === "failed" ? <AlertCircle className="h-4 w-4" /> : terminal ? <Check className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}</div><span>{labels[status] || "Session status updated."}</span></div>
}

function getInputErrors({ stake, stopLoss, runCount, takeProfit, availableBalance }: { stake: number; stopLoss: number; runCount: number; takeProfit: number; availableBalance: number }) {
  const errors: string[] = []
  if (!Number.isFinite(stake) || stake <= 0) errors.push("Stake must be greater than zero.")
  else if (Number.isFinite(availableBalance) && availableBalance > 0 && stake >= availableBalance) errors.push("Stake must stay below the available balance.")
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) errors.push("Stop-loss must be greater than zero.")
  if (!Number.isInteger(runCount) || runCount < 1 || runCount > 10) errors.push("Number of runs must be a whole number from 1 to 10.")
  if (!Number.isFinite(takeProfit) || takeProfit <= 0) errors.push("Take-profit must be greater than zero.")
  return errors
}