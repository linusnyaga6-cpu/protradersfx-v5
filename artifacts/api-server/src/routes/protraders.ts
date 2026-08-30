import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import WebSocket, { type RawData } from "ws";
import { and, desc, eq } from "drizzle-orm";
import { consumedTradeProposals, databaseConfigured, db, riskAcknowledgements, transactions } from "@workspace/db";
import { activitySummary, clientActivityTypes, recordActivity } from "../lib/activity-tracking";

type SessionValue = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  accountId?: string;
};

type DerivOptionsAccount = {
  account_id?: string;
  balance?: number;
  currency?: string;
  account_type?: "demo" | "real";
  status?: "active" | "inactive";
};

type OAuthState = {
  verifier: string;
  mode: "login" | "signup";
  nonce: string;
  issuedAt: number;
  targetAccount?: "demo" | "real";
};

const router = Router();
const isProduction = process.env.NODE_ENV === "production";
const baseUrl = (
  process.env.BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5000")
).replace(/\/+$/, "");
const redirectUri = `${baseUrl}/oauth/callback`;
const cookieSecure = isProduction ? true : baseUrl.startsWith("https://");
const sessionSecret = process.env.SESSION_SECRET || (
  isProduction ? "" : crypto.randomBytes(32).toString("hex")
);
const clientId = process.env.DERIV_CLIENT_ID || "";
const publicAppId = process.env.DERIV_PUBLIC_APP_ID || "";
const derivApiBaseUrl = "https://api.derivws.com";
const affiliateParam = process.env.DERIV_AFFILIATE_PARAM || "t";
const affiliateToken = process.env.DERIV_AFFILIATE_TOKEN || "";
const affiliateId = process.env.DERIV_AFFILIATE_ID || "";
const campaign = process.env.DERIV_CAMPAIGN || "protraders-fx";
const scope = process.env.DERIV_SCOPE || "trade account_manage";
const liveTradingEnabled = process.env.TRADING_LIVE_ENABLED === "true";
const demoOnly = process.env.TRADING_DEMO_ONLY !== "false";
// Demo execution is available by default; production stays demo-only unless the
// operator explicitly opts out or enables a reviewed live configuration.
const tradingEnabled = process.env.TRADING_ENABLED === "true"
  || (demoOnly && process.env.TRADING_ENABLED !== "false");
