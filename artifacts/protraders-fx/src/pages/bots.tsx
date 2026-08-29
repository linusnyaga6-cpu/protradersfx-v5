import { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Bot as BotIcon, CheckCircle2, Copy, Pause, Play, Plus, RotateCcw, ShieldCheck,
  Settings, Save, Archive, Clock, Activity, Loader2, AlertTriangle, AlertCircle, Search
} from "lucide-react"
import {
  useListBots, getListBotsQueryKey,
  useListBotTemplates, getListBotTemplatesQueryKey,
  useCreateBot, useUpdateBot, useChangeBotLifecycle, useRunBotOnce, useCreateTrade,
  useListBotRuns, getListBotRunsQueryKey,
  useCreateBotTemplate, useUpdateBotTemplate, useArchiveBotTemplate,
  useGetAccount, getGetAccountQueryKey, useGetProtradersPreflight, getGetProtradersPreflightQueryKey,
  useGetMarketContracts, getGetMarketContractsQueryKey
} from "@workspace/api-client-react"
import { Workspace } from "./markets"
import { AccountStrip } from "@/components/trading/account-strip"
import { BotRunSummary } from "@/components/trading/bot-run-summary"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DEFAULT_MARKET_SYMBOL, CONTRACT_LABELS } from "@/lib/markets"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"

