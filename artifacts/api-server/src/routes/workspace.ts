import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { and, desc, eq, isNull } from "drizzle-orm";
import WebSocket, { type RawData } from "ws";
import { z } from "zod/v4";
import {
  analyses, botEvents, botRuns, bots, botTemplates, db, recoveryIncidents,
  riskAcknowledgements, snapshots,
} from "@workspace/db";
import { derivRequest, getSession, listDerivAccounts } from "./protraders";

const router = Router();
const RISK_VERSION = "2025-01";
const marketCache = new Map<string, { expiresAt: number; value: unknown }>();
const advisorySchema = z.object({
  summary: z.string().min(1).max(800),
  observations: z.array(z.string().min(1).max(240)).max(6),
  safeNextSteps: z.array(z.enum(["review_logs", "pause_and_review", "contact_support", "refresh_account_data", "run_dry_run"])).max(5),
  limitations: z.string().min(1).max(500),
}).strict();
const scannerSchema = z.object({
  summary: z.string().min(1).max(500),
  bias: z.enum(["bullish", "bearish", "neutral"]),
  observations: z.array(z.string().min(1).max(220)).min(1).max(5),
  limitations: z.string().min(1).max(400),
}).strict();
const uuidSchema = z.string().uuid();
const dryRunStrategySchema = z.object({
  indicator: z.enum(["ema", "rsi", "macd"]),
  direction: z.enum(["CALL", "PUT", "BOTH"]),
  mode: z.enum(["market_observer", "recovery_guard"]).optional(),
  contractType: z.enum(["CALL", "PUT", "DIGITOVER", "DIGITUNDER", "DIGITEVEN", "DIGITODD"]).optional(),
  barrier: z.string().regex(/^[0-9]$/).optional(),
  stopLoss: z.number().gt(0).max(10_000).optional(),
  runCount: z.number().int().min(1).max(10).optional(),
  takeProfit: z.number().gt(0).max(100_000).optional(),
  stake: z.number().gt(0),
  duration: z.number().int().gt(0).max(3_600),
  riskCap: z.number().gt(0).max(100_000),
  notes: z.string().max(1_000).optional(),
  execution: z.literal("dry_run"),
}).strict();
const builtIns = [
  { id: "protraders-bot-1-free-observer", botNumber: 1, name: "Bot 1 · Free Market Observer", description: "A no-cost starter bot that reviews current candles with transparent indicators and records a dry-run result without placing an order.", strategy: { indicator: "ema", direction: "BOTH", mode: "market_observer", stake: 1, duration: 5, riskCap: 10, notes: "Observe EMA direction from current market candles. Review the result; it is not a prediction or performance claim.", execution: "dry_run" } },
  { id: "protraders-bot-2-recovery-monitor", botNumber: 2, name: "Bot 2 · Recovery Monitor", description: "A recovery-focused monitor that checks account readiness, market freshness, and recent dry-run issues before returning monitor-or-pause guidance.", strategy: { indicator: "rsi", direction: "BOTH", mode: "recovery_guard", stake: 1, duration: 5, riskCap: 5, notes: "Recovery monitoring only. Pause and review when data is stale or an issue is found. Never increase stake, retry an order, or place a trade.", execution: "dry_run" } },
  { id: "trend-following", name: "Trend following", description: "Uses transparent moving-average direction for controlled account-connected review; it makes no performance claim.", strategy: { indicator: "ema", direction: "BOTH", stake: 1, duration: 5, riskCap: 10, notes: "Review EMA direction using current market candles.", execution: "dry_run" } },
  { id: "rsi-observer", name: "RSI observer", description: "Flags RSI extremes for review; it does not predict prices or promise returns.", strategy: { indicator: "rsi", direction: "BOTH", stake: 1, duration: 5, riskCap: 10, notes: "Review RSI extremes without placing an order.", execution: "dry_run" } },
  { id: "recovery-guard", name: "Recovery Guard", description: "Checks current account and market freshness plus recent failed dry-runs, then returns a bounded monitor-or-pause review state.", strategy: { indicator: "rsi", direction: "BOTH", mode: "recovery_guard", stake: 1, duration: 5, riskCap: 5, notes: "If account or market data is stale, or a prior dry-run failed, pause and review logs. Never increase stake or retry an order.", execution: "dry_run" } },
];

const standardVolatilityLevels = [10, 25, 50, 75, 100];
const oneSecondVolatilityLevels = standardVolatilityLevels;
const configuredVolatilitySymbols = [
  ...standardVolatilityLevels.map((level) => ({
    symbol: `R_${level}`,
    displayName: `Volatility ${level} Index`,
    market: "synthetic_index",
    marketDisplayName: "Derived",
    submarket: "random_index",
    submarketDisplayName: "Continuous Indices",
    exchangeIsOpen: true,
    discovered: false,
  })),
  ...oneSecondVolatilityLevels.map((level) => ({
    symbol: `1HZ${level}V`,
    displayName: `Volatility ${level} (1s) Index`,
    market: "synthetic_index",
    marketDisplayName: "Derived",
    submarket: "random_index",
    submarketDisplayName: "1-second Volatility Indices",
    exchangeIsOpen: true,
    discovered: false,
  })),
];