const frontendConfigured = process.env.FRONTEND_CONFIGURED !== "false";
const maxDuration = positiveInteger(process.env.TRADING_MAX_DURATION, 3600);
const riskAcknowledgementVersion = "2025-01";
const liveConfirmationToken = "CONFIRM_LIVE_TRADE";
const supportedContractTypes = new Set(["CALL", "PUT", "DIGITOVER", "DIGITUNDER", "DIGITEVEN", "DIGITODD"]);
const barrierContractTypes = new Set(["DIGITOVER", "DIGITUNDER"]);
const supportedVolatilitySymbols = new Set([
  "R_10", "R_25", "R_50", "R_75", "R_100",
  "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
]);
const allowedSymbols = new Set(
  String(process.env.TRADING_ALLOWED_SYMBOLS || "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean),
);
const deploymentReady = Boolean(
  baseUrl.startsWith("https://") &&
  clientId &&
  affiliateToken &&
  sessionSecret &&
  frontendConfigured,
);
const realTradingReady = Boolean(
  deploymentReady &&
  tradingEnabled &&
  liveTradingEnabled &&
  !demoOnly &&
  allowedSymbols.size > 0,
);

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function ownerKeyFor(loginId: string) {
  return crypto.createHash("sha256")
    .update(`protraders-owner:${loginId}`)
    .digest("hex");
}

function transactionNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function errorResponse(
  res: Response,
  status: number,
  error: string,
  message?: string,
) {
  return res.status(status).json({ error, ...(message ? { message } : {}) });
}

function encodingKey() {
  if (!sessionSecret) throw new Error("SESSION_SECRET is not configured");
  return crypto.createHash("sha256").update(sessionSecret).digest();
}

function encode(value: unknown) {
  return Buffer.from(value as string)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function seal(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encodingKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    encode(iv),
    encode(cipher.getAuthTag()),
    encode(encrypted),
  ].join(".");
}

function unseal(value: unknown): any {
  const [iv, tag, encrypted] = String(value || "").split(".");
  if (!iv || !tag || !encrypted) throw new Error("Invalid sealed value");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encodingKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8"));
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

function clearOAuthCookie(res: Response) {
  res.clearCookie("protraders_oauth_state", cookieOptions(0));
}

function readSession(req: Request): SessionValue | null {
  try {
    const value = unseal(req.cookies?.protraders_session) as SessionValue;
    if (
      !value?.accessToken ||
      !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= Date.now()
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function setSessionCookie(res: Response, value: SessionValue) {
  res.cookie(
    "protraders_session",
    seal(value),
    cookieOptions(Math.max(0, value.expiresAt - Date.now())),
  );
}

export async function getSession(req: Request, res: Response) {
  const current = readSession(req);
  if (!current) return null;
  if (current.expiresAt > Date.now() + 30_000 || !current.refreshToken) {
    return current;
  }

  try {
    const response = await fetch("https://auth.deriv.com/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: current.refreshToken,
      }),
    });
    if (!response.ok) return null;
    const token = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!token.access_token) return null;

    const refreshed = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || current.refreshToken,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      accountId: current.accountId,
    };
    setSessionCookie(res, refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

async function derivRestRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!clientId) throw new Error("DERIV_CLIENT_ID is not configured");
  const response = await fetch(`${derivApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Deriv-App-ID": clientId,
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    const providerMessage = body?.errors?.[0]?.message || body?.message;
    throw new Error(`Deriv account API returned ${response.status}${providerMessage ? `: ${providerMessage}` : ""}`);
  }
  return body as T;
}

export async function listDerivAccounts(accessToken: string) {
  const body = await derivRestRequest<{ data?: DerivOptionsAccount[] }>(
    accessToken,
    "/trading/v1/options/accounts",
  );
  return Array.isArray(body.data)
    ? body.data.filter((account) => account.account_id && account.account_type && Number.isFinite(Number(account.balance)))
    : [];
}

function chooseAccount(accounts: DerivOptionsAccount[], target?: "demo" | "real", accountId?: string) {
  return accounts.find((account) => account.account_id === accountId) ||
    (target ? accounts.find((account) => account.account_type === target) : undefined) ||
    accounts.find((account) => account.account_type === "demo") ||
    accounts.find((account) => account.status === "active") ||
    accounts[0];
}

function oauthRequest(mode: "login" | "signup", targetAccount?: "demo" | "real") {
  if (!clientId) throw new Error("DERIV_CLIENT_ID is not configured");
  if (mode === "signup" && !affiliateToken) {
    throw new Error("Deriv signup attribution is not configured");
  }

  const verifier = encode(crypto.randomBytes(64));
  const nonce = encode(crypto.randomBytes(16));
  const state: OAuthState = { verifier, mode, nonce, issuedAt: Date.now(), targetAccount };
  const parameters = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state: seal(state),
    code_challenge: encode(
      crypto.createHash("sha256").update(verifier).digest(),
    ),
    code_challenge_method: "S256",
  });

  if (mode === "signup") {
    parameters.set("prompt", "registration");
    parameters.set(affiliateParam, affiliateToken);
    parameters.set("utm_campaign", campaign);
    parameters.set("utm_medium", "affiliate");
    if (affiliateId) parameters.set("utm_source", affiliateId);
  }

  return {
    url: `https://auth.deriv.com/oauth2/auth?${parameters.toString()}`,
    nonce,
  };
}

async function beginOAuth(mode: "login" | "signup", req: Request, res: Response, targetAccount?: "demo" | "real") {
  try {
    if (isProduction && !baseUrl.startsWith("https://")) {
      throw new Error("OAuth requires an HTTPS BASE_URL in production");
    }
    const request = oauthRequest(mode, targetAccount);
    res.cookie(
      "protraders_oauth_state",
      seal({ nonce: request.nonce }),
      cookieOptions(10 * 60 * 1000),
    );
    await recordActivity({
      eventType: mode === "signup" ? "signup_start" : "login_start",
      req,
      path: req.path,
      metadata: { flow: mode },
    });
    return res.redirect(request.url);
  } catch (error) {
    return errorResponse(
      res,
      503,
      "OAuth unavailable",
      error instanceof Error ? error.message : undefined,
    );
  }
}

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1_500,
  standardHeaders: true,
  legacyHeaders: false,
}));

router.get("/config", (_req, res) => {
  res.json({
    configured: Boolean(clientId),
    loginConfigured: Boolean(clientId),
    signupConfigured: Boolean(clientId && affiliateToken),
    publicAppId,
    partnerParam: affiliateParam,
    campaign,
  });
});

router.get("/preflight", (_req, res) => {
  const sessionSecretConfigured = Boolean(process.env.SESSION_SECRET);
  const oauthClientConfigured = Boolean(clientId);
  const partnerTrackingConfigured = Boolean(affiliateToken);
  const publicAppConfigured = Boolean(publicAppId);
  res.json({
    productionBaseUrl: baseUrl,
    redirectUri,
    https: baseUrl.startsWith("https://"),
    oauthClientConfigured,
    partnerTrackingConfigured,
    sessionSecretConfigured,
    publicAppConfigured,
    frontendConfigured,
    tradingEnabled,
    liveTradingEnabled,
    demoOnly,
    persistenceConfigured: databaseConfigured,
    maxDuration,
    allowedSymbols: Array.from(allowedSymbols),
    executionMode: !tradingEnabled
      ? "DISABLED"
      : demoOnly
        ? "DEMO"
        : liveTradingEnabled
          ? "BOTH"
          : "LIVE LOCKED",
    readyForControlledLiveTest: deploymentReady,
    readyForRealTrading: realTradingReady,
  });
});

