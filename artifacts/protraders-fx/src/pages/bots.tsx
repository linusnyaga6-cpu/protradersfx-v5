import { useState, useEffect } from "react"
import { Link } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight, Bot as BotIcon, CheckCircle2, Copy, Pause, Play, Plus, ShieldCheck,
  Settings, Save, Archive, Clock, Activity, Loader2, AlertTriangle, AlertCircle, Search,
  Gauge, HandCoins, Sparkles, Download, FileText
} from "lucide-react"
import {
  useListBots, getListBotsQueryKey,
  useListBotTemplates, getListBotTemplatesQueryKey,
  useCreateBot, useUpdateBot, useChangeBotLifecycle,
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
import { DEFAULT_MARKET_SYMBOL, CONTRACT_LABELS, SUPPORTED_VOLATILITY_SYMBOLS } from "@/lib/markets"
import { useDerivMarkets } from "@/hooks/use-deriv-markets"
import { useTradingRunSession } from "@/hooks/use-trading-run-session"
import { RunSessionSummary } from "@/components/trading/run-session-summary"
import { FreeVertexPreview } from "@/components/bots/freevertex-preview"

export default function Bots() {
  const client = useQueryClient();
  const bots = useListBots({ query: { queryKey: getListBotsQueryKey(), refetchInterval: 10000 } });
  const templates = useListBotTemplates({ query: { queryKey: getListBotTemplatesQueryKey() } });
  const account = useGetAccount(undefined, { query: { queryKey: getGetAccountQueryKey(), refetchInterval: 5000 } });

  const create = useCreateBot();
  const life = useChangeBotLifecycle();
  const archiveTpl = useArchiveBotTemplate();
  const preflight = useGetProtradersPreflight({ query: { queryKey: getGetProtradersPreflightQueryKey() } });

  const [notice, setNotice] = useState("");
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [executingBotId, setExecutingBotId] = useState<string | null>(null);
  const requestedMarket = typeof window === "undefined" ? DEFAULT_MARKET_SYMBOL : new URLSearchParams(window.location.search).get("symbol") || DEFAULT_MARKET_SYMBOL;
  const requestedSymbol = SUPPORTED_VOLATILITY_SYMBOLS.has(requestedMarket) ? requestedMarket : DEFAULT_MARKET_SYMBOL;
  const runSession = useTradingRunSession("protraders-run-session:bot", () => {
    client.invalidateQueries({ queryKey: getGetAccountQueryKey() });
    if (executingBotId) client.invalidateQueries({ queryKey: getListBotRunsQueryKey(executingBotId) });
  });

  const list = Array.isArray((bots.data as any)?.bots) ? (bots.data as any).bots : Array.isArray(bots.data) ? bots.data : [];
  const builtIns = Array.isArray((templates.data as any)?.builtIn) ? (templates.data as any).builtIn : [];
  const custom = Array.isArray((templates.data as any)?.templates) ? (templates.data as any).templates : [];
  const sourceBots = builtIns.filter((template: any) => template.botNumber === 1 || template.botNumber === 2);

  const allTemplates = [...builtIns.filter((template: any) => !template.botNumber), ...custom].filter(t =>
    !templateSearch ||
    (t.name?.toLowerCase().includes(templateSearch.toLowerCase())
      || t.description?.toLowerCase().includes(templateSearch.toLowerCase())
      || t.source?.toLowerCase().includes(templateSearch.toLowerCase()))
  );

  const add = (template: any) => {
    const isCustom = custom.some((c: any) => c.id === template.id);
    const templateStake = Number(template.strategy?.stake) || 10;
    const templateRunCount = Number(template.strategy?.runCount) || 1;
    const templateRiskCap = Number(template.strategy?.riskCap) || Math.max(100, templateStake * templateRunCount);
    create.mutate({
      data: {
        name: template.botNumber
          ? `Bot ${template.botNumber} · ${template.name ?? "Observation"}`
          : `${template.name ?? "Observation"} / ${template.id ?? "new"}`,
         symbol: String(template.symbol ?? template.strategy?.symbol ?? requestedSymbol),
        config: {
          indicator: template.strategy?.indicator || "ema",
          direction: "BOTH",
           mode: template.strategy?.mode || "market_observer",
          contractType: template.strategy?.contractType || "CALL",
          barrier: template.strategy?.barrier || "5",
          stopLoss: Number(template.strategy?.stopLoss) || 1,
          runCount: templateRunCount,
          takeProfit: Number(template.strategy?.takeProfit) || 1,
          stake: templateStake,
          duration: Number(template.strategy?.duration) || 1,
          riskCap: Math.max(templateRiskCap, templateStake * templateRunCount),
          ...(template.strategy?.notes ? { notes: String(template.strategy.notes).substring(0, 1000) } : {}),
          execution: "dry_run"
        },
        ...(isCustom && template.id ? { templateId: template.id } : {})
      }
    }, {
      onSuccess: (bot: any) => {
        client.invalidateQueries({ queryKey: getListBotsQueryKey() });
        setNotice("Bot created. Review its settings before starting a session.");
        setSelectedBotId(String(bot.id));
        setTimeout(() => setNotice(""), 4000);
      },
      onError: e => setNotice(`Create failed: ${e.message}`)
    });
  };

  const selectedBot = list.find((b: any) => String(b.id) === selectedBotId);
  const accountSessionLabel = account.data?.accountType === "real"
    ? "real-account"
    : account.data?.accountType === "demo"
      ? "demo-account"
      : "selected-account"
  const executeBot = async (bot: any) => {
    if (bot.config?.mode === "recovery_guard") {
      setNotice("Recovery is monitor-only and cannot place an order.");
      return;
    }
    const accountCanTrade = account.data?.accountType === "real"
      ? preflight.data?.readyForRealTrading
      : account.data?.accountType === "demo" && preflight.data?.tradingEnabled
    if (!accountCanTrade) {
      setNotice(account.data?.accountType === "real"
          ? "Real trading is not ready for this account."
        : account.data?.accountType === "demo"
          ? "Bot execution requires enabled Demo trading."
          : "Select a Demo or Real account before starting a bot.");
      return;
    }
    setExecutingBotId(String(bot.id));
    try {
      const contractType = String(bot.config?.contractType || "CALL");
      const orderData = {
          bot_id: String(bot.id),
          account_id: String(account.data?.loginid || ""),
          account_type: account.data?.accountType,
          symbol: String(bot.symbol),
          contract_type: contractType as any,
          ...(CONTRACT_LABELS[contractType]?.needsBarrier ? { barrier: String(bot.config?.barrier || "5") } : {}),
          stake: Number(bot.config?.stake || 1),
          duration: Number(bot.config?.duration || 1),
          stop_loss: Number(bot.config?.stopLoss || 1),
          run_count: Number(bot.config?.runCount || 1),
          risk_cap: Number(bot.config?.riskCap || 0),
          source: "bot_assisted",
          request_label: `${bot.name} user-started bot session`,
      };
      const runCount = Number(bot.config?.runCount || 1);
      const stake = Number(bot.config?.stake || 1);
      const riskCap = Number(bot.config?.riskCap || 0);
      if (!Number.isFinite(riskCap) || riskCap <= 0 || stake * runCount > riskCap) {
        setNotice("Reduce the stake or run count to stay within this bot’s risk cap.");
        return;
      }
      await runSession.start(orderData, runCount, Number(bot.config?.takeProfit || 1), riskCap);
    } catch (error) {
      setNotice(`Bot execution stopped: ${error instanceof Error ? error.message : "Deriv rejected the request"}`);
    } finally {
      setExecutingBotId(null);
      client.invalidateQueries({ queryKey: getListBotRunsQueryKey(String(bot.id)) });
    }
  };

  return (
       <Workspace title="Bot Workspace" eyebrow={account.data?.accountType === "real" ? "Real account" : "Bots"} description="Build, review, run.">
      <AccountStrip account={account.data} isLoading={account.isLoading} error={account.isError} switchingDisabled={runSession.isBusy} />
       <section className="overflow-hidden rounded-2xl border border-[#234159] bg-[#091a2d] text-white shadow-[0_18px_60px_rgba(7,19,33,.18)]">
         <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-7">
           <div>
             <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[#20c7c2]">Workspace</div>
             <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">What do you want to open?</h2>
           </div>
           <p className="max-w-sm text-sm text-white/55">Pick a tool. Review every setting before you run.</p>
         </div>
         <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
           <LauncherTile href="#saved-bots" icon={<BotIcon className="h-5 w-5" />} title="Load Bot" detail="Open a saved setup" />
           <LauncherTile href="#premium-ai-bots" icon={<Sparkles className="h-5 w-5" />} title="Premium Bots" detail="Browse strategy templates" tone="gold" />
           <LauncherTile href="/bulk-trade" icon={<Gauge className="h-5 w-5" />} title="Speed Bot" detail="Run a bounded scan" />
           <LauncherTile href="/create-bot" icon={<HandCoins className="h-5 w-5" />} title="Manual Trading" detail="Trade from the terminal" tone="coral" />
         </div>
       </section>
       <div className="flex items-center justify-between gap-3">
         <Badge variant="outline" className="bg-background"><ShieldCheck className="mr-1 h-3 w-3" />Review-first execution</Badge>
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
           <Card id="free-bots" className="scroll-mt-28 shadow-sm">
            <CardHeader className="pb-4 border-b bg-secondary/10">
               <CardTitle className="text-lg">Free bots</CardTitle>
               <p className="text-xs text-muted-foreground">Ready-made starting points.</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
                 {templates.isLoading ? <SkeletonList /> : sourceBots.map((template: any) => (
                 <div key={template.id} className="rounded-lg border border-primary/25 bg-primary/[.045] p-4" data-testid={`source-bot-${template.botNumber}`}>
                    {template.botNumber === 1 && <FreeVertexPreview />}
                   <div className="flex items-start gap-3">
                     <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10">
                       <BotIcon className="h-5 w-5 text-primary" />
                     </div>
                     <div className="min-w-0 flex-1">
                       <div className="flex flex-wrap items-center gap-2">
                         <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">BOT {template.botNumber}</Badge>
                         <div className="font-semibold">{template.name}</div>
                       </div>
                       <div className="mt-1 text-xs text-muted-foreground">{template.description}</div>
                       {template.source && (
                         <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                           Source:{" "}
                           {template.sourceUrl ? (
                             <a href={template.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                               {template.source}
                             </a>
                           ) : template.source}
                         </div>
                       )}
                     </div>
                   </div>
                   <Button size="sm" variant="outline" className="mt-3 w-full bg-background" onClick={() => add(template)} disabled={create.isPending} data-testid={`button-use-source-bot-${template.botNumber}`}>
                     <Copy className="mr-2 h-3 w-3" />{create.isPending ? "Creating..." : `Use Bot ${template.botNumber}`}
                   </Button>
                 </div>
               ))}
                {!bots.isLoading && sourceBots.length > 0 && list.length > 0 && (
                  <div id="saved-bots" className="scroll-mt-28 border-t pt-3 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Saved bots</div>
               )}
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
                   <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border text-[10px]">
                     <BotDetail label="Market" value={String(bot.symbol || "—")} />
                     <BotDetail label="Stake" value={`${Number(bot.config?.stake || 0)} ${account.data?.currency || ""}`.trim()} />
                     <BotDetail label="Stop loss" value={String(bot.config?.stopLoss || "—")} />
                     <BotDetail label="Take profit" value={String(bot.config?.takeProfit || "—")} />
                     <BotDetail label="Runs" value={String(bot.config?.runCount || 1)} />
                     <BotDetail label="Risk cap" value={String(bot.config?.riskCap || "—")} />
                   </div>
                  <div className="flex w-full gap-2 mt-1">
                      <Button size="sm" variant="outline" className="flex-1" onClick={(event) => { event.stopPropagation(); setSelectedBotId(String(bot.id)); }}>
                        <Settings className="mr-2 h-3 w-3" />Edit details
                      </Button>
                     {bot.config?.mode !== "recovery_guard" && selectedBotId !== String(bot.id) && executingBotId !== String(bot.id) && (
                       <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); executeBot(bot); }} disabled={Boolean(executingBotId)} data-testid={`button-run-bot-${bot.id}`}>
                         <Play className="mr-2 h-3 w-3"/>Run Bot
                       </Button>
                     )}
                     <Button size="sm" variant={bot.status === "observing" ? "secondary" : "outline"} className="flex-1" onClick={(e) => { e.stopPropagation(); life.mutate({id:String(bot.id),action:bot.status==="observing"?"pause":"start"},{onSuccess:()=>{client.invalidateQueries({queryKey:getListBotsQueryKey()});setNotice("Lifecycle state updated.")},onError:e=>setNotice(`Lifecycle failed: ${e.message}`)})}} disabled={bot.status === 'archived'} data-testid={`button-toggle-bot-${bot.id}`}>
                      {bot.status === "observing" ? <><Pause className="mr-2 h-3 w-3"/>Pause observation</> : <><Play className="mr-2 h-3 w-3"/>Observe</>}
                    </Button>
                  </div>
                  {bot.config?.mode !== "recovery_guard" && (selectedBotId === String(bot.id) || executingBotId === String(bot.id)) && (
                    <div onClick={event => event.stopPropagation()}>
                      <RunSessionSummary
                        state={runSession.state}
                        currency={account.data?.currency || "USD"}
                        onStart={() => executeBot(bot)}
                        onStop={runSession.stop}
                        onReset={runSession.reset}
                         disabled={Boolean(executingBotId && executingBotId !== String(bot.id))}
                         runNoun="Bot"
                      />
                    </div>
                  )}
                </div>
               )) : !templates.isLoading && sourceBots.length === 0 ? <Empty title="No bots configured" text="Choose a template, review its limits, then start it when ready." /> : null}
            </CardContent>
          </Card>

           <Card id="premium-ai-bots" className="scroll-mt-28 shadow-sm">
            <CardHeader className="pb-4 border-b bg-secondary/10">
               <CardTitle className="text-lg">AI templates</CardTitle>
               <p className="text-xs text-muted-foreground">Review settings before use.</p>
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
                     {t.source && (
                       <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                         Source:{" "}
                         {t.sourceUrl ? (
                           <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                             {t.source}
                           </a>
                         ) : t.source}
                       </div>
                     )}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
                      {t.strategy?.indicator && <div className="bg-background px-2 py-1 rounded border">Ind: {t.strategy.indicator}</div>}
                    </div>
                     <Button size="sm" variant="outline" className="mt-3 w-full bg-background" onClick={() => add(t)} disabled={create.isPending} data-testid={`button-use-template-${t.id ?? i}`}>
                        <Copy className="mr-2 h-3 w-3"/>{create.isPending ? "Creating..." : t.botNumber ? `Use Bot ${t.botNumber}` : "Use template"}
                    </Button>
                  </div>
                )) : <Empty title="No templates found" text="Try a different search term." />}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="h-full">
           {selectedBot ? (
             <BotBuilder
               bot={selectedBot}
               accountCurrency={account.data?.currency ?? undefined}
               accountBalance={account.data?.balance ?? null}
               onUpdate={() => client.invalidateQueries({queryKey:getListBotsQueryKey()})}
               onRun={() => executeBot(selectedBot)}
               onCancel={() => setSelectedBotId(null)}
             />
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

function BotBuilder({
  bot,
  accountCurrency,
  accountBalance,
  onUpdate,
  onRun,
  onCancel,
}: {
  bot: any
  accountCurrency?: string
  accountBalance?: number | null
  onUpdate: () => void
  onRun: () => void
  onCancel: () => void
}) {
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
  const [indicator, setIndicator] = useState(bot.config?.indicator || "ema");
  const direction = "BOTH";
  const [mode, setMode] = useState(bot.config?.mode || "market_observer");
  const [stake, setStake] = useState(bot.config?.stake?.toString() || "10");
  const [duration, setDuration] = useState(bot.config?.duration?.toString() || "1");
  const [runCount, setRunCount] = useState(bot.config?.runCount?.toString() || "1");
  const [takeProfit, setTakeProfit] = useState(bot.config?.takeProfit?.toString() || "1");
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
    const fallbackSymbol = marketQuery.defaultSymbol;
    const shouldFallback = Boolean(
      fallbackSymbol
      && symbol !== fallbackSymbol
      && !contracts.isLoading
      && (contracts.isError || availableTypes.length === 0),
    );
    if (shouldFallback) {
      setNotice(`${symbol} is not exposing contract choices right now. Switched to ${fallbackSymbol}; choose another live market if needed.`);
      setSymbol(fallbackSymbol);
      setContractType("CALL");
      setErrors({});
    }
  }, [availableTypes.length, contracts.isError, contracts.isLoading, marketQuery.defaultSymbol, symbol]);

  useEffect(() => {
    setName(bot.name || "");
    setSymbol(bot.symbol || DEFAULT_MARKET_SYMBOL);
    setContractType(bot.config?.contractType || "CALL");
    setBarrier(bot.config?.barrier || "5");
    setStopLoss(bot.config?.stopLoss?.toString() || "1");
    setIndicator(bot.config?.indicator || "ema");
    setMode(bot.config?.mode || "market_observer");
    setStake(bot.config?.stake?.toString() || "10");
    setDuration(bot.config?.duration?.toString() || "1");
    setRunCount(bot.config?.runCount?.toString() || "1");
    setTakeProfit(bot.config?.takeProfit?.toString() || "1");
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
     const balanceNum = Number(accountBalance);
     if (isNaN(stakeNum) || stakeNum <= 0) errs.stake = "Stake must be a valid amount";
     else if (!Number.isFinite(balanceNum) || balanceNum <= 0) errs.stake = "Available account balance could not be verified";
     else if (stakeNum >= balanceNum) errs.stake = "Stake must be below the available account balance";
     const durationNum = Number(duration);
     if (isNaN(durationNum) || durationNum < 1 || !Number.isInteger(durationNum)) errs.duration = "Duration must be a valid whole number";
    const runCountNum = Number(runCount);
    if (!Number.isInteger(runCountNum) || runCountNum < 1 || runCountNum > 10) errs.runCount = "Runs must be a whole number from 1 to 10";
    const takeProfitNum = Number(takeProfit);
     if (!Number.isFinite(takeProfitNum) || takeProfitNum <= 0) errs.takeProfit = "Take profit must be a valid amount";
    const capNum = Number(riskCap);
     if (isNaN(capNum) || capNum <= 0) errs.riskCap = "Risk cap must be a valid amount";
     if (!Number.isFinite(Number(stopLoss)) || Number(stopLoss) <= 0) errs.stopLoss = "Stop loss must be a valid amount";

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
           mode,
          stake: stakeNum,
          duration: durationNum,
          runCount: runCountNum,
          takeProfit: takeProfitNum,
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
           indicator, direction, mode, stake: Number(stake) || 10, duration: Number(duration) || 1, runCount: Number(runCount) || 1, takeProfit: Number(takeProfit) || 1, riskCap: Number(riskCap) || 100,
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
      <Card className="border border-[#155b56] bg-[#020b0a] text-white shadow-[0_18px_55px_rgba(0,0,0,.22)]">
        <CardHeader className="flex flex-col gap-4 border-b border-[#123b39] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">{name || "Unnamed Bot"}</CardTitle>
            <CardDescription className="mt-2 flex flex-wrap items-center gap-2 text-white/55">
              <Badge variant="outline" className="border-[#18b8ad]/40 bg-[#18b8ad]/10 uppercase tracking-wider text-[#6ee7df]">
                <ShieldCheck className="h-3 w-3 mr-1" /> {mode === "recovery_guard" ? "Recovery Guard (monitor-only)" : "User-started bot session"}
              </Badge>
              <Badge variant="secondary" className="bg-white/10 uppercase tracking-wider text-white/65">
                Status: {bot.status === 'archived' || bot.status === 'stopped' ? bot.status : (bot.status === 'observing' ? 'observing' : (bot.status ?? "draft"))}
              </Badge>
            </CardDescription>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
             <Button variant="outline" size="sm" onClick={handleSaveAsTemplate} disabled={createTpl.isPending} className="flex-1 border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white sm:flex-none">
               <Copy className="mr-2 h-4 w-4"/>Save as Template
             </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-[#16a34a] text-white shadow-sm hover:bg-[#12843c] sm:flex-none">
               {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Save
             </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-4 md:p-6">
           {String(bot.name || "").startsWith("Bot 1") && <FreeVertexPreview compact />}
          {notice && (
             <Alert variant="default" className="border-[#18b8ad]/30 bg-[#18b8ad]/10 text-[#8df0e8]">
              <CheckCircle2 className="h-4 w-4 !text-success" />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

           <div className="rounded-xl border border-[#0d514e] bg-[#000403] p-4 shadow-[0_0_28px_rgba(22,184,173,.08)] md:p-5">
             <div className="mb-5 flex items-center justify-between gap-3">
               <div>
                 <div className="text-base font-semibold text-[#8df0e8]">Bot Parameters</div>
                 <div className="mt-1 text-xs text-white/45">Set limits before launch.</div>
               </div>
               <Badge variant="outline" className="border-[#16a34a]/40 bg-[#16a34a]/10 text-[10px] uppercase tracking-wider text-[#6ee7a0]">Fixed stake</Badge>
             </div>
           <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
             <Label className="text-xs font-medium text-[#a5f3ec]">Bot name</Label>
             <Input value={name} onChange={e => setName(e.target.value)} className="border-[#159e98] bg-[#06110f] text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

               <div className="space-y-2">
                 <Label className="text-xs font-medium text-[#a5f3ec]">Market</Label>
               <Select value={symbol} onValueChange={setSymbol}>
                 <SelectTrigger className="border-[#159e98] bg-[#06110f] font-mono text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]"><SelectValue /></SelectTrigger>
                 <SelectContent>{marketQuery.markets.map(item => <SelectItem key={item.symbol} value={item.symbol}><span>{item.displayName}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{item.symbol}</span></SelectItem>)}</SelectContent>
               </Select>
                 <p className="text-xs text-white/40">Live Deriv volatility index.</p>
              {errors.symbol && <p className="text-xs text-destructive">{errors.symbol}</p>}
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Indicator</Label>
              <Select value={indicator} onValueChange={setIndicator}>
                 <SelectTrigger className="border-[#159e98] bg-[#06110f] text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]"><SelectValue placeholder="Select indicator" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ema">Exponential Moving Average (EMA)</SelectItem>
                  <SelectItem value="rsi">Relative Strength Index (RSI)</SelectItem>
                  <SelectItem value="macd">MACD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label className="text-xs font-medium text-[#a5f3ec]">Contract</Label>
              {["Rise / Fall", "Over / Under", "Odd / Even"].map(family => {
                const options = Object.entries(CONTRACT_LABELS).filter(([, item]) => item.family === family)
                return <div key={family} className="space-y-2">
                   <div className="text-xs font-medium text-white/55">{family}</div>
                  <div className="grid grid-cols-2 gap-2">
                     {options.map(([value, item]) => <Button key={value} type="button" size="sm" variant={contractType === value ? "default" : "outline"} className={contractType === value ? "bg-[#159e98] text-white hover:bg-[#12847f]" : "border-[#1a6662] bg-[#06110f] text-white/70 hover:bg-[#0b211f] hover:text-white"} onClick={() => setContractType(value)} disabled={!availableTypes.includes(value)}>{item.action}</Button>)}
                  </div>
                </div>
              })}
              {contracts.isLoading && <p className="text-xs text-muted-foreground">Checking Deriv contracts for this volatility…</p>}
              {contracts.isError && <p className="text-xs text-amber-600">Deriv contract availability is temporarily unavailable for this symbol. The builder will use the current default market when available.</p>}
              {!contracts.isLoading && !contracts.isError && !availableTypes.length && <p className="text-xs text-amber-600">Deriv has not returned a supported trading type for this symbol yet. Choose another live market.</p>}
              {errors.contractType && <p className="text-xs text-destructive">{errors.contractType}</p>}
              {CONTRACT_LABELS[contractType]?.needsBarrier && <div className="grid grid-cols-5 gap-1">{Array.from({ length: 10 }, (_, i) => String(i)).map(digit => <Button key={digit} type="button" size="sm" variant={barrier === digit ? "default" : "outline"} onClick={() => setBarrier(digit)}>{digit}</Button>)}</div>}
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Stake · {accountCurrency || "account"}</Label>
               <Input type="number" step="1" value={stake} onChange={e => setStake(e.target.value)} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
               <p className="text-xs text-white/40">Below available balance.</p>
              {errors.stake && <p className="text-xs text-destructive">{errors.stake}</p>}
            </div>
            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Stop loss · {accountCurrency || "account"}</Label>
               <Input type="number" min="0.01" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.stopLoss && <p className="text-xs text-destructive">{errors.stopLoss}</p>}
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Ticks before expiry</Label>
              <div className="grid grid-cols-4 gap-2">
                 {["1", "2", "3", "5"].map(ticks => <Button key={ticks} type="button" size="sm" variant={duration === ticks ? "default" : "outline"} className={duration === ticks ? "bg-[#159e98] text-white hover:bg-[#12847f]" : "border-[#1a6662] bg-[#06110f] text-white/70 hover:bg-[#0b211f] hover:text-white"} onClick={() => setDuration(ticks)}>{ticks}</Button>)}
              </div>
               <Input type="number" min="1" max="10" step="1" value={duration} onChange={e => setDuration(e.target.value)} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.duration && <p className="text-xs text-destructive">{errors.duration}</p>}
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Runs before stop</Label>
               <Input type="number" min="1" max="10" step="1" value={runCount} onChange={e => setRunCount(e.target.value)} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.runCount && <p className="text-xs text-destructive">{errors.runCount}</p>}
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Take profit · {accountCurrency || "account"}</Label>
               <Input type="number" min="0.01" step="0.01" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.takeProfit && <p className="text-xs text-destructive">{errors.takeProfit}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Risk cap · max loss</Label>
               <Input type="number" step="1" value={riskCap} onChange={e => setRiskCap(e.target.value)} className="max-w-[50%] border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.riskCap && <p className="text-xs text-destructive">{errors.riskCap}</p>}
            </div>
           </div>
           </div>

          <div className="space-y-2">
             <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Textarea
               placeholder="Optional run notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
               className="h-20 resize-none border-border/80 bg-background/60 text-foreground"
            />
          </div>
           <div className="flex items-center justify-end gap-2 border-t border-[#123b39] pt-4">
             <Button type="button" variant="outline" onClick={onCancel} className="border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
               Cancel
             </Button>
             <Button type="button" onClick={onRun} disabled={saving || mode === "recovery_guard"} className="bg-[#16a34a] text-white shadow-[0_0_18px_rgba(22,163,74,.2)] hover:bg-[#12843c]">
               <Play className="mr-2 h-4 w-4" /> Launch Bot
             </Button>
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
  const downloadResults = () => {
    const blob = new Blob([JSON.stringify(runRows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bot-${botId}-results.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <BotRunSummary runs={runRows} accountCurrency={accountCurrency} />
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="space-y-0 border-b bg-background p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 pt-3">
            <div className="flex items-center gap-5 text-[10px] font-semibold uppercase tracking-wider">
              <span className="pb-3 text-muted-foreground">Summary</span>
              <span className="relative pb-3 text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary">Transactions</span>
              <span className="pb-3 text-muted-foreground">Journal</span>
            </div>
            <Activity className="mb-3 h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <Button type="button" size="sm" onClick={downloadResults} disabled={!runRows.length} className="h-8 bg-[#102d78] text-xs text-white hover:bg-[#0c245e]">
              <Download className="mr-2 h-3.5 w-3.5" />Download
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!runRows.length} className="h-8 text-xs">
              <FileText className="mr-2 h-3.5 w-3.5" />View detail
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {runs.isLoading ? (
            <div className="flex flex-col items-center justify-center p-10 text-sm text-muted-foreground">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" /> Loading results...
            </div>
          ) : runs.isError ? (
            <div className="flex flex-col items-center justify-center p-8 text-sm text-destructive">
              <AlertCircle className="mb-2 h-6 w-6" /> Failed to load results
            </div>
          ) : runRows.length ? (
            <div className="max-h-[360px] divide-y overflow-y-auto">
              <div className="hidden grid-cols-[minmax(100px,.7fr)_minmax(140px,1fr)_minmax(120px,.8fr)] gap-3 border-y bg-muted/20 px-4 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                <span>Type</span><span>Entry / Exit spot</span><span className="text-right">Buy price and P/L</span>
              </div>
              {runRows.map((run: any) => <BotResultRow key={run.id} run={run} accountCurrency={accountCurrency} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-sm text-muted-foreground">
              <Clock className="mb-3 h-8 w-8 text-muted-foreground/40" />
              No run results yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BotResultRow({ run, accountCurrency }: { run: any; accountCurrency?: string }) {
  const result = run.result ?? {};
  const settlement = result.providerSettlement ?? result.settlement ?? result.contract ?? {};
  const exactInputs = result.exactInputs ?? {};
  const status = String(settlement.status ?? settlement.outcome ?? run.status ?? "queued").toLowerCase();
  const type = settlement.contractType ?? result.contractType ?? exactInputs.contractType ?? result.action ?? "SIGNAL";
  const entry = settlement.entrySpot ?? result.entrySpot ?? result.entry ?? null;
  const exit = settlement.exitSpot ?? result.exitSpot ?? result.exit ?? null;
  const buyPrice = settlement.buyPrice ?? result.buyPrice ?? result.stake ?? exactInputs.stake ?? null;
  const pnl = settlement.netProfit ?? settlement.profit ?? result.netProfit ?? result.profit ?? null;
  const positive = pnl != null && Number(pnl) >= 0;
  const statusColor = status === "won" || status === "settled" ? "text-success" : status === "lost" || status === "rejected" ? "text-destructive" : "text-amber-600";

  return (
    <div className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-muted/20 sm:grid-cols-[minmax(100px,.7fr)_minmax(140px,1fr)_minmax(120px,.8fr)] sm:items-center" data-testid={`row-bot-result-${run.id}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${positive ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
          <Activity className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-[10px] font-semibold uppercase">{type}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor.replace("text-", "bg-")}`} />
          </div>
          <div className="truncate text-[9px] text-muted-foreground">Run {String(run.runNumber ?? run.id ?? "—").slice(-4)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[10px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ResultSpot label="Entry" value={formatBotSpot(entry)} />
        <ResultSpot label="Exit" value={formatBotSpot(exit)} />
      </div>
      <div className="text-left sm:text-right">
        <div className="font-mono text-[10px] font-semibold">{buyPrice == null ? "—" : formatBotMoney(buyPrice, accountCurrency)}</div>
        <div className={`mt-0.5 font-mono text-[10px] font-semibold ${pnl == null ? "text-muted-foreground" : positive ? "text-success" : "text-destructive"}`}>
          {pnl == null ? (run.result?.dryRun ? "Dry run" : "Pending") : formatBotSignedMoney(pnl, accountCurrency)}
        </div>
      </div>
    </div>
  );
}

function ResultSpot({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="truncate font-mono text-[10px] font-semibold">{value}</div></div>;
}

function formatBotSpot(value: unknown) {
  return value == null || value === "" || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}

function formatBotMoney(value: unknown, currency?: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${currency || "USD"} ${amount.toFixed(2)}` : "—";
}

function formatBotSignedMoney(value: unknown, currency?: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount >= 0 ? "+" : "-"}${currency || "USD"} ${Math.abs(amount).toFixed(2)}` : "—";
}

function SkeletonList(){return <div className="space-y-3"><div className="h-20 animate-pulse rounded-lg bg-muted/50"/><div className="h-20 animate-pulse rounded-lg bg-muted/50"/></div>}
function Empty({title,text}:{title:string,text:string}){return <div className="rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center bg-secondary/5"><CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/50"/><div className="mt-3 font-semibold text-foreground">{title}</div><p className="mt-1 text-sm text-muted-foreground max-w-[200px] mx-auto leading-relaxed">{text}</p></div>}
function BotDetail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-background/90 p-2"><div className="uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-foreground">{value}</div></div>
}

function LauncherTile({
  href,
  icon,
  title,
  detail,
  tone = "teal",
}: {
  href: string
  icon: React.ReactNode
  title: string
  detail: string
  tone?: "teal" | "gold" | "coral"
}) {
  const toneClass = tone === "gold"
    ? "text-[#f0c95b] group-hover:bg-[#f0c95b]/15"
    : tone === "coral"
      ? "text-[#ff9b87] group-hover:bg-[#ff9b87]/15"
      : "text-[#20c7c2] group-hover:bg-[#20c7c2]/15"
  return (
    <Link href={href} className="group flex min-h-[132px] flex-col justify-between bg-[#0d2438] p-5 transition-colors hover:bg-[#12304a]" data-testid={`link-bot-launcher-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-xl bg-white/5 ${toneClass}`}>{icon}</span>
      <span className="mt-6 flex items-center justify-between gap-2">
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-xs text-white/45">{detail}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white" />
      </span>
    </Link>
  )
}