export default function Bots() {
  const client = useQueryClient();
  const bots = useListBots({ query: { queryKey: getListBotsQueryKey(), refetchInterval: 10000 } });
  const templates = useListBotTemplates({ query: { queryKey: getListBotTemplatesQueryKey() } });
  const account = useGetAccount({ query: { queryKey: getGetAccountQueryKey(), refetchInterval: 5000 } });

  const create = useCreateBot();
  const life = useChangeBotLifecycle();
  const run = useRunBotOnce();
  const trade = useCreateTrade();
  const archiveTpl = useArchiveBotTemplate();
  const preflight = useGetProtradersPreflight({ query: { queryKey: getGetProtradersPreflightQueryKey() } });

  const [notice, setNotice] = useState("");
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [executingBotId, setExecutingBotId] = useState<string | null>(null);
  const requestedSymbol = typeof window === "undefined" ? DEFAULT_MARKET_SYMBOL : new URLSearchParams(window.location.search).get("symbol") || DEFAULT_MARKET_SYMBOL;
  const stopRequested = useRef(false);

  const list = Array.isArray((bots.data as any)?.bots) ? (bots.data as any).bots : Array.isArray(bots.data) ? bots.data : [];
  const builtIns = Array.isArray((templates.data as any)?.builtIn) ? (templates.data as any).builtIn : [];
  const custom = Array.isArray((templates.data as any)?.templates) ? (templates.data as any).templates : [];

  const allTemplates = [...builtIns, ...custom].filter(t =>
    !templateSearch ||
    (t.name?.toLowerCase().includes(templateSearch.toLowerCase()) || t.description?.toLowerCase().includes(templateSearch.toLowerCase()))
  );

  const add = (template: any) => {
    const isCustom = custom.some((c: any) => c.id === template.id);
    create.mutate({
      data: {
        name: `${template.name ?? "Observation"} / ${template.id ?? "new"}`,
         symbol: String(template.symbol ?? template.strategy?.symbol ?? requestedSymbol),
        config: {
          indicator: template.strategy?.indicator || "ema",
          direction: "BOTH",
           mode: template.strategy?.mode || "market_observer",
          stake: Number(template.strategy?.stake) || 10,
          duration: Number(template.strategy?.duration) || 5,
          riskCap: Number(template.strategy?.riskCap) || 100,
          ...(template.strategy?.notes ? { notes: String(template.strategy.notes).substring(0, 1000) } : {}),
          execution: "dry_run"
        },
        ...(isCustom && template.id ? { templateId: template.id } : {})
      }
    }, {
      onSuccess: (bot: any) => {
        client.invalidateQueries({ queryKey: getListBotsQueryKey() });
        setNotice("Bot created in dry-run mode.");
        setSelectedBotId(String(bot.id));
        setTimeout(() => setNotice(""), 4000);
      },
      onError: e => setNotice(`Create failed: ${e.message}`)
    });
  };

  const selectedBot = list.find((b: any) => String(b.id) === selectedBotId);
  const executeBot = async (bot: any) => {
    if (bot.config?.mode === "recovery_guard") {
      setNotice("Recovery is monitor-only and cannot place an order.");
      return;
    }
    if (account.data?.accountType !== "demo" || !preflight.data?.tradingEnabled || !preflight.data?.demoOnly) {
      setNotice("Bot execution requires the protected Deriv demo mode.");
      return;
    }
    const count = Math.min(10, Math.max(1, Number(bot.config?.runCount) || 1));
    if (!window.confirm(`Run ${count} demo ${count === 1 ? "entry" : "entries"} for ${bot.name}? Each entry uses the displayed stake and stop loss.`)) return;
    stopRequested.current = false;
    setExecutingBotId(String(bot.id));
    let accepted = 0;
    try {
      for (let index = 0; index < count && !stopRequested.current; index += 1) {
        const observation = await run.mutateAsync({ id: String(bot.id) });
        const action = String((observation as any)?.result?.action || "");
        if (!action.startsWith("review-")) {
          setNotice(`Bot paused after observation ${index + 1}: no entry condition was present.`);
          break;
        }
        const contractType = String(bot.config?.contractType || (action === "review-put" ? "PUT" : "CALL"));
        await trade.mutateAsync({
          data: {
            symbol: String(bot.symbol),
            contract_type: contractType as any,
            ...(CONTRACT_LABELS[contractType]?.needsBarrier ? { barrier: String(bot.config?.barrier || "5") } : {}),
            stake: Number(bot.config?.stake || 1),
            duration: Number(bot.config?.duration || 5),
            stop_loss: Number(bot.config?.stopLoss || 1),
            source: "bot_assisted",
            request_label: `${bot.name} demo entry ${index + 1} of ${count}`,
          },
        })
        accepted += 1;
        await client.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      }
      setNotice(stopRequested.current ? `Bot stopped after ${accepted} accepted demo ${accepted === 1 ? "entry" : "entries"}.` : `Bot sequence ended with ${accepted} accepted demo ${accepted === 1 ? "entry" : "entries"}.`);
    } catch (error) {
      setNotice(`Bot execution stopped: ${error instanceof Error ? error.message : "Deriv rejected the request"}`);
    } finally {
      setExecutingBotId(null);
      client.invalidateQueries({ queryKey: getListBotRunsQueryKey(String(bot.id)) });
    }
  };

  return (
    <Workspace title="Bots" eyebrow="Controlled automation" description="Validate first. Every new bot begins in observation mode and stays behind lifecycle controls.">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} />
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="bg-background"><ShieldCheck className="mr-1 h-3 w-3" />Dry-run default</Badge>
        <Button onClick={() => add({name:"Blank observation",id:"blank",strategy:{}})} data-testid="button-create-bot">
          <Plus className="h-4 w-4 mr-2" />New bot
        </Button>
      </div>

      {notice && (
        <Alert variant="default" className="border-success/30 bg-success/10 text-success">
          <CheckCircle2 className="h-4 w-4 !text-success" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[380px_1fr] items-start">
        <div className="space-y-5">
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b bg-secondary/10">
              <CardTitle className="text-lg">Your bots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {bots.isLoading ? <SkeletonList /> : list.length ? list.map((bot: any, i: number) => (
                <div
                  key={bot.id ?? i}
                  className={`flex flex-col gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${selectedBotId === String(bot.id) ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'hover:bg-secondary/40'}`}
                  onClick={() => setSelectedBotId(String(bot.id))}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary"><BotIcon className="h-5 w-5 text-primary"/></div>
                    <div className="min-w-[150px] flex-1">
                       <div className="flex flex-wrap items-center gap-2">
                         <div className="font-semibold">{bot.name ?? `Bot ${i+1}`}</div>
                         {bot.name?.startsWith("Bot 1") && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">FREE</Badge>}
                         {bot.name?.startsWith("Bot 2") && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">RECOVERY</Badge>}
                       </div>
                      <div className="text-xs font-mono text-muted-foreground mt-0.5">{bot.symbol ?? "symbol unavailable"}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {bot.status === 'archived' || bot.status === 'stopped' ? (
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider opacity-60">
                            {bot.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            {bot.status ?? "draft"}
                          </Badge>
                        )}
                        {bot.config?.execution === "dry_run" && (
                          <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 uppercase tracking-wider">
                            <Activity className="mr-1 h-2.5 w-2.5"/> observation
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 mt-1">
                     <Button size="sm" variant="outline" className="flex-1 bg-background" onClick={(e) => { e.stopPropagation(); run.mutate({id:String(bot.id)}, {onSuccess:r=>{client.invalidateQueries({queryKey:getListBotRunsQueryKey(String(bot.id))});setNotice(`Dry-run complete: ${String((r as any)?.result?.recommendation?.action ?? (r as any)?.result?.action ?? "result available")}`)},onError:e=>setNotice(`Run failed: ${e.message}`)})}} disabled={run.isPending} data-testid={`button-run-bot-${bot.id}`}>
                      <RotateCcw className="mr-2 h-3 w-3"/>Run once
                    </Button>
                    <Button size="sm" variant={bot.status === "observing" ? "secondary" : "default"} className="flex-1" onClick={(e) => { e.stopPropagation(); life.mutate({id:String(bot.id),action:bot.status==="observing"?"pause":"start"},{onSuccess:()=>{client.invalidateQueries({queryKey:getListBotsQueryKey()});setNotice("Lifecycle state updated.")},onError:e=>setNotice(`Lifecycle failed: ${e.message}`)})}} disabled={bot.status === 'archived'} data-testid={`button-toggle-bot-${bot.id}`}>
                      {bot.status === "observing" ? <><Pause className="mr-2 h-3 w-3"/>Pause</> : <><Play className="mr-2 h-3 w-3"/>Start</>}
                    </Button>
                  </div>
                  {bot.config?.mode !== "recovery_guard" && (
                    <Button size="sm" className="w-full" variant={executingBotId === String(bot.id) ? "destructive" : "default"} onClick={(event) => {
                      event.stopPropagation();
                      if (executingBotId === String(bot.id)) {
                        stopRequested.current = true;
                        setNotice("Stop requested. The current Deriv request will finish; no new entry will start.");
                      } else {
                        executeBot(bot);
                      }
                    }} disabled={Boolean(executingBotId && executingBotId !== String(bot.id))} data-testid={`button-execute-bot-${bot.id}`}>
                      {executingBotId === String(bot.id) ? <><Pause className="mr-2 h-3 w-3" />Stop after current entry</> : <><Play className="mr-2 h-3 w-3" />Run demo sequence</>}
                    </Button>
                  )}
                </div>
              )) : <Empty title="No bots configured" text="Start with an observation bot. No trades will be placed by default." />}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b bg-secondary/10">
              <CardTitle className="text-lg">Template library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search templates..." className="pl-9" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} />
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {templates.isLoading ? <SkeletonList /> : allTemplates.length ? allTemplates.map((t: any, i: number) => (
                  <div key={t.id ?? i} className="rounded-lg bg-secondary/30 border border-secondary/60 p-4 transition-colors hover:bg-secondary/50">
                    <div className="flex justify-between items-start">
                       <div className="flex flex-wrap items-center gap-2 font-semibold text-sm">
                         {t.botNumber && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">BOT {t.botNumber}</Badge>}
                         <span>{t.name ?? "Unnamed template"}</span>
                       </div>
                      {custom.some((c: any) => c.id === t.id) && (
                         <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => archiveTpl.mutate({id: String(t.id)}, {onSuccess: () => { client.invalidateQueries({queryKey:getListBotTemplatesQueryKey()}); setNotice("Template archived.")}})}>
                           <Archive className="h-3.5 w-3.5" />
                         </Button>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{t.description ?? "Server-defined strategy template"}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
                      {t.strategy?.indicator && <div className="bg-background px-2 py-1 rounded border">Ind: {t.strategy.indicator}</div>}
                    </div>
                     <Button size="sm" variant="outline" className="mt-3 w-full bg-background" onClick={() => add(t)} disabled={create.isPending} data-testid={`button-use-template-${t.id ?? i}`}>
                       <Copy className="mr-2 h-3 w-3"/>{create.isPending ? "Creating..." : t.botNumber ? `Use Bot ${t.botNumber}` : "Use as dry-run"}
                    </Button>
                  </div>
                )) : <Empty title="No templates found" text="Try a different search term." />}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="h-full">
          {selectedBot ? (
            <BotBuilder bot={selectedBot} accountCurrency={account.data?.currency ?? undefined} onUpdate={() => client.invalidateQueries({queryKey:getListBotsQueryKey()})} />
          ) : (
            <Card className="h-full border-dashed bg-secondary/10 flex items-center justify-center min-h-[500px]">
              <div className="text-center p-8 max-w-sm">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary mb-4">
                  <Settings className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">No Bot Selected</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Select a bot from the list on the left or create a new one to open the visual builder and view recent runs.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Workspace>
  )
}

function BotBuilder({ bot, accountCurrency, onUpdate }: { bot: any, accountCurrency?: string, onUpdate: () => void }) {
  const update = useUpdateBot();
  const createTpl = useCreateBotTemplate();
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  const [name, setName] = useState(bot.name || "");
  const marketQuery = useDerivMarkets();
  const [symbol, setSymbol] = useState(bot.symbol || DEFAULT_MARKET_SYMBOL);
  const [contractType, setContractType] = useState(bot.config?.contractType || "CALL");
  const [barrier, setBarrier] = useState(bot.config?.barrier || "5");
  const [stopLoss, setStopLoss] = useState(bot.config?.stopLoss?.toString() || "1");
  const [runCount, setRunCount] = useState(bot.config?.runCount?.toString() || "1");
  const [indicator, setIndicator] = useState(bot.config?.indicator || "ema");
  const direction = "BOTH";
  const [mode, setMode] = useState(bot.config?.mode || "market_observer");
  const [stake, setStake] = useState(bot.config?.stake?.toString() || "10");
  const [duration, setDuration] = useState(bot.config?.duration?.toString() || "5");
  const [notes, setNotes] = useState(bot.config?.notes || "");
  const [riskCap, setRiskCap] = useState(bot.config?.riskCap?.toString() || "100");
  const contracts = useGetMarketContracts(symbol, {
    query: {
      queryKey: getGetMarketContractsQueryKey(symbol),
      enabled: Boolean(symbol),
      staleTime: 60_000,
    },
  });
  const availableTypes = Array.isArray((contracts.data as any)?.availableContractTypes)
    ? (contracts.data as any).availableContractTypes.filter((item: string) => CONTRACT_LABELS[item])
    : [];
  useEffect(() => {
    if (availableTypes.length && !availableTypes.includes(contractType)) setContractType(availableTypes[0]);
  }, [availableTypes.join("|"), contractType]);

  useEffect(() => {
    setName(bot.name || "");
    setSymbol(bot.symbol || DEFAULT_MARKET_SYMBOL);
    setContractType(bot.config?.contractType || "CALL");
    setBarrier(bot.config?.barrier || "5");
    setStopLoss(bot.config?.stopLoss?.toString() || "1");
    setRunCount(bot.config?.runCount?.toString() || "1");
    setIndicator(bot.config?.indicator || "ema");
    setMode(bot.config?.mode || "market_observer");
    setStake(bot.config?.stake?.toString() || "10");
    setDuration(bot.config?.duration?.toString() || "5");
    setNotes(bot.config?.notes || "");
    setRiskCap(bot.config?.riskCap?.toString() || "100");
    setErrors({});
    setNotice("");
  }, [bot.id]);

  const handleSave = () => {
    // Validate deterministically
    const errs: Record<string,string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!symbol.trim() || !/^[A-Z0-9_]+$/.test(symbol)) errs.symbol = "Choose a valid Deriv symbol";
    if (!availableTypes.includes(contractType)) errs.contractType = "This contract is not currently offered for the selected symbol";
    const stakeNum = Number(stake);
    if (isNaN(stakeNum) || stakeNum <= 0) errs.stake = "Stake must be positive";
    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum < 1 || !Number.isInteger(durationNum)) errs.duration = "Duration must be positive integer";
    const capNum = Number(riskCap);
    if (isNaN(capNum) || capNum <= 0) errs.riskCap = "Risk cap must be positive";
    if (!Number.isFinite(Number(stopLoss)) || Number(stopLoss) <= 0) errs.stopLoss = "Stop loss must be positive";
    if (!Number.isInteger(Number(runCount)) || Number(runCount) < 1 || Number(runCount) > 10) errs.runCount = "Run count must be 1–10";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);

    update.mutate({
      id: String(bot.id),
      data: {
        name,
        symbol,
        config: {
          indicator,
          direction,
          contractType,
          ...(CONTRACT_LABELS[contractType]?.needsBarrier ? { barrier } : {}),
          stopLoss: Number(stopLoss),
          runCount: Number(runCount),
           mode,
          stake: stakeNum,
          duration: durationNum,
          ...(notes.trim() ? { notes: notes.trim().substring(0, 1000) } : {}),
          riskCap: capNum,
          execution: "dry_run" // Hard-coded protective measure
        }
      }
    }, {
      onSuccess: () => {
        onUpdate();
        setSaving(false);
        setNotice("Configuration saved successfully.");
        setTimeout(() => setNotice(""), 3000);
      },
      onError: (e) => {
        setSaving(false);
        setNotice(`Save failed: ${e.message}`);
      }
    });
  };

  const handleSaveAsTemplate = () => {
    if (!name.trim()) return setErrors({ name: "Name is required for template" });
    createTpl.mutate({
      data: {
        name: `${name} Template`,
        description: notes || `Template derived from ${name}`,
        strategy: {
           indicator, direction, mode, stake: Number(stake) || 10, duration: Number(duration) || 5, riskCap: Number(riskCap) || 100,
          ...(notes.trim() ? { notes: notes.trim().substring(0, 1000) } : {}),
          execution: "dry_run"
        }
      }
    }, {
      onSuccess: () => {
        client.invalidateQueries({queryKey: getListBotTemplatesQueryKey()});
        setNotice("Saved as template in library.");
        setTimeout(() => setNotice(""), 3000);
      },
      onError: (e) => setNotice(`Template save failed: ${e.message}`)
    });
  };

  return (
    <div className="space-y-5 h-full">
      <Card className="border-t-4 border-t-primary shadow-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 gap-4">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">{name || "Unnamed Bot"}</CardTitle>
            <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 uppercase tracking-wider">
                <ShieldCheck className="h-3 w-3 mr-1" /> {mode === "recovery_guard" ? "Recovery Guard (dry_run)" : "Observation Only (dry_run)"}
              </Badge>
              <Badge variant="secondary" className="uppercase tracking-wider">
                Status: {bot.status === 'archived' || bot.status === 'stopped' ? bot.status : (bot.status === 'observing' ? 'observing' : (bot.status ?? "draft"))}
              </Badge>
            </CardDescription>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
             <Button variant="outline" size="sm" onClick={handleSaveAsTemplate} disabled={createTpl.isPending} className="flex-1 sm:flex-none">
               <Copy className="mr-2 h-4 w-4"/>Save as Template
             </Button>
             <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none shadow-sm">
               {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
               Save Config
             </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {notice && (
            <Alert variant="default" className="bg-success/10 border-success/30 text-success">
              <CheckCircle2 className="h-4 w-4 !text-success" />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/10 p-5 rounded-lg border border-secondary/50">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bot Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="bg-background shadow-sm" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

               <div className="space-y-2">
               <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Instrument Symbol</Label>
               <Select value={symbol} onValueChange={setSymbol}>
                 <SelectTrigger className="bg-background shadow-sm font-mono"><SelectValue /></SelectTrigger>
                 <SelectContent>{marketQuery.markets.map(item => <SelectItem key={item.symbol} value={item.symbol}><span>{item.displayName}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{item.symbol}</span></SelectItem>)}</SelectContent>
               </Select>
              {errors.symbol && <p className="text-xs text-destructive">{errors.symbol}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entry Indicator</Label>
              <Select value={indicator} onValueChange={setIndicator}>
                <SelectTrigger className="bg-background shadow-sm"><SelectValue placeholder="Select indicator" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ema">Exponential Moving Average (EMA)</SelectItem>
                  <SelectItem value="rsi">Relative Strength Index (RSI)</SelectItem>
                  <SelectItem value="macd">MACD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Execution type</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CONTRACT_LABELS).map(([value, item]) => <Button key={value} type="button" size="sm" variant={contractType === value ? "default" : "outline"} onClick={() => setContractType(value)} disabled={!availableTypes.includes(value)}>{item.action}</Button>)}
              </div>
              {contracts.isLoading && <p className="text-xs text-muted-foreground">Checking Deriv contracts for this volatility…</p>}
              {!contracts.isLoading && !availableTypes.length && <p className="text-xs text-destructive">No supported trading type is currently available from Deriv for this symbol.</p>}
              {errors.contractType && <p className="text-xs text-destructive">{errors.contractType}</p>}
              {CONTRACT_LABELS[contractType]?.needsBarrier && <div className="grid grid-cols-5 gap-1">{Array.from({ length: 10 }, (_, i) => String(i)).map(digit => <Button key={digit} type="button" size="sm" variant={barrier === digit ? "default" : "outline"} onClick={() => setBarrier(digit)}>{digit}</Button>)}</div>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Simulated Stake (USD)</Label>
              <Input type="number" step="1" value={stake} onChange={e => setStake(e.target.value)} className="bg-background shadow-sm font-numeric" />
              {errors.stake && <p className="text-xs text-destructive">{errors.stake}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stop loss ({accountCurrency || "account currency"})</Label>
              <Input type="number" min="0.01" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} className="bg-background shadow-sm font-numeric" />
              {errors.stopLoss && <p className="text-xs text-destructive">{errors.stopLoss}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Demo entries per run</Label>
              <Input type="number" min="1" max="10" step="1" value={runCount} onChange={e => setRunCount(e.target.value)} className="bg-background shadow-sm font-numeric" />
              {errors.runCount && <p className="text-xs text-destructive">{errors.runCount}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration (Ticks)</Label>
              <Input type="number" step="1" value={duration} onChange={e => setDuration(e.target.value)} className="bg-background shadow-sm font-numeric" />
              {errors.duration && <p className="text-xs text-destructive">{errors.duration}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Cap (Max Daily Loss)</Label>
              <Input type="number" step="1" value={riskCap} onChange={e => setRiskCap(e.target.value)} className="bg-background shadow-sm font-numeric max-w-[50%]" />
              {errors.riskCap && <p className="text-xs text-destructive">{errors.riskCap}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule & Exit Notes</Label>
            <Textarea
              placeholder="E.g., Only run during London session. Stop if drawdown exceeds $50."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="resize-none h-24 bg-secondary/5"
            />
          </div>
        </CardContent>
      </Card>

      <BotRunHistory botId={String(bot.id)} accountCurrency={accountCurrency} />
    </div>
  );
}

function BotRunHistory({ botId, accountCurrency }: { botId: string; accountCurrency?: string }) {
  const runs = useListBotRuns(botId, { query: { queryKey: getListBotRunsQueryKey(botId), refetchInterval: 5000 } });
  const runRows = Array.isArray((runs.data as any)?.runs) ? (runs.data as any).runs : [];

  return (
    <div className="space-y-5">
      <BotRunSummary runs={runRows} accountCurrency={accountCurrency} />
      <Card className="shadow-sm">
        <CardHeader className="bg-secondary/10 border-b pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Dry-Runs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runs.isLoading ? (
            <div className="p-10 text-center text-muted-foreground text-sm flex flex-col items-center justify-center">
               <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary"/> Loading history...
            </div>
          ) : runs.isError ? (
            <div className="p-8 text-center text-destructive text-sm flex flex-col items-center justify-center">
               <AlertCircle className="mb-2 h-6 w-6"/> Failed to load history
            </div>
          ) : runRows.length ? (
             <div className="divide-y max-h-[300px] overflow-y-auto">
               {runRows.map((run: any) => (
                 <div key={run.id} className="p-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                   <div>
                     <div className="flex items-center gap-2">
                       <span className="font-semibold text-sm capitalize">{run.status}</span>
                       <Badge variant="outline" className="text-[10px] uppercase tracking-widest">{run.mode}</Badge>
                     </div>
                     <div className="text-xs text-muted-foreground mt-1 font-mono">
                       {new Date(run.startedAt || run.started_at || Date.now()).toLocaleString()}
                     </div>
                   </div>
                   <div className="text-right max-w-[50%]">
                     {run.result ? (
                       <div className="text-xs bg-secondary/30 p-2 rounded border font-mono break-words" title={JSON.stringify(run.result, null, 2)}>
                         <div className="font-semibold text-foreground">{run.result.action || run.result.error || "Completed"}</div>
                         {run.result.exactInputs && (
                           <div className="mt-1 text-[10px] text-muted-foreground">
                              Considered: {run.result.exactInputs.indicator?.toUpperCase()} ({run.result.exactInputs.direction})
                           </div>
                         )}
                         {run.result.dryRun && (
                           <div className="mt-1 text-[10px] text-amber-600/80 font-sans font-medium bg-amber-500/10 px-1 py-0.5 rounded inline-block">
                             DRY-RUN ONLY
                           </div>
                         )}
                       </div>
                     ) : (
                       <span className="text-xs text-muted-foreground italic">No result</span>
                     )}
                   </div>
                 </div>
               ))}
             </div>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              No dry-runs recorded yet. Click 'Run once' to test the configuration.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SkeletonList(){return <div className="space-y-3"><div className="h-20 animate-pulse rounded-lg bg-muted/50"/><div className="h-20 animate-pulse rounded-lg bg-muted/50"/></div>}
function Empty({title,text}:{title:string,text:string}){return <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center bg-secondary/5"><CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/50"/><div className="mt-3 font-semibold text-foreground">{title}</div><p className="mt-1 text-sm text-muted-foreground max-w-[200px] mx-auto leading-relaxed">{text}</p></div>}