router.get("/deriv/login", async (req, res) => {
  const target = req.query.target === "demo" || req.query.target === "real"
    ? req.query.target
    : undefined;
  return beginOAuth("login", req, res, target);
});
router.get("/deriv/signup", async (req, res) => beginOAuth("signup", req, res));
router.get("/oauth/callback", handleOAuthCallback);

router.get("/session", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return res.json({ authenticated: false });
  return res.json({ authenticated: true, expiresAt: session.expiresAt });
});

function endSession(_req: Request, res: Response) {
  const options = { ...cookieOptions(0), expires: new Date(0) };
  res.setHeader("Cache-Control", "no-store");
  res.clearCookie("protraders_session", options);
  res.cookie("protraders_session", "", options);
  clearOAuthCookie(res);
  return res.status(204).end();
}
router.post("/logout", endSession);
router.get("/logout", endSession);

router.post("/track", async (req, res) => {
  const type = typeof req.body?.type === "string" ? req.body.type : "";
  if (!clientActivityTypes.has(type)) {
    return errorResponse(res, 400, "Unsupported activity event");
  }
  await recordActivity({
    eventType: type,
    req,
    path: req.body?.path,
    visitorId: req.body?.visitorId,
    metadata: req.body?.metadata,
  });
  return res.status(204).end();
});

router.get("/analytics", async (_req, res) => {
  try {
    res.json(await activitySummary());
  } catch (error) {
    res.json({
      visitors: 0,
      visits: 0,
      pagesViewed: 0,
      registrations: 0,
      oauthSuccesses: 0,
      fundedAccounts: null,
      events: {},
      persistent: false,
      note: "Analytics database is unavailable.",
      error: error instanceof Error ? error.message : "Analytics unavailable",
    });
  }
});

router.get("/transactions", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");

  try {
    const accounts = await listDerivAccounts(session.accessToken);
    const account = chooseAccount(accounts, undefined, session.accountId);
    const loginId = String(account?.account_id || "");
    if (!loginId) return errorResponse(res, 502, "Account identity unavailable");
    const ownerKey = ownerKeyFor(loginId);
    const rows = await db.select().from(transactions)
      .where(eq(transactions.ownerKey, ownerKey))
      .orderBy(desc(transactions.createdAt))
      .limit(100);
    return res.json({
      transactions: rows.map((row) => ({
        ...row,
        stake: transactionNumber(row.stake),
        payout: transactionNumber(row.payout),
        netProfit: transactionNumber(row.netProfit),
        duration: transactionNumber(row.duration),
      })),
    });
  } catch (error) {
    return errorResponse(res, 502, "Transactions unavailable", error instanceof Error ? error.message : undefined);
  }
});

router.get("/transactions/:id", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");

  try {
    const accounts = await listDerivAccounts(session.accessToken);
    const account = chooseAccount(accounts, undefined, session.accountId);
    const loginId = String(account?.account_id || "");
    if (!loginId) return errorResponse(res, 502, "Account identity unavailable");
    const [row] = await db.select().from(transactions).where(and(
      eq(transactions.id, String(req.params.id)),
      eq(transactions.ownerKey, ownerKeyFor(loginId)),
    )).limit(1);
    if (!row) return errorResponse(res, 404, "Transaction not found");
    return res.json({
      transaction: {
        ...row,
        stake: transactionNumber(row.stake),
        payout: transactionNumber(row.payout),
        netProfit: transactionNumber(row.netProfit),
        duration: transactionNumber(row.duration),
      },
    });
  } catch (error) {
    return errorResponse(res, 502, "Transaction unavailable", error instanceof Error ? error.message : undefined);
  }
});