function fail(res: Response, status: number, error: string, message?: string) {
  return res.status(status).json({ error, ...(message ? { message } : {}) });
}
router.use("/market", rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false }));
async function cachedMarket<T>(key: string, loader: () => Promise<T>) {
  const current = marketCache.get(key);
  if (current && current.expiresAt > Date.now()) return current.value as T;
  const value = await loader();
  marketCache.set(key, { value, expiresAt: Date.now() + 10_000 });
  if (marketCache.size > 200) marketCache.delete(marketCache.keys().next().value!);
  return value;
}
function string(value: unknown, maximum = 160) {
  return typeof value === "string" && value.trim() && value.length <= maximum ? value.trim() : null;
}
async function owner(req: Request, res: Response) {
  const session = await getSession(req, res);
  if (!session) return null;
  const accounts = await listDerivAccounts(session.accessToken);
  const account = accounts.find((item) => item.account_id === session.accountId) ||
    accounts.find((item) => item.account_type === "demo") ||
    accounts.find((item) => item.status === "active") ||
    accounts[0];
  const loginId = String(account?.account_id || "");
  if (!loginId) throw new Error("Authenticated Deriv login ID unavailable");
  return { session, key: crypto.createHash("sha256").update(`protraders-owner:${loginId}`).digest("hex") };
}
async function authenticated(req: Request, res: Response) {
  try {
    const identity = await owner(req, res);
    if (!identity) {
      fail(res, 401, "Not authenticated");
      return null;
    }
    return identity;
  } catch (error) {
    req.log?.warn({ err: error }, "workspace identity lookup failed");
    fail(res, 502, "Account identity unavailable");
    return null;
  }
}
function publicDerivOnce(payload: Record<string, unknown>, appId: string) {
  return new Promise<any>((resolve, reject) => {
    const socket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`);
    let done = false;
    const finish = (fn: (v: any) => void, value: any) => { if (!done) { done = true; clearTimeout(timeout); socket.close(); fn(value); } };
    const timeout = setTimeout(() => finish(reject, new Error("Deriv public market request timeout")), 10_000);
    socket.on("open", () => socket.send(JSON.stringify(payload)));
    socket.on("message", (raw: RawData) => { try { const data = JSON.parse(raw.toString()); data.error ? finish(reject, new Error(data.error.message || "Deriv API error")) : finish(resolve, data); } catch { finish(reject, new Error("Invalid Deriv market response")); } });
    socket.on("error", (error) => finish(reject, error));
  });
}
async function publicDeriv(payload: Record<string, unknown>) {
  const appIds = [...new Set([
    process.env.DERIV_PUBLIC_APP_ID,
    "1089",
  ].filter((value): value is string => Boolean(value)))];
  let lastError: unknown;
  for (const appId of appIds) {
    try {
      return await publicDerivOnce(payload, appId);
    } catch (error) {
      lastError = error;
      if (!/(401|invalid.?app.?id|unexpected server response)/i.test(error instanceof Error ? error.message : String(error))) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Deriv public WebSocket app ID rejected");
}
function metrics(candles: Array<{ epoch: number; close: number }>) {
  const closes = candles.map((c) => c.close);
  const sma = (n: number) => closes.slice(-n).reduce((a, b) => a + b, 0) / n;
  const ema = (n: number) => {
    const values = closes.slice(-Math.max(n, 50));
    let value = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const multiplier = 2 / (n + 1);
    for (const close of values.slice(n)) value = (close - value) * multiplier + value;
    return value;
  };
  const period = 14; let gains = 0; let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) { const delta = closes[i] - closes[i - 1]; if (delta >= 0) gains += delta; else losses -= delta; }
  const rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
  const fast = ema(9), slow = ema(21);
  const emaSeries = (period: number) => { let value = closes.slice(0, period).reduce((a, b) => a + b, 0) / period; const series = [value], multiplier = 2 / (period + 1); for (const close of closes.slice(period)) { value = (close - value) * multiplier + value; series.push(value); } return series; };
  const fastSeries = emaSeries(12), slowSeries = emaSeries(26);
  const macdSeries = slowSeries.map((value, index) => fastSeries[index + 14] - value);
  let signal = macdSeries.slice(0, 9).reduce((a, b) => a + b, 0) / 9; for (const value of macdSeries.slice(9)) signal = (value - signal) * 0.2 + signal;
  const macd = macdSeries.at(-1)!;
  const returns = closes.slice(1).map((close, index) => (close - closes[index]) / closes[index]).filter(Number.isFinite);
  const meanReturn = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
  const variance = returns.reduce((sum, value) => sum + ((value - meanReturn) ** 2), 0) / Math.max(returns.length, 1);
  const volatilityPct = Math.sqrt(variance) * 100;
  const volatilityLevel = volatilityPct >= 0.45 ? "high" : volatilityPct >= 0.18 ? "medium" : "low";
  return {
    sma20: sma(20),
    ema9: fast,
    ema21: slow,
    rsi14: rsi,
    macd,
    macdSignal: signal,
    macdHistogram: macd - signal,
    trend: fast > slow ? "up" : fast < slow ? "down" : "flat",
    volatilityPct,
    volatilityLevel,
  };
}

function isVolatilitySymbol(symbol: string) {
  return /^R_(10|25|50|75|100)$/.test(symbol)
    || /^1HZ(10|25|50|75|100)V$/.test(symbol);
}

async function scanVolatilityMarket(symbol: string) {
  try {
    const data = await cachedMarket(`scan:${symbol}`, () => publicDeriv({ ticks_history: symbol, style: "candles", granularity: 60, count: 60, end: "latest" }));
    const candles = Array.isArray((data as any).candles)
      ? (data as any).candles.map((c: any) => ({ epoch: Number(c.epoch), close: Number(c.close) })).filter((c: any) => Number.isFinite(c.epoch) && Number.isFinite(c.close))
      : [];
    if (candles.length < 30) return null;
    const indicators = metrics(candles);
    const latestEpoch = candles.at(-1)!.epoch;
    const freshnessSeconds = Math.max(0, Math.floor(Date.now() / 1000 - latestEpoch));
    if (freshnessSeconds > 600) return null;
    let signalCount = 0;
    let signalWins = 0;
    for (let index = 29; index < candles.length - 1; index += 1) {
      const historical = metrics(candles.slice(0, index + 1));
      const direction = historical.trend === "up" && historical.macdHistogram > 0
        ? "up"
        : historical.trend === "down" && historical.macdHistogram < 0
          ? "down"
          : null;
      const nextMove = candles[index + 1].close - candles[index].close;
      if (!direction || nextMove === 0) continue;
      signalCount += 1;
      if ((direction === "up" && nextMove > 0) || (direction === "down" && nextMove < 0)) signalWins += 1;
    }
    const observedSignalWinRate = signalCount >= 10 ? Number(((signalWins / signalCount) * 100).toFixed(1)) : null;
    const bias = indicators.trend === "up" && indicators.macdHistogram > 0
      ? "bullish"
      : indicators.trend === "down" && indicators.macdHistogram < 0
        ? "bearish"
        : "neutral";
    const directionalAgreement = bias === "neutral" ? 0 : 1;
    const score = Math.round(Math.min(100, Math.max(0,
      50 + Math.min(25, Math.abs(indicators.macdHistogram) / Math.max(Math.abs(indicators.ema21), 1) * 10000)
      + directionalAgreement * 15
      + Math.min(10, Math.max(0, (600 - freshnessSeconds) / 60)),
    )));
    return {
      symbol,
      bias,
      score,
      observedSignalWinRate,
      signalSampleSize: signalCount,
      freshnessSeconds,
      asOf: new Date(latestEpoch * 1000).toISOString(),
      indicators: {
        trend: indicators.trend,
        rsi14: indicators.rsi14,
        macdHistogram: indicators.macdHistogram,
        volatilityPct: indicators.volatilityPct,
        volatilityLevel: indicators.volatilityLevel,
      },
       disclaimer: "Historical signal hit rate is a one-step candle backtest from recent Deriv candles, not a Deriv win rate, prediction, recommendation, or guarantee of profit.",
    };
  } catch {
    return null;
  }
}

router.get("/market/symbols", async (_req, res) => {
  try {
    const body = await cachedMarket("symbols", async () => {
      const data = await publicDeriv({ active_symbols: "full" });
      const providerSymbols = (data.active_symbols || []).map((s: any) => ({
        symbol: s.symbol,
        displayName: s.display_name,
        market: s.market,
        marketDisplayName: s.market_display_name,
        submarket: s.submarket,
        submarketDisplayName: s.submarket_display_name,
        exchangeIsOpen: s.exchange_is_open !== 0,
        pip: s.pip,
        discovered: true,
      })).filter((item: any) => typeof item.symbol === "string" && isVolatilitySymbol(item.symbol));
      if (!providerSymbols.length) {
        return {
          symbols: configuredVolatilitySymbols,
          source: "configured-volatility-catalog",
          discoveryAvailable: false,
          message: "Deriv active-symbol discovery returned no rows. Quotes, candles, contracts, and orders remain provider-validated per symbol.",
        };
      }
      return { symbols: providerSymbols, source: "deriv-active-symbols", discoveryAvailable: true };
    });
    return res.json(body);
  } catch (e) {
    return fail(res, 502, "Market symbols unavailable", e instanceof Error ? e.message : undefined);
  }
});
router.get("/market/contracts/:symbol", async (req, res) => {
  const symbol = string(req.params.symbol, 30);
  if (!symbol || !isVolatilitySymbol(symbol)) return fail(res, 400, "Choose a supported Volatility 10–100 market");
  try {
    const body = await cachedMarket(`contracts:${symbol}`, async () => {
      const session = await getSession(req, res);
      if (!session) throw new Error("Connect a Deriv account to check trading types.");
      const data = await derivRequest(session.accessToken, { contracts_for: symbol }, session.accountId);
      const available = Array.isArray(data.contracts_for?.available) ? data.contracts_for.available : [];
      const supported = new Set(["CALL", "PUT", "DIGITOVER", "DIGITUNDER", "DIGITEVEN", "DIGITODD"]);
      const contracts = available
        .filter((item: any) => supported.has(String(item.contract_type)))
        .map((item: any) => ({
          contractType: String(item.contract_type),
          contractDisplay: item.contract_display || item.contract_type,
          category: item.contract_category || null,
          categoryDisplay: item.contract_category_display || null,
          barrierCategory: item.barrier_category || null,
          barriers: Number.isInteger(Number(item.barriers)) ? Number(item.barriers) : null,
          minContractDuration: item.min_contract_duration || null,
          maxContractDuration: item.max_contract_duration || null,
        }));
      return {
        symbol,
        contracts,
        availableContractTypes: [...new Set(contracts.map((item: any) => item.contractType))],
        source: "authenticated-deriv-contracts-for",
      };
    });
    return res.json(body);
  } catch (error) {
    return fail(res, 502, "Contract availability unavailable", error instanceof Error ? error.message : undefined);
  }
});
router.get("/market/ticker/:symbol", async (req, res) => {
  const symbol = string(req.params.symbol, 30);
  const isConversionQuote = symbol === "frxUSDKES";
  if (!symbol || (!isVolatilitySymbol(symbol) && !isConversionQuote)) return fail(res, 400, "Choose a supported Volatility 10–100 market");
  try { const body = await cachedMarket(`ticker:${symbol}`, async () => {
    const data = await publicDeriv({ ticks_history: symbol, style: "ticks", count: 1, end: "latest" });
    const quote = Number(data.history?.prices?.at?.(-1));
    const epoch = Number(data.history?.times?.at?.(-1));
    if (!Number.isFinite(quote) || !Number.isFinite(epoch)) throw new Error("Invalid ticker response");
    return { symbol, quote, epoch, pipSize: null, source: "latest-history-tick", available: true };
  }); return res.json(body); }
  catch {
    return res.json({ symbol, quote: null, epoch: null, pipSize: null, source: "deriv", available: false });
  }
});
router.get("/market/candles/:symbol", async (req, res) => {
  const symbol = string(req.params.symbol, 30), granularity = Number(req.query.granularity || 300), count = Number(req.query.count || 100);
  if (!symbol || !isVolatilitySymbol(symbol) || ![60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400].includes(granularity) || !Number.isInteger(count) || count < 30 || count > 500) return fail(res, 400, "Invalid candle parameters");
  try { return res.json(await cachedMarket(`candles:${symbol}:${granularity}:${count}`, async () => {
    const data = await publicDeriv({ ticks_history: symbol, style: "candles", granularity, count, end: "latest" });
    const rows = Array.isArray(data.candles) ? data.candles.map((c: any) => ({ epoch: Number(c.epoch), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) })).filter((c: any) => Object.values(c).every(Number.isFinite)) : [];
    if (rows.length < 30) throw new Error("Insufficient valid candle data");
    const latest = rows.at(-1)!; const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000 - latest.epoch));
    return { symbol, granularity, candles: rows, indicators: metrics(rows), asOf: new Date(latest.epoch * 1000).toISOString(), freshnessSeconds: ageSeconds, confidence: ageSeconds <= granularity * 2 ? "data-current" : "data-delayed", disclaimer: "Indicators are deterministic descriptions of observed candles, not advice or a promise of any outcome." };
  }));
  } catch (e) { return fail(res, 502, "Candle data unavailable", e instanceof Error ? e.message : undefined); }
});

router.post("/market/analyze", async (req, res) => {
  const auth = await authenticated(req, res);
  if (!auth) return;
  const symbol = string(req.body?.symbol, 30);
  if (!symbol || !isVolatilitySymbol(symbol)) return fail(res, 400, "Choose a supported Volatility 10–100 market");
  try {
    const data = await publicDeriv({ ticks_history: symbol, style: "candles", granularity: 60, count: 60, end: "latest" });
    const candles = Array.isArray(data.candles)
      ? data.candles.map((c: any) => ({ epoch: Number(c.epoch), close: Number(c.close) })).filter((c: any) => Number.isFinite(c.epoch) && Number.isFinite(c.close))
      : [];
    if (candles.length < 30) return fail(res, 503, "Scanner data unavailable", "Deriv did not return enough current candles.");
    const indicators = metrics(candles);
    const deterministicBias: z.infer<typeof scannerSchema>["bias"] = indicators.trend === "up" && indicators.macdHistogram > 0
      ? "bullish"
      : indicators.trend === "down" && indicators.macdHistogram < 0
        ? "bearish"
        : "neutral";
    const deterministic = {
      summary: `${symbol} currently has a ${indicators.trend} EMA structure with RSI ${indicators.rsi14.toFixed(1)}.`,
      bias: deterministicBias,
      observations: [
        `EMA 9 is ${indicators.ema9 > indicators.ema21 ? "above" : indicators.ema9 < indicators.ema21 ? "below" : "equal to"} EMA 21.`,
        `RSI 14 is ${indicators.rsi14.toFixed(1)}.`,
       `MACD histogram is ${indicators.macdHistogram.toFixed(5)}.`,
       `Observed candle volatility is ${indicators.volatilityPct.toFixed(3)}% (${indicators.volatilityLevel}).`,
      ],
      limitations: "This describes recent candles only. It is not a prediction, recommendation, or permission to trade.",
    };
    let explanation: z.infer<typeof scannerSchema> = deterministic;
    let source = "deterministic";
    if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      try {
        const { openai } = await import("@workspace/integrations-openai-ai-server");
        const completion = await openai.chat.completions.create({
          model: "gpt-5.6-luna",
          max_completion_tokens: 500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Return JSON only with summary, bias (bullish|bearish|neutral), observations array, and limitations. Explain supplied indicators conservatively. No trade instructions, promises, stake suggestions, or price predictions." },
            { role: "user", content: JSON.stringify({ symbol, indicators, candleCount: candles.length }) },
          ],
        });
        explanation = scannerSchema.parse(JSON.parse(completion.choices[0]?.message?.content || "{}"));
        source = "ai-advisory";
      } catch (error) {
        req.log?.warn({ err: error }, "scanner AI explanation unavailable");
      }
    }
    return res.json({
      symbol,
      asOf: new Date(candles.at(-1)!.epoch * 1000).toISOString(),
      indicators,
      analysis: explanation,
      source,
      advisoryOnly: true,
    });
  } catch (error) {
    return fail(res, 503, "Scanner unavailable", error instanceof Error ? error.message : undefined);
  }
});

router.post("/market/scan-best", async (req, res) => {
  const auth = await authenticated(req, res);
  if (!auth) return;
  try {
    const symbolsBody = await cachedMarket("symbols", async () => {
      const data = await publicDeriv({ active_symbols: "full" });
      const providerSymbols = (data.active_symbols || []).map((s: any) => ({
        symbol: s.symbol,
        displayName: s.display_name,
        market: s.market,
        marketDisplayName: s.market_display_name,
        submarket: s.submarket,
        submarketDisplayName: s.submarket_display_name,
        exchangeIsOpen: s.exchange_is_open !== 0,
        pip: s.pip,
        discovered: true,
      })).filter((item: any) => typeof item.symbol === "string" && isVolatilitySymbol(item.symbol));
      return providerSymbols.length
        ? { symbols: providerSymbols, source: "deriv-active-symbols", discoveryAvailable: true }
        : { symbols: configuredVolatilitySymbols, source: "configured-volatility-catalog", discoveryAvailable: false };
    });
    const candidates = (symbolsBody.symbols || []).filter((item: any) => isVolatilitySymbol(String(item.symbol)));
    const results: any[] = [];
    for (let offset = 0; offset < candidates.length; offset += 4) {
      const batch = await Promise.all(candidates.slice(offset, offset + 4).map((item: any) => scanVolatilityMarket(String(item.symbol))));
      batch.forEach((result, index) => {
        if (result) results.push({ ...result, displayName: candidates[offset + index].displayName || result.symbol });
      });
    }
    const ranked = results.filter((item) => item.observedSignalWinRate !== null);
    ranked.sort((a, b) => b.observedSignalWinRate - a.observedSignalWinRate || b.signalSampleSize - a.signalSampleSize || a.freshnessSeconds - b.freshnessSeconds);
    return res.json({
      source: "deriv-candles",
      scannedCount: candidates.length,
      availableCount: ranked.length,
      best: ranked[0] || null,
      markets: ranked,
      disclaimer: ranked.length
        ? "The selected market has the highest observed historical signal hit rate in this scan. This is not a Deriv win rate, a prediction, recommendation, or guarantee of profit."
        : "No market had enough non-neutral historical signals to calculate an observed hit rate.",
    });
  } catch (error) {
    return fail(res, 503, "Best-market scan unavailable", error instanceof Error ? error.message : undefined);
  }
});

router.get("/templates", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const custom = await db.select().from(botTemplates).where(and(eq(botTemplates.ownerKey, auth.key), isNull(botTemplates.archivedAt))).orderBy(desc(botTemplates.createdAt)); return res.json({ builtIn: builtIns, templates: custom }); });
router.post("/templates", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const name = string(req.body?.name), description = string(req.body?.description, 1000), strategy = dryRunStrategySchema.safeParse(req.body?.strategy); if (!name || !description || !strategy.success) return fail(res, 400, "Invalid template"); const [item] = await db.insert(botTemplates).values({ ownerKey: auth.key, name, description, strategy: strategy.data }).returning(); return res.status(201).json(item); });
router.patch("/templates/:id", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const name = req.body?.name === undefined ? undefined : string(req.body.name), description = req.body?.description === undefined ? undefined : string(req.body.description, 1000); const strategy = req.body?.strategy === undefined ? undefined : dryRunStrategySchema.safeParse(req.body.strategy); if ((req.body?.name !== undefined && !name) || (req.body?.description !== undefined && !description) || (strategy && !strategy.success)) return fail(res, 400, "Invalid template"); const [item] = await db.update(botTemplates).set({ ...(name ? { name } : {}), ...(description ? { description } : {}), ...(strategy?.success ? { strategy: strategy.data } : {}), updatedAt: new Date() }).where(and(eq(botTemplates.id, req.params.id), eq(botTemplates.ownerKey, auth.key))).returning(); return item ? res.json(item) : fail(res, 404, "Template not found"); });
router.post("/templates/:id/archive", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const [item] = await db.update(botTemplates).set({ archivedAt: new Date(), updatedAt: new Date() }).where(and(eq(botTemplates.id, req.params.id), eq(botTemplates.ownerKey, auth.key))).returning(); return item ? res.json(item) : fail(res, 404, "Template not found"); });

router.get("/bots", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; return res.json({ bots: await db.select().from(bots).where(and(eq(bots.ownerKey, auth.key), isNull(bots.archivedAt))).orderBy(desc(bots.createdAt)) }); });
router.post("/bots", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const name = string(req.body?.name), symbol = string(req.body?.symbol, 30); const parsed = dryRunStrategySchema.safeParse(req.body?.config); if (!name || !symbol || !isVolatilitySymbol(symbol) || !parsed.success) return fail(res, 400, "Invalid bot dry-run strategy"); let templateId: string | null = null; if (req.body?.templateId !== undefined && req.body.templateId !== null && req.body.templateId !== "") { if (!uuidSchema.safeParse(req.body.templateId).success) return fail(res, 400, "Invalid template ID"); const [template] = await db.select({ id: botTemplates.id }).from(botTemplates).where(and(eq(botTemplates.id, req.body.templateId), eq(botTemplates.ownerKey, auth.key), isNull(botTemplates.archivedAt))).limit(1); if (!template) return fail(res, 404, "Template not found"); templateId = template.id; } const [bot] = await db.insert(bots).values({ ownerKey: auth.key, name, symbol, config: parsed.data, templateId }).returning(); return res.status(201).json(bot); });
router.patch("/bots/:id", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const name = req.body?.name === undefined ? undefined : string(req.body.name); const symbol = req.body?.symbol === undefined ? undefined : string(req.body.symbol, 30); const config = req.body?.config === undefined ? undefined : dryRunStrategySchema.safeParse(req.body.config); if ((req.body?.name !== undefined && !name) || (req.body?.symbol !== undefined && (!symbol || !isVolatilitySymbol(symbol))) || (config && !config.success)) return fail(res, 400, "Invalid bot update"); const [bot] = await db.update(bots).set({ ...(name ? { name } : {}), ...(symbol ? { symbol } : {}), ...(config?.success ? { config: config.data } : {}), updatedAt: new Date() }).where(and(eq(bots.id, req.params.id), eq(bots.ownerKey, auth.key))).returning(); return bot ? res.json(bot) : fail(res, 404, "Bot not found"); });
router.get("/bots/:id/runs", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const botId = String(req.params.id); const [bot] = await db.select({ id: bots.id }).from(bots).where(and(eq(bots.id, botId), eq(bots.ownerKey, auth.key))).limit(1); if (!bot) return fail(res, 404, "Bot not found"); const runs = await db.select().from(botRuns).where(and(eq(botRuns.botId, bot.id), eq(botRuns.ownerKey, auth.key))).orderBy(desc(botRuns.startedAt)); return res.json({ botId: bot.id, runs, trading: { enabled: process.env.TRADING_ENABLED === "true", liveEnabled: process.env.TRADING_LIVE_ENABLED === "true", demoOnly: process.env.TRADING_DEMO_ONLY !== "false" } }); });
router.post(["/bots/:id/start", "/bots/:id/pause", "/bots/:id/stop", "/bots/:id/archive"], async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const action = req.path.split("/").at(-1)!; const [current] = await db.select().from(bots).where(and(eq(bots.id, String(req.params.id)), eq(bots.ownerKey, auth.key))).limit(1); if (!current) return fail(res, 404, "Bot not found"); const transitions: Record<string, string[]> = { start: ["draft", "paused", "stopped"], pause: ["observing"], stop: ["draft", "observing", "paused"], archive: ["draft", "observing", "paused", "stopped"] }; if (!transitions[action]?.includes(current.status)) return fail(res, 409, "Invalid bot lifecycle transition", `Cannot ${action} a ${current.status} bot.`); const status = action === "start" ? "observing" : action === "pause" ? "paused" : action === "stop" ? "stopped" : "archived"; const [bot] = await db.update(bots).set({ status, ...(action === "archive" ? { archivedAt: new Date() } : {}), updatedAt: new Date() }).where(and(eq(bots.id, current.id), eq(bots.ownerKey, auth.key))).returning(); await db.insert(botEvents).values({ ownerKey: auth.key, botId: bot.id, type: `lifecycle.${action}`, payload: { status } }); return res.json({ bot, capability: action === "start" ? "observation_only" : "state_persisted", note: action === "start" ? "This deployment has no long-running autonomous worker. Use run-once for a persisted dry-run evaluation." : "Vercel does not provide a long-running bot worker." }); });
router.post("/bots/:id/run-once", async (req, res) => {
  const auth = await authenticated(req, res);
  if (!auth) return;
  const [bot] = await db.select().from(bots).where(and(eq(bots.id, req.params.id), eq(bots.ownerKey, auth.key)));
  if (!bot) return fail(res, 404, "Bot not found");
  if (bot.status === "archived") return fail(res, 409, "Archived bot cannot run");
  if (!isVolatilitySymbol(bot.symbol)) return fail(res, 409, "Update this bot to a supported Volatility 10–100 market before running it");
  const strategy = dryRunStrategySchema.safeParse(bot.config);
  if (!strategy.success) return fail(res, 409, "Bot strategy is invalid");
  const [run] = await db.insert(botRuns).values({ ownerKey: auth.key, botId: bot.id, mode: "dry_run", status: "running" }).returning();

  try {
    if (strategy.data.mode === "recovery_guard") {
      const [accounts, marketData, priorRuns] = await Promise.all([
        listDerivAccounts(auth.session.accessToken),
        publicDeriv({ ticks_history: bot.symbol, style: "candles", granularity: 60, count: 60, end: "latest" }),
        db.select({ status: botRuns.status, result: botRuns.result }).from(botRuns)
          .where(and(eq(botRuns.botId, bot.id), eq(botRuns.ownerKey, auth.key)))
          .orderBy(desc(botRuns.startedAt))
          .limit(6),
      ]);
      const account = accounts.find((item) => item.account_id === auth.session.accountId) ||
        accounts.find((item) => item.account_type === "demo") ||
        accounts.find((item) => item.status === "active") ||
        accounts[0];
      if (!account?.account_id || !Number.isFinite(Number(account.balance))) throw new Error("Authoritative account data unavailable");
      const candles = Array.isArray(marketData.candles)
        ? marketData.candles.map((c: any) => ({ epoch: Number(c.epoch), close: Number(c.close) })).filter((c: any) => Number.isFinite(c.epoch) && Number.isFinite(c.close))
        : [];
      if (candles.length < 30) throw new Error("Insufficient market data for recovery checks");
      const latestEpoch = candles.at(-1)!.epoch;
      const freshnessSeconds = Math.max(0, Math.floor(Date.now() / 1000 - latestEpoch));
      const marketFresh = freshnessSeconds <= 120;
      const priorIssues = priorRuns
        .slice(1)
        .filter((item) => item.status === "failed" || (item.result as any)?.recovery?.pauseRequired === true).length;
      const reasons = [
        ...(!marketFresh ? [`Market candles are ${freshnessSeconds}s old.`] : []),
        ...(priorIssues > 0 ? [`${priorIssues} recent recovery-relevant dry-run issue${priorIssues === 1 ? "" : "s"} found.`] : []),
      ];
      const pauseRequired = !marketFresh || priorIssues > 0;
      const recoveryResult = {
        action: pauseRequired ? "pause-and-review" : "monitor-and-review",
        recoveryMode: "recovery_guard",
        dryRun: true,
        advisoryOnly: true,
        checks: { accountVerified: true, marketFresh, freshnessSeconds, priorDryRunIssues: priorIssues },
        reasons: reasons.length ? reasons : ["No recovery trigger found in the current account and market checks."],
        nextSteps: pauseRequired ? ["pause_bot", "review_logs", "refresh_account_data"] : ["continue_observing", "review_logs"],
        exactInputs: { symbol: bot.symbol, riskCap: strategy.data.riskCap, execution: "dry_run" },
        disclaimer: "Recovery Guard only evaluates freshness and persisted dry-run context. It cannot place, retry, or resize an order.",
      };
      const [completed] = await db.update(botRuns).set({ status: "completed", result: recoveryResult, completedAt: new Date() }).where(eq(botRuns.id, run.id)).returning();
      await db.insert(botEvents).values({ ownerKey: auth.key, botId: bot.id, runId: run.id, type: "recovery.checked", payload: recoveryResult });
      return res.json(completed);
    }

    const data = await publicDeriv({ ticks_history: bot.symbol, style: "candles", granularity: 300, count: 60, end: "latest" });
    const candles = data.candles.map((c: any) => ({ epoch: Number(c.epoch), close: Number(c.close) })).filter((c: any) => Number.isFinite(c.epoch) && Number.isFinite(c.close));
    if (candles.length < 30) throw new Error("Insufficient candle data");
    const indicator = metrics(candles);
    const signal = strategy.data.indicator === "ema" ? indicator.trend === "up" ? "CALL" : indicator.trend === "down" ? "PUT" : null : strategy.data.indicator === "rsi" ? indicator.rsi14 < 30 ? "CALL" : indicator.rsi14 > 70 ? "PUT" : null : indicator.macd > indicator.macdSignal ? "CALL" : indicator.macd < indicator.macdSignal ? "PUT" : null;
    const allowed = signal && (strategy.data.direction === "BOTH" || strategy.data.direction === signal);
    const recommendation = { action: allowed ? `review-${signal.toLowerCase()}` : "no-action", dryRun: true, exactInputs: { symbol: bot.symbol, indicator: strategy.data.indicator, direction: strategy.data.direction, stake: strategy.data.stake, duration: strategy.data.duration, riskCap: strategy.data.riskCap, execution: "dry_run" }, simulationMetadata: ["stake", "duration", "riskCap"], indicators: indicator, disclaimer: "Dry-run only: no order was placed. Stake, duration, and risk cap are simulation metadata, not execution instructions." };
    const [completed] = await db.update(botRuns).set({ status: "completed", result: recommendation, completedAt: new Date() }).where(eq(botRuns.id, run.id)).returning();
    await db.insert(botEvents).values({ ownerKey: auth.key, botId: bot.id, runId: run.id, type: "run.evaluated", payload: recommendation });
    return res.json(completed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "evaluation failed";
    await db.update(botRuns).set({ status: "failed", result: { error: message, recovery: strategy.data.mode === "recovery_guard" ? { pauseRequired: true, advisoryOnly: true } : undefined }, completedAt: new Date() }).where(eq(botRuns.id, run.id));
    await db.insert(recoveryIncidents).values({ ownerKey: auth.key, botId: bot.id, title: strategy.data.mode === "recovery_guard" ? "Recovery Guard check failed" : "Bot dry-run evaluation failed", severity: "medium", facts: { runId: run.id, error: message } });
    return fail(res, 502, strategy.data.mode === "recovery_guard" ? "Recovery check unavailable" : "Bot evaluation unavailable", message);
  }
});

router.get("/snapshots", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; return res.json({ snapshots: await db.select().from(snapshots).where(eq(snapshots.ownerKey, auth.key)).orderBy(desc(snapshots.createdAt)) }); });
router.post("/snapshots", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const label = string(req.body?.label); if (!label) return fail(res, 400, "Invalid snapshot"); try { const accounts = await listDerivAccounts(auth.session.accessToken); const account = accounts.find((item) => item.account_id === auth.session.accountId) || accounts.find((item) => item.account_type === "demo") || accounts.find((item) => item.status === "active") || accounts[0]; if (!account?.account_id || !Number.isFinite(Number(account.balance))) return fail(res, 502, "Account snapshot unavailable"); const clientContext = req.body?.clientContext; if (clientContext !== undefined && (typeof clientContext !== "object" || Array.isArray(clientContext))) return fail(res, 400, "Invalid non-authoritative client context"); const data = { authoritativeAccount: { loginid: String(account.account_id), balance: Number(account.balance), currency: account.currency ?? null, capturedAt: new Date().toISOString() }, ...(clientContext ? { nonAuthoritativeClientContext: clientContext } : {}) }; const [item] = await db.insert(snapshots).values({ ownerKey: auth.key, label, data }).returning(); return res.status(201).json(item); } catch (e) { return fail(res, 502, "Account snapshot unavailable", e instanceof Error ? e.message : undefined); } });
router.get("/snapshots/:id", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const [item] = await db.select().from(snapshots).where(and(eq(snapshots.id, req.params.id), eq(snapshots.ownerKey, auth.key))); return item ? res.json(item) : fail(res, 404, "Snapshot not found"); });
router.get("/risk-acknowledgements/status", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const [item] = await db.select().from(riskAcknowledgements).where(and(eq(riskAcknowledgements.ownerKey, auth.key), eq(riskAcknowledgements.version, RISK_VERSION))).orderBy(desc(riskAcknowledgements.acceptedAt)); return res.json({ version: RISK_VERSION, accepted: Boolean(item), acceptedAt: item?.acceptedAt ?? null }); });
router.post("/risk-acknowledgements/accept", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const version = string(req.body?.version, 40); if (version !== RISK_VERSION) return fail(res, 400, "Unsupported risk acknowledgement version"); const [item] = await db.insert(riskAcknowledgements).values({ ownerKey: auth.key, version }).returning(); return res.status(201).json(item); });

router.get("/recovery-incidents", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; return res.json({ incidents: await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.ownerKey, auth.key)).orderBy(desc(recoveryIncidents.occurredAt)) }); });
router.post("/recovery-incidents", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const title = string(req.body?.title), severity = string(req.body?.severity, 20); const facts = req.body?.facts; if (!title || !["low", "medium", "high"].includes(severity || "") || !facts || typeof facts !== "object" || Array.isArray(facts)) return fail(res, 400, "Invalid incident report"); const [item] = await db.insert(recoveryIncidents).values({ ownerKey: auth.key, botId: typeof req.body?.botId === "string" ? req.body.botId : null, title, severity: severity!, facts }).returning(); return res.status(201).json(item); });
router.get("/recovery-incidents/:id", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const [item] = await db.select().from(recoveryIncidents).where(and(eq(recoveryIncidents.id, req.params.id), eq(recoveryIncidents.ownerKey, auth.key))); return item ? res.json(item) : fail(res, 404, "Incident not found"); });
router.post("/recovery-incidents/:id/analyze", async (req, res) => { const auth = await authenticated(req, res); if (!auth) return; const [incident] = await db.select().from(recoveryIncidents).where(and(eq(recoveryIncidents.id, req.params.id), eq(recoveryIncidents.ownerKey, auth.key))); if (!incident) return fail(res, 404, "Incident not found"); if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return fail(res, 503, "AI analysis unavailable", "The provisioned OpenAI integration is unavailable."); try { const { openai } = await import("@workspace/integrations-openai-ai-server"); const completion = await openai.chat.completions.create({ model: "gpt-5.6-luna", max_completion_tokens: 700, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return JSON only using safe action codes. Advisory only: no orders, transfers, or limit changes." }, { role: "user", content: JSON.stringify({ incident: { title: incident.title, severity: incident.severity, status: incident.status, facts: incident.facts }, accountScope: "authenticated Deriv account", botFacts: incident.botId }) }] }); const parsed = advisorySchema.parse(JSON.parse(completion.choices[0]?.message?.content || "{}")); const output = { ...parsed, advisoryOnly: true }; const [saved] = await db.insert(analyses).values({ ownerKey: auth.key, incidentId: incident.id, kind: "recovery_advisory", input: { incidentId: incident.id }, output }).returning(); return res.json({ analysis: saved, advisoryOnly: true }); } catch (e) { req.log?.warn({ err: e }, "recovery AI analysis failed"); return fail(res, 503, "AI analysis unavailable", "The advisory service did not return a valid response."); } });

export default router;