ueryKey(executingBotId) });
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
    const templateMartingale = template.strategy?.martingale;
    const templateRiskCap = Number(template.strategy?.riskCap) || Math.max(100, templateStake * templateRunCount);
    const templateMaxStake = Number(templateMartingale?.maxStake) || templateStake;
    const templateExposure = templateMartingale?.enabled ? templateMaxStake * templateRunCount : templateStake * templateRunCount;
    const templateLossLimit = Number(template.strategy?.consecutiveLossLimit) || 3;
    create.mutate({
      data: {
        name: template.botNumber
          ? `Bot ${template.botNumber} · ${sourceBotName(template)}`
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
           riskCap: Math.max(templateRiskCap, templateExposure),
           martingale: {
             enabled: templateMartingale?.enabled === true,
             multiplier: Number(templateMartingale?.multiplier) || 2,
             maxStake: templateMaxStake,
           },
           consecutiveLossLimit: templateLossLimit,
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
      const runCount = Number(bot.config?.runCount || 1);
      const stake = Number(bot.config?.stake || 1);
      const riskCap = Number(bot.config?.riskCap || 0);
      const consecutiveLossLimit = Number(bot.config?.consecutiveLossLimit || 3);
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
           martingale_enabled: bot.config?.martingale?.enabled === true,
           martingale_multiplier: Number(bot.config?.martingale?.multiplier || 2),
           martingale_max_stake: Number(bot.config?.martingale?.maxStake || stake),
          source: "bot_assisted",
           consecutive_loss_limit: consecutiveLossLimit,
          request_label: `${bot.name} user-started bot session`,
      };
      const martingale = bot.config?.martingale;
      const martingaleEnabled = martingale?.enabled === true;
      const martingaleMultiplier = Number(martingale?.multiplier || 2);
      const martingaleMaxStake = Number(martingale?.maxStake || stake);
      const plannedExposure = (martingaleEnabled ? martingaleMaxStake : stake) * runCount;
      if (!Number.isFinite(riskCap) || riskCap <= 0 || plannedExposure > riskCap) {
        setNotice("Reduce the stake or run count to stay within this bot’s risk cap.");
        return;
      }
      await runSession.start(
        orderData,
        runCount,
        Number(bot.config?.takeProfit || 1),
        riskCap,
        { enabled: martingaleEnabled, multiplier: martingaleMultiplier, maxStake: martingaleMaxStake, consecutiveLossLimit },
      );
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
        <section className="overflow-hidden rounded-2xl border border-[#234159] bg-[#091a2d] text-white shadow-[0_18px_60px_rgba(7,19,33,.18)]" data-testid="bots-identity-panel">
         <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-7">
           <div>
               <div className="font-mono text-[10px] uppercase tracking-[.2em] text-[#20c7c2]">Free bot experiences</div>
               <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Observe first. Decide yourself.</h2>
           </div>
             <p className="max-w-sm text-sm text-white/55">Vertex Bot reads market direction. Recovery Bot watches the session. The Free Bot experience stays dry-run until you start a review.</p>
         </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-3">
             <LauncherTile href="#vertex-bot" icon={<BotIcon className="h-5 w-5" />} title="Vertex Bot" detail="Free market observer" />
             <LauncherTile href="#recovery-bot" icon={<ShieldAlert className="h-5 w-5" />} title="Recovery Bot" detail="Monitor only" tone="coral" />
             <LauncherTile href="#free-bot-experience" icon={<Eye className="h-5 w-5" />} title="Free Bot experience" detail="Dry-run by default" />
            <LauncherTile href="#saved-bots" icon={<Settings className="h-5 w-5" />} title="My Bots" detail="Your saved setups" />
            <LauncherTile href="#premium-ai-bots" icon={<Sparkles className="h-5 w-5" />} title="Premium Templates" detail="Browse the strategy library" tone="gold" />
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

       <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="space-y-5">
           <Card id="free-bot-experience" className="scroll-mt-28 shadow-sm">
            <CardHeader className="pb-4 border-b bg-secondary/10">
               <div className="flex items-start justify-between gap-3">
                 <div>
                    <CardTitle className="text-lg">Free Bot experience</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Two controlled experiences, clearly separated by purpose.</p>
                 </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wider">Free · review-first</Badge>
               </div>
            </CardHeader>
              <CardContent className="pt-4">
                <div className="mb-4 grid gap-2 rounded-lg border border-primary/20 bg-primary/[.04] p-3 text-xs sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <div className="flex items-center gap-2 font-semibold text-primary"><Eye className="h-4 w-4" /> What free means here</div>
                  <p className="leading-5 text-muted-foreground">No background activity, no automatic order, and no hidden retry. You add a bot, review its limits, then start a user-controlled session.</p>
                  <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider">dry-run default</Badge>
                </div>
                {templates.isError ? <LibraryError onRetry={() => templates.refetch()} /> : templates.isLoading ? <SkeletonList /> : sourceBots.length ? (
                 <div className="grid gap-4 md:grid-cols-2">
                   {sourceBots.map((template: any) => (
                      <div id={template.botNumber === 1 ? "vertex-bot" : "recovery-bot"} key={template.id} className={`flex flex-col rounded-xl border p-4 ${template.botNumber === 2 ? "border-amber-500/30 bg-amber-500/[.045]" : "border-primary/25 bg-primary/[.045]"}`} data-testid={`source-bot-${template.botNumber}`}>
                       {template.botNumber === 1 ? <FreeVertexPreview compact /> : (
                         <div className="rounded-lg border border-amber-500/20 bg-amber-500/[.06] p-3">
                           <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-amber-600">
                             <ShieldAlert className="h-4 w-4" /> Monitor-only recovery
                           </div>
                           <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[9px] uppercase tracking-wider">
                             <div className="rounded-md border border-amber-500/15 bg-background/60 p-2"><Eye className="mx-auto h-3.5 w-3.5 text-amber-600" /><span className="mt-1 block text-muted-foreground">Watch</span></div>
                             <div className="rounded-md border border-amber-500/15 bg-background/60 p-2"><ShieldCheck className="mx-auto h-3.5 w-3.5 text-amber-600" /><span className="mt-1 block text-muted-foreground">Pause</span></div>
                             <div className="rounded-md border border-amber-500/15 bg-background/60 p-2"><Activity className="mx-auto h-3.5 w-3.5 text-amber-600" /><span className="mt-1 block text-muted-foreground">Review</span></div>
                           </div>
                         </div>
                       )}
                       <div className="mt-4 flex flex-1 flex-col">
                         <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-2">
                             <Badge variant="outline" className={template.botNumber === 2 ? "border-amber-500/30 text-amber-600" : "border-primary/30 text-primary"}>FREE</Badge>
                             <div className="font-semibold">{sourceBotName(template)}</div>
                           </div>
                           <span className="text-[10px] font-mono text-muted-foreground">BOT {template.botNumber}</span>
                         </div>
                         <div className="mt-2 text-sm font-medium text-foreground">{template.botNumber === 2 ? "Protect the review process after an interruption." : "Review EMA direction before making a decision."}</div>
                          <div className="mt-2 text-xs leading-5 text-muted-foreground">{template.botNumber === 2 ? "Checks account and market freshness plus recent failures. It never increases stake, retries an order, or places a trade." : "A free market-observer starting point. It stays dry-run and leaves the final decision with you."}</div>
                         <div className="mt-4 flex flex-wrap items-center gap-2">
                           <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{template.botNumber === 2 ? "Observation only" : "Demo-first"}</Badge>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">User-started · no automatic order</span>
                         </div>
                         <Button size="sm" variant="outline" className="mt-4 w-full bg-background" onClick={() => add(template)} disabled={create.isPending} data-testid={`button-use-source-bot-${template.botNumber}`}>
                           <Copy className="mr-2 h-3 w-3" />{create.isPending ? "Creating..." : `Add ${sourceBotName(template)}`}
                         </Button>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : null}
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
                     <BotDetail label="Loss guard" value={`${Number(bot.config?.consecutiveLossLimit || 3)} consecutive`} />
                     <BotDetail
                       label="Martingale"
                       value={bot.config?.martingale?.enabled
                         ? `${Number(bot.config.martingale.multiplier || 2).toFixed(2)}× · max ${Number(bot.config.martingale.maxStake || bot.config?.stake || 0)}`
                         : "off"}
                     />
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
                 {templates.isError ? <LibraryError onRetry={() => templates.refetch()} /> : templates.isLoading ? <SkeletonList /> : allTemplates.length ? allTemplates.map((t: any, i: number) => (
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
  const isRecovery = mode === "recovery_guard";
  const [stake, setStake] = useState(bot.config?.stake?.toString() || "10");
  const [duration, setDuration] = useState(bot.config?.duration?.toString() || "1");
  const [runCount, setRunCount] = useState(bot.config?.runCount?.toString() || "1");
  const [takeProfit, setTakeProfit] = useState(bot.config?.takeProfit?.toString() || "1");
  const [notes, setNotes] = useState(bot.config?.notes || "");
  const [riskCap, setRiskCap] = useState(bot.config?.riskCap?.toString() || "100");
  const [martingaleEnabled, setMartingaleEnabled] = useState(bot.config?.martingale?.enabled === true);
  const [martingaleMultiplier, setMartingaleMultiplier] = useState(String(bot.config?.martingale?.multiplier || 2));
  const [martingaleMaxStake, setMartingaleMaxStake] = useState(String(bot.config?.martingale?.maxStake || bot.config?.stake || 10));
  const [consecutiveLossLimit, setConsecutiveLossLimit] = useState(String(bot.config?.consecutiveLossLimit || 3));
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
     setMartingaleEnabled(bot.config?.martingale?.enabled === true);
     setMartingaleMultiplier(String(bot.config?.martingale?.multiplier || 2));
     setMartingaleMaxStake(String(bot.config?.martingale?.maxStake || bot.config?.stake || 10));
     setConsecutiveLossLimit(String(bot.config?.consecutiveLossLimit || 3));
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
     const martingaleMultiplierNum = Number(martingaleMultiplier);
     const martingaleMaxStakeNum = Number(martingaleMaxStake);
     const consecutiveLossLimitNum = Number(consecutiveLossLimit);
     if (martingaleEnabled && (!Number.isFinite(martingaleMultiplierNum) || martingaleMultiplierNum < 1 || martingaleMultiplierNum > 5)) {
       errs.martingaleMultiplier = "Use a multiplier from 1.00 to 5.00";
     }
     if (martingaleEnabled && (!Number.isFinite(martingaleMaxStakeNum) || martingaleMaxStakeNum < stakeNum)) {
       errs.martingaleMaxStake = "Maximum stake must be at least the starting stake";
     }
     if (martingaleEnabled && Number.isFinite(martingaleMaxStakeNum) && Number.isFinite(runCountNum) && martingaleMaxStakeNum * runCountNum > capNum) {
       errs.riskCap = "Risk cap must cover the maximum Martingale exposure";
     }
     if (!Number.isInteger(consecutiveLossLimitNum) || consecutiveLossLimitNum < 1 || consecutiveLossLimitNum > 10) {
       errs.consecutiveLossLimit = "Use a whole number from 1 to 10";
     }
     if (martingaleEnabled && Number.isFinite(Number(accountBalance)) && martingaleMaxStakeNum >= Number(accountBalance)) {
       errs.martingaleMaxStake = "Maximum stake must stay below the available account balance";
     }

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
           martingale: {
             enabled: martingaleEnabled,
             multiplier: martingaleEnabled ? martingaleMultiplierNum : 2,
             maxStake: martingaleEnabled ? martingaleMaxStakeNum : stakeNum,
           },
           consecutiveLossLimit: consecutiveLossLimitNum,
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
           martingale: {
             enabled: martingaleEnabled,
             multiplier: martingaleEnabled ? Number(martingaleMultiplier) || 2 : 2,
             maxStake: martingaleEnabled ? Number(martingaleMaxStake) || Number(stake) || 10 : Number(stake) || 10,
           },
           consecutiveLossLimit: Number(consecutiveLossLimit) || 3,
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
           {isRecovery && (
             <Alert variant="default" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
               <ShieldAlert className="h-4 w-4 !text-amber-600" />
               <AlertTitle>Recovery Bot is monitor-only</AlertTitle>
               <AlertDescription>It can watch freshness and interruptions, but it cannot place, retry, or increase a trade.</AlertDescription>
             </Alert>
           )}
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
            <MarketAnalysisBar symbol={symbol} onSymbolChange={setSymbol} disabled={saving} tone="dark" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
             <Label className="text-xs font-medium text-[#a5f3ec]">Bot name</Label>
             <Input value={name} onChange={e => setName(e.target.value)} className="border-[#159e98] bg-[#06110f] text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
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
                      {options.map(([value, item]) => <Button key={value} type="button" size="sm" variant={contractType === value ? "default" : "outline"} className={contractType === value ? "bg-[#159e98] text-white hover:bg-[#12847f]" : "border-[#1a6662] bg-[#06110f] text-white/70 hover:bg-[#0b211f] hover:text-white"} onClick={() => setContractType(value)} disabled={isRecovery || !availableTypes.includes(value)}>{item.action}</Button>)}
                  </div>
                </div>
              })}
              {contracts.isLoading && <p className="text-xs text-muted-foreground">Checking Deriv contracts for this volatility…</p>}
              {contracts.isError && <p className="text-xs text-amber-600">Deriv contract availability is temporarily unavailable for this symbol. The builder will use the current default market when available.</p>}
              {!contracts.isLoading && !contracts.isError && !availableTypes.length && <p className="text-xs text-amber-600">Deriv has not returned a supported trading type for this symbol yet. Choose another live market.</p>}
              {errors.contractType && <p className="text-xs text-destructive">{errors.contractType}</p>}
               {CONTRACT_LABELS[contractType]?.needsBarrier && <div className="grid grid-cols-5 gap-1">{Array.from({ length: 10 }, (_, i) => String(i)).map(digit => <Button key={digit} type="button" size="sm" variant={barrier === digit ? "default" : "outline"} onClick={() => setBarrier(digit)} disabled={isRecovery}>{digit}</Button>)}</div>}
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Stake · {accountCurrency || "account"}</Label>
                <Input type="number" step="1" value={stake} onChange={e => setStake(e.target.value)} disabled={isRecovery} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
                <p className="text-xs text-white/40">{isRecovery ? "Not used: monitoring does not place a trade." : "Below available balance."}</p>
              {errors.stake && <p className="text-xs text-destructive">{errors.stake}</p>}
            </div>
             <div className="rounded-lg border border-amber-500/25 bg-amber-500/[.06] p-3 md:col-span-2">
               <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                 <div>
                   <div className="flex items-center gap-2">
                     <Label htmlFor="bot-martingale" className="text-xs font-semibold text-amber-200">Martingale progression</Label>
                     <Badge variant="outline" className="border-amber-500/30 text-[9px] uppercase tracking-wider text-amber-200">adjustable</Badge>
                   </div>
                   <p className="mt-1 max-w-xl text-[11px] leading-5 text-white/55">
                     After a losing settlement, the next user-started run can increase its stake. The max stake and risk cap always bound the plan.
                   </p>
                 </div>
                 <Switch
                   id="bot-martingale"
                   checked={martingaleEnabled}
                   onCheckedChange={setMartingaleEnabled}
                   disabled={isRecovery}
                   aria-label="Enable Martingale progression"
                 />
               </div>
               <div className="mt-3 grid gap-3 sm:grid-cols-3">
                 <div className="space-y-1.5">
                   <Label htmlFor="bot-martingale-multiplier" className="text-[11px] text-white/65">Loss multiplier</Label>
                   <Input id="bot-martingale-multiplier" type="number" min="1" max="5" step="0.1" value={martingaleMultiplier} onChange={e => setMartingaleMultiplier(e.target.value)} disabled={isRecovery || !martingaleEnabled} className="border-amber-500/35 bg-[#06110f] font-mono text-white" />
                   {errors.martingaleMultiplier && <p className="text-[10px] text-destructive">{errors.martingaleMultiplier}</p>}
                 </div>
                 <div className="space-y-1.5">
                   <Label htmlFor="bot-martingale-max" className="text-[11px] text-white/65">Maximum stake</Label>
                   <Input id="bot-martingale-max" type="number" min="0.01" step="0.01" value={martingaleMaxStake} onChange={e => setMartingaleMaxStake(e.target.value)} disabled={isRecovery || !martingaleEnabled} className="border-amber-500/35 bg-[#06110f] font-mono text-white" />
                   {errors.martingaleMaxStake && <p className="text-[10px] text-destructive">{errors.martingaleMaxStake}</p>}
                 </div>
                 <div className="space-y-1.5">
                   <Label htmlFor="bot-loss-limit" className="text-[11px] text-white/65">Stop after losses</Label>
                   <Input id="bot-loss-limit" type="number" min="1" max="10" step="1" value={consecutiveLossLimit} onChange={e => setConsecutiveLossLimit(e.target.value)} disabled={isRecovery} className="border-amber-500/35 bg-[#06110f] font-mono text-white" />
                   {errors.consecutiveLossLimit && <p className="text-[10px] text-destructive">{errors.consecutiveLossLimit}</p>}
                 </div>
               </div>
               <p className="mt-2 text-[10px] uppercase tracking-[.12em] text-amber-200/65">
                 {isRecovery ? "Recovery Bot: progression and execution controls are disabled" : martingaleEnabled ? `Enabled · up to ${martingaleMaxStake || "—"} per run · stops at ${consecutiveLossLimit || "—"} consecutive losses` : `Off · session still stops at ${consecutiveLossLimit || "—"} consecutive losses`}
               </p>
             </div>
            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Stop loss · {accountCurrency || "account"}</Label>
                <Input type="number" min="0.01" step="0.01" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={isRecovery} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.stopLoss && <p className="text-xs text-destructive">{errors.stopLoss}</p>}
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Ticks before expiry</Label>
              <div className="grid grid-cols-4 gap-2">
                  {["1", "2", "3", "5"].map(ticks => <Button key={ticks} type="button" size="sm" variant={duration === ticks ? "default" : "outline"} className={duration === ticks ? "bg-[#159e98] text-white hover:bg-[#12847f]" : "border-[#1a6662] bg-[#06110f] text-white/70 hover:bg-[#0b211f] hover:text-white"} onClick={() => setDuration(ticks)} disabled={isRecovery}>{ticks}</Button>)}
              </div>
                <Input type="number" min="1" max="10" step="1" value={duration} onChange={e => setDuration(e.target.value)} disabled={isRecovery} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.duration && <p className="text-xs text-destructive">{errors.duration}</p>}
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Runs before stop</Label>
                <Input type="number" min="1" max="10" step="1" value={runCount} onChange={e => setRunCount(e.target.value)} disabled={isRecovery} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
              {errors.runCount && <p className="text-xs text-destructive">{errors.runCount}</p>}
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-medium text-[#a5f3ec]">Take profit · stop session · {accountCurrency || "account"}</Label>
                <Input type="number" min="0.01" step="0.01" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} disabled={isRecovery} className="border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
                 <p className="text-xs text-white/40">{isRecovery ? "Not used: Recovery Bot only monitors." : "Stops the bounded session after cumulative net profit reaches this target."}</p>
              {errors.takeProfit && <p className="text-xs text-destructive">{errors.takeProfit}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
               <Label className="text-xs font-medium text-[#a5f3ec]">Risk cap · max loss</Label>
                <Input type="number" step="1" value={riskCap} onChange={e => setRiskCap(e.target.value)} disabled={isRecovery} className="max-w-[50%] border-[#159e98] bg-[#06110f] font-numeric text-white shadow-[0_0_0_1px_rgba(21,158,152,.12)]" />
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
              <Button type="button" onClick={onRun} disabled={saving || isRecovery} className="bg-[#16a34a] text-white shadow-[0_0_18px_rgba(22,163,74,.2)] hover:bg-[#12843c]">
                <Play className="mr-2 h-4 w-4" /> {isRecovery ? "Monitor-only · no launch" : "Launch Bot"}
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
  const [showDetails, setShowDetails] = useState(false);
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
             <Button type="button" size="sm" variant="outline" disabled={!runRows.length} className="h-8 text-xs" onClick={() => setShowDetails(value => !value)}>
               <FileText className="mr-2 h-3.5 w-3.5" />{showDetails ? "Hide detail" : "View detail"}
            </Button>
          </div>
        </CardHeader>
         <CardContent className="p-0">
           {showDetails && runRows.length > 0 && (
             <pre className="max-h-56 overflow-auto border-b bg-[#071511] p-4 font-mono text-[10px] leading-5 text-[#a5f3ec]">{JSON.stringify(runRows, null, 2)}</pre>
           )}
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
function LibraryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-5 text-center">
      <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
      <div className="mt-2 text-sm font-semibold">Bot library unavailable</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">The saved experiences could not be loaded. Nothing was started.</p>
      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onRetry}>Retry library</Button>
    </div>
  )
}
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

function sourceBotName(template: any) {
  return template.botNumber === 1 ? "Vertex Bot" : template.botNumber === 2 ? "Recovery Bot" : template.name ?? "Free Bot"
}