router.post("/transactions/:id/refresh", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");

  try {
    const accounts = await listDerivAccounts(session.accessToken);
    const account = chooseAccount(accounts, undefined, session.accountId);
    const loginId = String(account?.account_id || "");
    if (!loginId) return errorResponse(res, 502, "Account identity unavailable");
    const ownerKey = ownerKeyFor(loginId);
    const [row] = await db.select().from(transactions).where(and(
      eq(transactions.id, String(req.params.id)),
      eq(transactions.ownerKey, ownerKey),
    )).limit(1);
    if (!row) return errorResponse(res, 404, "Transaction not found");
    if (!row.contractId || row.status !== "pending") {
      return res.json({ transaction: row, refreshed: false });
    }

    const contract = await derivRequest(session.accessToken, {
      proposal_open_contract: 1,
      contract_id: Number(row.contractId),
    }, session.accountId);
    const openContract = contract.proposal_open_contract || {};
    const isSettled = Boolean(openContract.is_sold || ["won", "lost", "sold", "expired"].includes(String(openContract.status || "").toLowerCase()));
    if (!isSettled) return res.json({ transaction: row, refreshed: false });

    const payout = transactionNumber(openContract.payout);
    const profit = transactionNumber(openContract.profit);
    const status = profit !== null ? (profit >= 0 ? "won" : "lost") : "settled";
    const [updated] = await db.update(transactions).set({
      payout: payout === null ? null : String(payout),
      netProfit: profit === null ? null : String(profit),
      status,
      settledAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(transactions.id, row.id),
      eq(transactions.ownerKey, ownerKey),
      eq(transactions.status, "pending"),
    )).returning();
    if (!updated) {
      return res.json({ transaction: row, refreshed: false });
    }
    void recordActivity({
      eventType: "settlement",
      ownerKey,
      metadata: { status, hasPayout: payout !== null, settled: true },
    });
    if (profit !== null) {
      void recordActivity({
        eventType: "pnl_result",
        ownerKey,
        metadata: { result: status, netProfit: profit },
      });
    }
    return res.json({ transaction: updated, refreshed: true });
  } catch (error) {
    return errorResponse(res, 502, "Settlement unavailable", error instanceof Error ? error.message : undefined);
  }
});

async function derivRequestOnce(wsUrl: string, payload: Record<string, unknown>) {
  return new Promise<any>((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    let settled = false;
    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch {}
      reject(new Error("Deriv request timeout"));
    }, 12_000);

    const finish = (callback: (value: any) => void, value: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      callback(value);
    };

    socket.on("open", () => socket.send(JSON.stringify(payload)));
    socket.on("message", (raw: RawData) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (data.error) {
        const code = typeof data.error.code === "string" ? data.error.code : "DerivError";
        finish(reject, new Error(`[${code}] ${data.error.message || "Deriv API error"}`));
      } else if (data.msg_type) {
        finish(resolve, data);
      }
    });
    socket.on("error", (error: Error) => finish(reject, error));
    socket.on("close", () => clearTimeout(timer));
  });
}

export async function derivRequest(
  accessToken: string,
  payload: Record<string, unknown>,
  accountId?: string,
) {
  const accounts = await listDerivAccounts(accessToken);
  const account = chooseAccount(accounts, undefined, accountId);
  if (!account?.account_id) throw new Error("No Deriv options account was returned");
  const otp = await derivRestRequest<{ data?: { url?: string } }>(
    accessToken,
    `/trading/v1/options/accounts/${encodeURIComponent(account.account_id)}/otp`,
    { method: "POST", body: "{}" },
  );
  const wsUrl = otp.data?.url;
  if (!wsUrl) throw new Error("Deriv did not return an authenticated WebSocket URL");
  return derivRequestOnce(wsUrl, payload);
}

async function derivProposalAndBuy(
  accessToken: string,
  proposalPayload: Record<string, unknown>,
  reviewedAskPrice: number,
  accountId?: string,
) {
  const accounts = await listDerivAccounts(accessToken);
  const account = chooseAccount(accounts, undefined, accountId);
  if (!account?.account_id) throw new Error("No Deriv options account was returned");
  const otp = await derivRestRequest<{ data?: { url?: string } }>(
    accessToken,
    `/trading/v1/options/accounts/${encodeURIComponent(account.account_id)}/otp`,
    { method: "POST", body: "{}" },
  );
  const wsUrl = otp.data?.url;
  if (!wsUrl) throw new Error("Deriv did not return an authenticated WebSocket URL");

  return new Promise<any>((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    let settled = false;
    let purchaseRequested = false;
    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch {}
      if (!settled) {
        settled = true;
        reject(new Error("Deriv proposal purchase timeout"));
      }
    }, 12_000);

    const finish = (callback: (value: any) => void, value: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      callback(value);
    };

    socket.on("open", () => socket.send(JSON.stringify(proposalPayload)));
    socket.on("message", (raw: RawData) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (data.error) {
        const code = typeof data.error.code === "string" ? data.error.code : "DerivError";
        finish(reject, new Error(`[${code}] ${data.error.message || "Deriv API error"}`));
        return;
      }
      if (data.msg_type === "proposal" && !purchaseRequested) {
        const proposalId = data.proposal?.id;
        const currentAskPrice = Number(data.proposal?.ask_price);
        if (!proposalId || !Number.isFinite(currentAskPrice) || currentAskPrice <= 0) {
          finish(reject, new Error("Deriv did not return a purchasable proposal"));
          return;
        }
        if (currentAskPrice > reviewedAskPrice) {
          finish(reject, new Error("The Deriv price increased after review. Review the updated proposal before running the trade."));
          return;
        }
        purchaseRequested = true;
        socket.send(JSON.stringify({ buy: proposalId, price: reviewedAskPrice }));
        return;
      }
      if (data.msg_type === "buy" && purchaseRequested) {
        finish(resolve, data);
      }
    });
    socket.on("error", (error: Error) => finish(reject, error));
    socket.on("close", () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(new Error("Deriv closed the trading connection before confirming the purchase"));
      }
    });
  });
}

router.get("/account", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");

  try {
    const accounts = await listDerivAccounts(session.accessToken);
    const requestedAccountType = req.query.account_type === "demo" || req.query.account_type === "real"
      ? req.query.account_type
      : undefined;
    const account = chooseAccount(
      accounts,
      requestedAccountType,
      requestedAccountType ? undefined : session.accountId,
    );
    if (!account?.account_id) throw new Error("No Deriv options account was returned");
    if (requestedAccountType && account.account_type !== requestedAccountType) {
      return errorResponse(
        res,
        404,
        `${requestedAccountType === "real" ? "Real" : "Demo"} account unavailable`,
        `This Deriv connection does not include a ${requestedAccountType} options account.`,
      );
    }
    if (account.account_id !== session.accountId) {
      setSessionCookie(res, { ...session, accountId: account.account_id });
    }
    if (account.account_id !== session.accountId) {
      void recordActivity({
        eventType: "account_connection",
        ownerKey: ownerKeyFor(account.account_id),
        metadata: { accountType: account.account_type || "unknown", action: "selected" },
      });
    }
    return res.json({
      authenticated: true,
      balance: account.balance ?? null,
      currency: account.currency ?? null,
      loginid: account.account_id ?? null,
      accountType: account.account_type ?? "demo",
      openPnl: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    if (message && /(invalid|expired|unauthorized|not authorized).*(token|authoriz)|token.*(invalid|expired)/i.test(message)) {
      res.clearCookie("protraders_session", cookieOptions(0));
      return errorResponse(res, 401, "Session expired", "Reconnect your Deriv account to refresh authorization.");
    }
    return errorResponse(
      res,
      502,
      "Account data unavailable",
      message,
    );
  }
});

router.post("/trades/preview", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");
  const symbol = String(req.body?.symbol || "");
  const contractType = supportedContractTypes.has(String(req.body?.contract_type)) ? String(req.body.contract_type) : null;
  const stake = Number(req.body?.stake);
  const duration = Number(req.body?.duration);
  const stopLoss = req.body?.stop_loss === undefined ? null : Number(req.body.stop_loss);
  const barrier = req.body?.barrier === undefined ? undefined : String(req.body.barrier);
  const sessionId = typeof req.body?.session_id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(req.body.session_id)
    ? req.body.session_id
    : null;
  const previewErrors = [
    !contractType ? "Choose a supported Deriv contract type." : "",
    !supportedVolatilitySymbols.has(symbol) ? "Choose a supported Volatility 10–100 market." : "",
    !Number.isFinite(stake) || stake <= 0 ? "Enter a valid stake amount." : "",
    !Number.isInteger(duration) || duration < 1 ? "Duration must be at least 1 tick." : "",
    duration > maxDuration ? `Duration cannot exceed ${maxDuration} ticks.` : "",
    stopLoss !== null && (!Number.isFinite(stopLoss) || stopLoss <= 0) ? "Stop loss must be greater than 0." : "",
    contractType && barrierContractTypes.has(contractType) && !/^[0-9]$/.test(barrier || "") ? "Choose a digit barrier from 0 to 9." : "",
  ].filter(Boolean);
  if (previewErrors.length) {
    return errorResponse(res, 400, "Invalid proposal parameters", previewErrors.join(" "));
  }
  const requestedContractType = contractType as string;
  try {
    const accounts = await listDerivAccounts(session.accessToken);
    const account = chooseAccount(accounts, undefined, session.accountId);
    if (!account?.account_id || !account.currency) return errorResponse(res, 502, "Account identity unavailable");
    const availableBalance = Number(account.balance);
    if (!Number.isFinite(availableBalance) || availableBalance <= 0) {
      return errorResponse(res, 502, "Account balance unavailable", "Reconnect or refresh the selected Deriv account.");
    }
    if (stake >= availableBalance) {
      return errorResponse(res, 400, "Stake exceeds available balance", "Enter a stake below the selected account balance.");
    }
    const availability = await derivRequest(session.accessToken, { contracts_for: symbol }, session.accountId);
    const offered = new Set((availability.contracts_for?.available || []).map((item: any) => String(item.contract_type)));
    if (!offered.has(requestedContractType)) return errorResponse(res, 400, "Contract unavailable", `${requestedContractType} is not offered by Deriv for ${symbol}.`);
    const response = await derivRequest(session.accessToken, {
      proposal: 1, amount: stake, basis: "stake", contract_type: requestedContractType,
      currency: account.currency, duration, duration_unit: "t", underlying_symbol: symbol,
      ...(barrierContractTypes.has(requestedContractType) ? { barrier } : {}),
    }, session.accountId);
    const proposal = response.proposal;
    if (!proposal?.id) return errorResponse(res, 502, "Deriv did not return a proposal");
    const askPrice = Number(proposal.ask_price);
    if (!Number.isFinite(askPrice) || askPrice <= 0) return errorResponse(res, 502, "Deriv returned an invalid proposal price");
    void recordActivity({
      eventType: "trade_preview",
      ownerKey: ownerKeyFor(account.account_id),
      metadata: {
        market: symbol,
        contractType: requestedContractType,
        duration,
        hasStopLoss: stopLoss !== null,
      },
    });
    return res.json({
      proposalToken: seal({ id: proposal.id, nonce: crypto.randomUUID(), accountId: account.account_id, symbol, contractType: requestedContractType, stake, duration, barrier: barrier || null, stopLoss, sessionId, askPrice, expiresAt: Date.now() + 30_000 }),
      symbol, contractType: requestedContractType, stake, duration, barrier: barrier || null,
      askPrice,
      payout: Number.isFinite(Number(proposal.payout)) ? Number(proposal.payout) : null,
      longcode: proposal.longcode || null,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      stopLossNote: "Stop loss is requested after Deriv accepts the contract; any rejection is reported explicitly.",
    });
  } catch (error) {
    return errorResponse(res, 502, "Proposal unavailable", error instanceof Error ? error.message : undefined);
  }
});

router.post("/trades", async (req, res) => {
  if (!tradingEnabled) {
    return errorResponse(
      res,
      503,
      "Trading disabled",
      "Enable TRADING_ENABLED only after the controlled demo test passes.",
    );
  }
  if (!demoOnly && !liveTradingEnabled) {
    return errorResponse(
      res,
      403,
      "Live trading disabled",
      "Set TRADING_LIVE_ENABLED=true only after an independent risk review.",
    );
  }
  if (!demoOnly && !realTradingReady) {
    return errorResponse(
      res,
      503,
      "Live trading not ready",
      "Complete HTTPS, Deriv, session, frontend, and symbol-allowlist configuration first.",
    );
  }

  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");

  const symbol = String(req.body?.symbol || "R_100");
  const contractType = supportedContractTypes.has(String(req.body?.contract_type))
    ? String(req.body.contract_type)
    : null;
  const stake = Number(req.body?.stake);
  const duration = Number(req.body?.duration);
  const barrier = req.body?.barrier === undefined ? undefined : String(req.body.barrier);
  const stopLoss = req.body?.stop_loss === undefined ? undefined : Number(req.body.stop_loss);
  const sessionId = typeof req.body?.session_id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(req.body.session_id)
    ? req.body.session_id
    : null;
  const validationErrors = [
    !contractType ? "Choose a supported Deriv contract type." : "",
    !supportedVolatilitySymbols.has(symbol) ? "Choose a supported Volatility 10–100 market." : "",
    !Number.isFinite(stake) || stake <= 0 ? "Enter a valid stake amount." : "",
    !Number.isInteger(duration) || duration < 1 ? "Duration must be at least 1 tick." : "",
    duration > maxDuration ? `Duration cannot exceed ${maxDuration} ticks.` : "",
    contractType && barrierContractTypes.has(contractType) && !/^[0-9]$/.test(barrier || "") ? "Choose a digit barrier from 0 to 9." : "",
    stopLoss !== undefined && (!Number.isFinite(stopLoss) || stopLoss <= 0) ? "Stop loss must be greater than 0." : "",
  ].filter(Boolean);
  if (validationErrors.length) {
    return errorResponse(res, 400, "Invalid trade parameters", validationErrors.join(" "));
  }
  const validatedContractType = contractType as string;

  try {
    const accounts = await listDerivAccounts(session.accessToken);
    const account = chooseAccount(accounts, undefined, session.accountId);
    const loginId = String(account?.account_id || "");
    const isDemoAccount = account?.account_type === "demo";
    if (!loginId || !account) return errorResponse(res, 502, "Account identity unavailable");
    const availableBalance = Number(account.balance);
    if (!Number.isFinite(availableBalance) || availableBalance <= 0) {
      return errorResponse(res, 502, "Account balance unavailable", "Reconnect or refresh the selected Deriv account.");
    }
    if (stake >= availableBalance) {
      return errorResponse(res, 400, "Stake exceeds available balance", "Enter a stake below the selected account balance.");
    }
    if (demoOnly && !isDemoAccount) {
      return errorResponse(
        res,
        403,
        "Demo account required",
        "Live trading is disabled by TRADING_DEMO_ONLY.",
      );
    }
    if (!isDemoAccount && allowedSymbols.size > 0 && !allowedSymbols.has(symbol)) {
      return errorResponse(res, 403, "Market not enabled for real trading", `${symbol} is available in Demo but is not on the reviewed real-money allowlist.`);
    }
    if (!isDemoAccount) {
      if (req.body?.live_confirmation !== liveConfirmationToken) {
        return errorResponse(
          res,
          403,
          "Live trade confirmation required",
          "Set live_confirmation to the explicit confirmation token before requesting a real-money order.",
        );
      }
      const ownerKey = ownerKeyFor(loginId);
      const [acknowledgement] = await db.select()
        .from(riskAcknowledgements)
        .where(and(
          eq(riskAcknowledgements.ownerKey, ownerKey),
          eq(riskAcknowledgements.version, riskAcknowledgementVersion),
        ))
        .orderBy(desc(riskAcknowledgements.acceptedAt))
        .limit(1);
      if (!acknowledgement) {
        return errorResponse(
          res,
          409,
          "Risk acknowledgement required",
          "Accept the current risk acknowledgement before requesting a real-money order.",
        );
      }
    }
    const currency = account.currency;
    if (!currency) return errorResponse(res, 502, "Account currency unavailable");

    const availability = await derivRequest(session.accessToken, { contracts_for: symbol }, session.accountId);
    const availableContractTypes = new Set(
      (Array.isArray(availability.contracts_for?.available) ? availability.contracts_for.available : [])
        .map((item: any) => String(item.contract_type)),
    );
    if (!availableContractTypes.has(validatedContractType)) {
      return errorResponse(res, 400, "Contract unavailable", `${validatedContractType} is not offered by Deriv for ${symbol}.`);
    }

    if (!req.body?.proposal_token) return errorResponse(res, 409, "Proposal review required", "Review a provider-backed proposal before execution.");
    const reviewed = unseal(req.body.proposal_token);
    const matches = reviewed?.accountId === loginId && reviewed?.symbol === symbol && reviewed?.contractType === validatedContractType
      && reviewed?.stake === stake && reviewed?.duration === duration && reviewed?.barrier === (barrier || null)
      && reviewed?.stopLoss === (stopLoss ?? null) && reviewed?.sessionId === sessionId && reviewed?.expiresAt > Date.now();
    if (!matches || !reviewed?.id || !reviewed?.nonce || !Number.isFinite(reviewed?.askPrice) || reviewed.askPrice <= 0) return errorResponse(res, 409, "Proposal expired or changed", "Review the current order again before execution.");
    const consumed = await db.insert(consumedTradeProposals).values({
      nonce: reviewed.nonce,
      ownerKey: ownerKeyFor(account.account_id || loginId),
      proposalId: reviewed.id,
    }).onConflictDoNothing().returning({ nonce: consumedTradeProposals.nonce });
    if (!consumed.length) return errorResponse(res, 409, "Proposal already used", "This proposal has already been submitted. Review a fresh proposal before another order.");
    const buy = await derivProposalAndBuy(session.accessToken, {
      proposal: 1,
      amount: stake,
      basis: "stake",
      contract_type: validatedContractType,
      currency,
      duration,
      duration_unit: "t",
      underlying_symbol: symbol,
      ...(barrierContractTypes.has(validatedContractType) ? { barrier } : {}),
    }, reviewed.askPrice, session.accountId);
    if (buy.error) return errorResponse(res, 502, "Trade request failed", buy.error.message);
    const contractId = buy.buy?.contract_id ? Number(buy.buy.contract_id) : null;
    if (!contractId || !Number.isFinite(contractId)) {
      return errorResponse(res, 502, "Trade not accepted", "Deriv did not return an accepted contract ID. No transaction was recorded.");
    }
    let stopLossApplied: boolean | null = null;
    let stopLossMessage: string | null = null;
    if (stopLoss !== undefined && contractId) {
      try {
        await derivRequest(session.accessToken, {
          contract_update: 1,
          contract_id: contractId,
          limit_order: { stop_loss: stopLoss },
        }, session.accountId);
        stopLossApplied = true;
      } catch (error) {
        stopLossApplied = false;
        stopLossMessage = error instanceof Error ? error.message : "Deriv rejected the stop loss";
      }
    }
    const transaction = await db.insert(transactions).values({
      ownerKey: ownerKeyFor(loginId),
      source: ["manual", "bulk", "ai_assisted", "bot_assisted"].includes(String(req.body?.source))
        ? String(req.body.source)
        : "manual",
      accountType: isDemoAccount ? "demo" : "real",
      loginid: loginId,
      symbol,
      contractType: validatedContractType,
      stake: String(stake),
      currency,
      duration: String(duration),
      contractId: String(contractId),
      status: "pending",
      metadata: {
        proposalId: buy.echo_req?.buy || reviewed.id,
        barrier: barrierContractTypes.has(validatedContractType) ? barrier : null,
        stopLoss: stopLoss ?? null,
        stopLossApplied,
        stopLossMessage,
        requestLabel: String(req.body?.request_label || "").slice(0, 120) || null,
        sessionId,
      },
    }).returning();
    void recordActivity({
      eventType: "trade_accepted",
      ownerKey: ownerKeyFor(loginId),
      metadata: {
        market: symbol,
        contractType: validatedContractType,
        accountType: isDemoAccount ? "demo" : "real",
        duration,
      },
    });
    return res.json({
      ok: true,
       message: `Trade accepted on ${symbol}. Contract ${contractId}.${stopLossApplied === false ? " Stop loss was rejected by Deriv; review the open contract." : stopLossApplied ? " Stop loss applied." : ""}`,
       contractId: String(contractId),
      transactionId: transaction[0]?.id || null,
      status: "pending",
      netProfit: null,
      stopLossApplied,
      stopLossMessage,
    });
  } catch (error) {
    return errorResponse(
      res,
      502,
      "Trade request failed",
      error instanceof Error ? error.message : undefined,
    );
  }
});

export async function handleOAuthCallback(req: Request, res: Response) {
  try {
    if (req.query.error) {
      clearOAuthCookie(res);
      void recordActivity({
        eventType: "oauth_failure",
        req,
        path: "/oauth/callback",
        metadata: { reason: "provider_denied" },
      });
      return res.redirect(`/?oauth_error=${encodeURIComponent(String(req.query.error))}`);
    }

    const state = unseal(req.query.state) as OAuthState;
    const browserState = unseal(req.cookies?.protraders_oauth_state) as { nonce?: string };
    const stateNonce = Buffer.from(String(state?.nonce || ""));
    const browserNonce = Buffer.from(String(browserState?.nonce || ""));
    const nonceMatches = stateNonce.length > 0 &&
      stateNonce.length === browserNonce.length &&
      crypto.timingSafeEqual(stateNonce, browserNonce);
    if (
      !state?.verifier ||
      !["login", "signup"].includes(state.mode) ||
      !Number.isFinite(state.issuedAt) ||
      Date.now() - state.issuedAt > 600_000 ||
      !nonceMatches ||
      !req.query.code
    ) {
      throw new Error("Invalid or expired OAuth state");
    }

    const response = await fetch("https://auth.deriv.com/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code: String(req.query.code),
        code_verifier: state.verifier,
        redirect_uri: redirectUri,
      }),
    });
    if (!response.ok) throw new Error(`Token exchange failed (${response.status})`);
    const token = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!token.access_token) throw new Error("No access token returned");

    let nextSession: SessionValue = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    };
    const accounts = await listDerivAccounts(nextSession.accessToken);
    const selectedAccount = chooseAccount(accounts, state.targetAccount);
    if (!selectedAccount?.account_id) {
      throw new Error("No Deriv options account was returned");
    }
    if (state.targetAccount && selectedAccount.account_type !== state.targetAccount) {
        clearOAuthCookie(res);
        return res.redirect(`/initializing?account_switch=mismatch&expected=${state.targetAccount}`);
    }
    nextSession = { ...nextSession, accountId: selectedAccount.account_id };
    setSessionCookie(res, nextSession);
    clearOAuthCookie(res);
    const ownerKey = ownerKeyFor(selectedAccount.account_id);
    await recordActivity({
      eventType: state.mode === "signup" ? "oauth_signup_success" : "oauth_login_success",
      ownerKey,
      metadata: { flow: state.mode },
    });
    await recordActivity({
      eventType: "account_connection",
      ownerKey,
      metadata: { accountType: selectedAccount.account_type || "unknown" },
    });
    return res.redirect(state.targetAccount ? `/initializing?account_switched=${state.targetAccount}` : "/initializing");
  } catch (error) {
    clearOAuthCookie(res);
    void recordActivity({
      eventType: "oauth_failure",
      req,
      path: "/oauth/callback",
      metadata: { reason: "callback_failed" },
    });
    req.log?.warn({ err: error }, "OAuth callback failed");
    return res.redirect("/?oauth_error=oauth_failed");
  }
}

export default router;