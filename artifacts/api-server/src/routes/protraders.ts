import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import WebSocket, { type RawData } from "ws";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { botRuns, bots, consumedTradeProposals, databaseConfigured, db, riskAcknowledgements, transactions } from "@workspace/db";
import { activitySummary, clientActivityTypes, recordActivity } from "../lib/activity-tracking";
import { logger } from "../lib/logger";

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
  raw_account_type?: string;
  is_virtual?: boolean;
  status?: "active" | "inactive";
};

type DerivOptionsAccountPayload = Omit<DerivOptionsAccount, "account_type"> & {
  account_type?: unknown;
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
const tradingEnabled = process.env.TRADING_ENABLED !== "false";
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
const realTradingSymbols = new Set(["R_10", "R_25", "R_50", "R_75", "R_100", "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V"]);
const allowedSymbols = new Set(
  String(process.env.TRADING_ALLOWED_SYMBOLS || "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter((symbol) => realTradingSymbols.has(symbol)),
);
const deploymentReady = Boolean(
  baseUrl.startsWith("https://") &&
  clientId &&
  sessionSecret &&
  frontendConfigured,
);
const realTradingConfigReady = Boolean(
  deploymentReady &&
  databaseConfigured &&
  tradingEnabled &&
  liveTradingEnabled &&
  !demoOnly &&
  allowedSymbols.size > 0,
);

async function checkTradingSafetyTables() {
  if (!databaseConfigured) return false;

  try {
    const result = await db.execute(sql`
      SELECT
        to_regclass('public.consumed_trade_proposals') AS consumed_trade_proposals,
        to_regclass('public.risk_acknowledgements') AS risk_acknowledgements
    `);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return Boolean(row?.consumed_trade_proposals && row?.risk_acknowledgements);
  } catch (error) {
    logger.warn({ error: tradeErrorDiagnostic(error) }, "Trading safety schema check failed");
    return false;
  }
}

function accountTradingPolicy(account: DerivOptionsAccount | undefined) {
  if (!account?.account_id) {
    return { allowed: false, error: "Account identity unavailable", message: "Reconnect or select a Deriv account before trading." };
  }
  const accountType = normalizeAccountType(account);
  if (accountType === "demo") {
    return tradingEnabled
      ? { allowed: true }
      : { allowed: false, error: "Trading disabled", message: "Demo trading is not enabled in this deployment." };
  }
  if (accountType === "real" && demoOnly) {
    return { allowed: false, error: "Demo account required", message: "Real trading is disabled by TRADING_DEMO_ONLY." };
  }
  if (accountType === "real" && !liveTradingEnabled) {
    return { allowed: false, error: "Live trading disabled", message: "Set TRADING_LIVE_ENABLED=true only after an independent risk review." };
  }
  if (accountType === "real" && !realTradingConfigReady) {
    return { allowed: false, error: "Live trading not ready", message: "Complete HTTPS, Deriv, persistence, session, and symbol-allowlist configuration first." };
  }
  const rawType = account.raw_account_type?.trim()
    ? account.raw_account_type.trim().slice(0, 80)
    : "missing";
  return { allowed: false, error: "Unsupported account type", message: `Deriv returned account type "${rawType}". Choose a supported Demo or Real Deriv account.` };
}

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

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .split(/\r?\n/, 1)[0]
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(
      /\b(access[\s_-]?token|refresh[\s_-]?token|authorization|cookie|session[\s_-]?secret|database[\s_-]?url|proposal[\s_-]?token|password|passwd|pwd|api[\s_-]?key|secret)\b\s*[=:]?\s*[^\s,;]*/gi,
      "[redacted]",
    )
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[redacted]")
    .replace(/\b[0-9a-f]{32,}\b/gi, "[redacted]")
    .replace(/\b(nonce|owner_key|proposal_id)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 240);
}

type TradeErrorRecord = {
  code?: unknown;
  constraint?: unknown;
  error_code?: unknown;
  errorCode?: unknown;
  derivErrorCode?: unknown;
  message?: unknown;
  cause?: unknown;
};

function tradeErrorChain(error: unknown) {
  const records: TradeErrorRecord[] = [];
  let current: unknown = error;
  let depth = 0;

  while (current && typeof current === "object" && depth < 5) {
    const candidate = current as TradeErrorRecord;
    records.push(candidate);
    current = candidate.cause;
    depth += 1;
  }

  return records;
}

function safeDiagnosticCode(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(value)
    ? value
    : null;
}

function usefulErrorMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const message = value.split(/\r?\n/, 1)[0]?.trim() || "";
  if (!message || /failed query|parameters?:/i.test(message)) return null;
  return message;
}

function tradeErrorDiagnostic(error: unknown) {
  const records = tradeErrorChain(error);
  const deepestRecords = [...records].reverse();
  const rawMessage = deepestRecords
    .map((record) => usefulErrorMessage(record.message))
    .find(Boolean)
    || records.map((record) => typeof record.message === "string" ? record.message : "").find(Boolean)
    || "Unknown error";

  let postgresCode: string | null = null;
  let postgresConstraint: string | null = null;
  let derivErrorCode: string | null = null;

  for (const record of deepestRecords) {
    if (!postgresCode && typeof record.code === "string" && /^[0-9A-Z]{5}$/i.test(record.code)) {
      postgresCode = record.code;
    }
    if (!postgresConstraint && typeof record.constraint === "string" && /^[a-zA-Z0-9_]{1,128}$/.test(record.constraint)) {
      postgresConstraint = record.constraint;
    }
    if (!derivErrorCode) {
      for (const candidate of [record.derivErrorCode, record.error_code, record.errorCode]) {
        const safeCode = safeDiagnosticCode(candidate);
        if (safeCode) {
          derivErrorCode = safeCode;
          break;
        }
      }
    }
    if (!derivErrorCode && typeof record.message === "string") {
      const match = record.message.match(/^\[([a-zA-Z0-9_.-]{1,80})\]/);
      if (match) derivErrorCode = match[1];
    }
  }

  return {
    postgresCode,
    postgresConstraint,
    sanitizedErrorMessage: safeErrorMessage(new Error(rawMessage)) || "Unknown error",
    derivErrorCode,
  };
}

function persistenceErrorMessage(prefix: string, error: unknown) {
  const diagnostic = tradeErrorDiagnostic(error);
  const details = [
    diagnostic.postgresCode ? `db_code=${diagnostic.postgresCode}` : "",
    diagnostic.postgresConstraint ? `constraint=${diagnostic.postgresConstraint}` : "",
    diagnostic.sanitizedErrorMessage !== "Unknown error" ? diagnostic.sanitizedErrorMessage : "",
  ].filter(Boolean);
  return details.length ? `${prefix} ${details.join(" ")}`.slice(0, 600) : prefix;
}

function isoTimestamp(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function logTradeStageError(
  req: Request,
  stage: string,
  error: unknown,
  accountType: string | undefined,
  symbol: string,
) {
  const requestIdValue = (req as Request & { id?: unknown }).id;
  const requestId = typeof requestIdValue === "string" || typeof requestIdValue === "number"
    ? String(requestIdValue)
    : "unknown";
  const diagnostic = tradeErrorDiagnostic(error);
  const payload = {
    requestId,
    stage,
    accountType: accountType || null,
    symbol: symbol.slice(0, 80),
    postgresCode: diagnostic.postgresCode,
    postgresConstraint: diagnostic.postgresConstraint,
    sanitizedErrorMessage: diagnostic.sanitizedErrorMessage,
    derivErrorCode: diagnostic.derivErrorCode,
  };

  try {
    if (req.log && typeof req.log.warn === "function") {
      req.log.warn(payload);
      return;
    }
  } catch {
    // Fall through to the application logger without exposing the raw error.
  }

  try {
    logger.warn(payload);
  } catch {
    // Diagnostics must never interrupt the original trade error handling.
  }
}

function isConsumedProposalConflict(error: unknown) {
  const databaseError = error as { code?: string; constraint?: string; message?: string };
  const details = `${databaseError?.constraint || ""} ${databaseError?.message || ""}`;
  return (databaseError?.code === "23505" || /duplicate key value violates unique constraint/i.test(details))
    && /consumed[_\s-]?trade[_\s-]?proposals|nonce/i.test(details);
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
  const body = await derivRestRequest<{ data?: DerivOptionsAccountPayload[] }>(
    accessToken,
    "/trading/v1/options/accounts",
  );
  return Array.isArray(body.data)
    ? body.data
      .map((account) => ({
        ...account,
        raw_account_type: typeof account.account_type === "string"
          ? account.account_type
          : account.account_type == null
            ? undefined
            : String(account.account_type),
        account_type: normalizeAccountType(account),
        balance: account.balance == null
          ? undefined
          : Number(account.balance),
      }))
      .filter((account) => account.account_id)
    : [];
}

function normalizeAccountType(account: DerivOptionsAccount | DerivOptionsAccountPayload): "demo" | "real" | undefined {
  const directType = [account.account_type, account.raw_account_type]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .find((value): value is "demo" | "real" => value === "demo" || value === "real");
  if (account.is_virtual === true) return "demo";
  if (directType) return directType;

  const rawType = [account.raw_account_type, account.account_type]
    .filter((value) => value != null && String(value).trim())
    .map((value) => String(value).trim().toLowerCase())
    .join(" ");
  if (/(^|[_\s-])(demo|virtual|vrtc|practice|paper|test)($|[_\s-])/.test(rawType) || ["demo", "virtual", "vrtc", "practice", "paper", "test"].includes(rawType)) {
    return "demo";
  }
  if (/(^|[_\s-])(real|live|financial|funded|cash)($|[_\s-])/.test(rawType) || ["real", "live", "financial", "funded", "cash"].includes(rawType)) {
    return "real";
  }
  const accountId = String(account.account_id || "").toUpperCase();
  if (accountId.startsWith("VRTC")) return "demo";
  if (accountId.startsWith("CR")) return "real";
  return undefined;
}

function chooseAccount(accounts: DerivOptionsAccount[], target?: "demo" | "real", accountId?: string) {
  if (accountId) return accounts.find((account) => account.account_id === accountId);
  if (target) return accounts.find((account) => account.account_type === target);
  return undefined;
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

router.get("/preflight", async (_req, res): Promise<void> => {
  const sessionSecretConfigured = Boolean(process.env.SESSION_SECRET);
  const tradingSafetyTablesReady = await checkTradingSafetyTables();
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
    tradingSafetyTablesReady,
    maxDuration,
    allowedSymbols: Array.from(allowedSymbols),
    executionMode: !tradingEnabled
      ? "DISABLED"
      : demoOnly
        ? "DEMO"
        : liveTradingEnabled
          ? "BOTH"
          : "LIVE LOCKED",
    readyForControlledLiveTest: deploymentReady && databaseConfigured,
    readyForRealTrading: realTradingConfigReady && tradingSafetyTablesReady,
  });
});

router.get("/risk-acknowledgements/status", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");
  if (!session.accountId) {
    return errorResponse(res, 409, "Account selection required", "Select the Real account before accepting the live-trading disclosure.");
  }

  try {
    const [acknowledgement] = await db.select({
      acceptedAt: riskAcknowledgements.acceptedAt,
    }).from(riskAcknowledgements).where(and(
      eq(riskAcknowledgements.ownerKey, ownerKeyFor(session.accountId)),
      eq(riskAcknowledgements.version, riskAcknowledgementVersion),
    )).orderBy(desc(riskAcknowledgements.acceptedAt)).limit(1);
    return res.json({
      accepted: Boolean(acknowledgement),
      version: riskAcknowledgementVersion,
      acceptedAt: isoTimestamp(acknowledgement?.acceptedAt),
    });
  } catch (error) {
    logTradeStageError(req, "risk_acknowledgement_status", error, "real", "");
    return errorResponse(
      res,
      503,
      "Risk acknowledgement unavailable",
      persistenceErrorMessage("Live trading readiness could not be verified.", error),
    );
  }
});

router.post("/risk-acknowledgements/accept", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");
  if (!session.accountId) {
    return errorResponse(res, 409, "Account selection required", "Select the Real account before accepting the live-trading disclosure.");
  }
  const requestedVersion = typeof req.body?.version === "string" ? req.body.version : "";
  if (requestedVersion !== riskAcknowledgementVersion) {
    return errorResponse(res, 400, "Risk acknowledgement version required", "Accept the current live-trading disclosure.");
  }

  try {
    const [acknowledgement] = await db.insert(riskAcknowledgements).values({
      ownerKey: ownerKeyFor(session.accountId),
      version: riskAcknowledgementVersion,
    }).returning({ acceptedAt: riskAcknowledgements.acceptedAt });
    return res.status(201).json({
      accepted: true,
      version: riskAcknowledgementVersion,
      acceptedAt: isoTimestamp(acknowledgement?.acceptedAt) || new Date().toISOString(),
    });
  } catch (error) {
    logTradeStageError(req, "risk_acknowledgement_accept", error, "real", "");
    return errorResponse(
      res,
      503,
      "Risk acknowledgement unavailable",
      persistenceErrorMessage("Live trading readiness could not be recorded.", error),
    );
  }
});

router.get("/diagnostics/database-identity", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");

  if (!databaseConfigured) {
    return errorResponse(res, 503, "Database unavailable");
  }

  try {
    const result = await db.execute(sql`
      SELECT
        current_database() AS database_name,
        current_user AS user_name,
        inet_server_addr()::text AS server_address,
        inet_server_port() AS server_port,
        version() AS server_version,
        pg_is_in_recovery() AS in_recovery
    `);

    const row = result.rows[0] as Record<string, unknown> | undefined;

    return res.json({
      database: typeof row?.database_name === "string" ? row.database_name : null,
      user: typeof row?.user_name === "string" ? row.user_name : null,
      serverAddress: typeof row?.server_address === "string" ? row.server_address : null,
      serverPort: row?.server_port == null ? null : Number(row.server_port),
      version: typeof row?.server_version === "string" ? row.server_version : null,
      isInRecovery: row?.in_recovery === true,
    });
  } catch (error: unknown) {
    const errorRecord = error && typeof error === "object"
      ? error as {
        name?: unknown;
        code?: unknown;
        message?: unknown;
        constraint?: unknown;
        severity?: unknown;
        cause?: unknown;
      }
      : {};
    const causeRecord = errorRecord.cause && typeof errorRecord.cause === "object"
      ? errorRecord.cause as {
        name?: unknown;
        code?: unknown;
        message?: unknown;
        severity?: unknown;
      }
      : {};
    const sanitizeText = (value: unknown, fallback: string) => {
      const text = typeof value === "string" ? value.split(/\r?\n/, 1)[0] : fallback;
      return text
        .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
        .replace(/(?:database_url|postgres_url|db_host|db_ssl|session_secret|password|passwd|pwd|token|api[_-]?key|secret|authorization|cookie)\s*[=:]?\s*[^\s,;]+/gi, "$1=[redacted]")
        .replace(/[0-9a-f]{32,}/gi, "[redacted]")
        .slice(0, 240);
    };
    const sanitizeNullableText = (value: unknown) => {
      const text = sanitizeText(value, "");
      return text || null;
    };
    const sanitizeCode = (value: unknown) => (
      typeof value === "string" && /^[0-9A-Z]{5}$/i.test(value) ? value : undefined
    );
    const sanitizeConstraint = (value: unknown) => (
      typeof value === "string" && /^[a-zA-Z0-9_]{1,128}$/.test(value) ? value : undefined
    );
    const sanitizeSeverity = (value: unknown) => (
      typeof value === "string" && /^[A-Z ]{1,32}$/.test(value) ? value : undefined
    );

    req.log?.warn(
      {
        stage: "database_identity",
        errorName: sanitizeText(errorRecord.name, "UnknownError"),
        code: sanitizeCode(errorRecord.code),
        causeCode: sanitizeCode(causeRecord.code),
        message: sanitizeText(errorRecord.message ?? error, "Unknown error"),
        constraint: sanitizeConstraint(errorRecord.constraint),
        severity: sanitizeSeverity(errorRecord.severity),
      },
      "database identity diagnostic failed",
    );
    return res.status(503).json({
      error: "Database identity unavailable",
      diagnostic: {
        name: sanitizeNullableText(errorRecord.name) ?? sanitizeNullableText(causeRecord.name),
        code: sanitizeCode(errorRecord.code) ?? sanitizeCode(causeRecord.code) ?? null,
        message: sanitizeNullableText(causeRecord.message) ?? sanitizeNullableText(errorRecord.message),
        severity: sanitizeSeverity(errorRecord.severity) ?? sanitizeSeverity(causeRecord.severity) ?? null,
      },
    });
  }
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
    const [row] = await db.select().from(transactions)
      .where(eq(transactions.id, String(req.params.id)))
      .limit(1);
    if (!row) return errorResponse(res, 404, "Transaction not found");
    const tradeAccount = accounts.find((account) => account.account_id === row.loginid);
    if (!tradeAccount?.account_id || row.ownerKey !== ownerKeyFor(tradeAccount.account_id)) {
      return errorResponse(res, 404, "Transaction not found");
    }
    const ownerKey = row.ownerKey;
    if (!row.contractId || row.status !== "pending") {
      return res.json({ transaction: row, refreshed: false });
    }

    const contract = await derivRequest(session.accessToken, {
      proposal_open_contract: 1,
      contract_id: Number(row.contractId),
    }, tradeAccount.account_id);
    const openContract = contract.proposal_open_contract || {};
    const isSettled = Boolean(openContract.is_sold || ["won", "lost", "sold", "expired"].includes(String(openContract.status || "").toLowerCase()));
    if (!isSettled) return res.json({ transaction: row, refreshed: false });

    const payout = transactionNumber(openContract.payout);
    const profit = transactionNumber(openContract.profit);
    const priorMetadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    const buyPrice = transactionNumber(openContract.buy_price ?? priorMetadata.buyPrice ?? row.stake);
    const entrySpot = transactionNumber(openContract.entry_spot ?? priorMetadata.entrySpot);
    const exitSpot = transactionNumber(openContract.exit_spot ?? openContract.current_spot);
    const status = profit !== null ? (profit >= 0 ? "won" : "lost") : "settled";
    const [updated] = await db.update(transactions).set({
      payout: payout === null ? null : String(payout),
      netProfit: profit === null ? null : String(profit),
      status,
      metadata: {
        ...priorMetadata,
        buyPrice,
        entrySpot,
        exitSpot,
        providerStatus: openContract.status || null,
      },
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
    const botRunId = typeof (row.metadata as any)?.sessionId === "string" && row.source === "bot_assisted"
      ? String((row.metadata as any).sessionId)
      : null;
    if (botRunId && profit !== null) {
      const settledLoss = Math.max(0, -profit);
      await db.update(botRuns).set({
        settledLoss: sql`${botRuns.settledLoss} + ${settledLoss}`,
        status: sql`CASE
          WHEN ${botRuns.acceptedRuns} >= ${botRuns.runCount}
            OR ${botRuns.settledLoss} + ${settledLoss} >= ${botRuns.riskCap}
          THEN 'completed'
          ELSE ${botRuns.status}
        END`,
        completedAt: sql`CASE
          WHEN ${botRuns.acceptedRuns} >= ${botRuns.runCount}
            OR ${botRuns.settledLoss} + ${settledLoss} >= ${botRuns.riskCap}
          THEN NOW()
          ELSE ${botRuns.completedAt}
        END`,
        updatedAt: new Date(),
      }).where(and(
        eq(botRuns.id, botRunId),
        eq(botRuns.ownerKey, ownerKey),
        eq(botRuns.accountId, tradeAccount.account_id),
        eq(botRuns.status, "active"),
      ));
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
  res.setHeader("Cache-Control", "no-store");

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
    if (!account?.account_id) {
      if (requestedAccountType) {
        return errorResponse(
          res,
          404,
          `${requestedAccountType === "real" ? "Real" : "Demo"} account unavailable`,
          `This Deriv connection does not include a ${requestedAccountType} options account.`,
        );
      }
      return errorResponse(
        res,
        409,
        session.accountId ? "Selected account unavailable" : "Account selection required",
        "Choose an available Demo or Real account.",
      );
    }
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
      accountType: account.account_type,
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
  const runCount = req.body?.run_count === undefined ? null : Number(req.body.run_count);
  const riskCap = req.body?.risk_cap === undefined ? null : Number(req.body.risk_cap);
  const martingaleEnabled = req.body?.martingale_enabled === true;
  const martingaleMultiplier = req.body?.martingale_multiplier === undefined ? null : Number(req.body.martingale_multiplier);
  const martingaleMaxStake = req.body?.martingale_max_stake === undefined ? null : Number(req.body.martingale_max_stake);
  const consecutiveLossLimit = req.body?.consecutive_loss_limit === undefined ? null : Number(req.body.consecutive_loss_limit);
  const source = String(req.body?.source || "manual");
  const barrier = req.body?.barrier === undefined ? undefined : String(req.body.barrier);
  const sessionId = typeof req.body?.session_id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(req.body.session_id)
    ? req.body.session_id
    : null;
  const requestedAccountId = typeof req.body?.account_id === "string" ? req.body.account_id : null;
  const botId = typeof req.body?.bot_id === "string" && /^[0-9a-f-]{36}$/i.test(req.body.bot_id) ? req.body.bot_id : null;
  if (!session.accountId || !requestedAccountId || requestedAccountId !== session.accountId) {
    return errorResponse(res, 409, "Trading account changed", "Review the order again using the currently selected account.");
  }
  const previewErrors = [
    !contractType ? "Choose a supported Deriv contract type." : "",
    !supportedVolatilitySymbols.has(symbol) ? "Choose a supported Volatility 10–100 market." : "",
    !Number.isFinite(stake) || stake <= 0 ? "Enter a valid stake amount." : "",
    !Number.isInteger(duration) || duration < 1 ? "Duration must be at least 1 tick." : "",
    duration > maxDuration ? `Duration cannot exceed ${maxDuration} ticks.` : "",
    stopLoss !== null && (!Number.isFinite(stopLoss) || stopLoss <= 0) ? "Stop loss must be greater than 0." : "",
    req.body?.source === "bot_assisted" && (!Number.isInteger(runCount) || Number(runCount) < 1 || Number(runCount) > 10) ? "Bot run count must be from 1 to 10." : "",
    req.body?.source === "bot_assisted" && (!Number.isFinite(riskCap) || Number(riskCap) <= 0 || (martingaleEnabled ? Number(martingaleMaxStake) : stake) * Number(runCount) > Number(riskCap)) ? "Bot plan exceeds its risk cap." : "",
    req.body?.source === "bot_assisted" && (!Number.isFinite(martingaleMultiplier) || Number(martingaleMultiplier) < 1 || Number(martingaleMultiplier) > 5) ? "Martingale multiplier must be between 1 and 5." : "",
    req.body?.source === "bot_assisted" && (!Number.isFinite(martingaleMaxStake) || Number(martingaleMaxStake) < stake) ? "Martingale max stake must be at least the starting stake." : "",
    req.body?.source === "bot_assisted" && (!Number.isInteger(consecutiveLossLimit) || Number(consecutiveLossLimit) < 1 || Number(consecutiveLossLimit) > 10) ? "Consecutive-loss guard must be from 1 to 10." : "",
    req.body?.source === "bot_assisted" && (!Number.isInteger(consecutiveLossLimit) || Number(consecutiveLossLimit) < 1 || Number(consecutiveLossLimit) > 10) ? "Consecutive-loss guard must be from 1 to 10." : "",
    req.body?.source === "bot_assisted" && (!botId || !sessionId) ? "A saved bot and run session are required." : "",
    source !== "bot_assisted" && (req.body?.bot_id !== undefined || req.body?.run_count !== undefined || req.body?.risk_cap !== undefined || req.body?.martingale_enabled !== undefined || req.body?.martingale_multiplier !== undefined || req.body?.martingale_max_stake !== undefined || req.body?.consecutive_loss_limit !== undefined)
      ? "Bot plan fields require bot-assisted execution." : "",
    contractType && barrierContractTypes.has(contractType) && !/^[0-9]$/.test(barrier || "") ? "Choose a digit barrier from 0 to 9." : "",
  ].filter(Boolean);
  if (previewErrors.length) {
    return errorResponse(res, 400, "Invalid proposal parameters", previewErrors.join(" "));
  }
  const requestedContractType = contractType as string;
  let executionStage = "account_lookup";
  let executionAccountType: string | undefined;
  try {
    const accounts = await listDerivAccounts(session.accessToken);
    const account = chooseAccount(accounts, undefined, session.accountId);
    if (!account?.account_id || !account.currency) return errorResponse(res, 502, "Account identity unavailable");
    executionAccountType = account.account_type;
    const policy = accountTradingPolicy(account);
    if (!policy.allowed) return errorResponse(res, 403, policy.error || "Account trading unavailable", policy.message);
     if (account.account_type === "real" && !allowedSymbols.has(symbol)) {
       return errorResponse(res, 403, "Market not enabled for real trading", `${symbol} is available in Demo but is not on the reviewed real-money allowlist.`);
     }
    if (req.body?.source === "bot_assisted") {
      const ownerKey = ownerKeyFor(account.account_id);
      const [bot] = await db.select().from(bots).where(and(
        eq(bots.id, botId as string),
        eq(bots.ownerKey, ownerKey),
      )).limit(1);
      const config = bot?.config as Record<string, unknown> | undefined;
      const configuredContractType = String(config?.contractType || "CALL");
      const configuredDuration = Number(config?.duration || 1);
      const configuredBarrier = barrierContractTypes.has(configuredContractType) ? String(config?.barrier || "5") : null;
      const configuredStopLoss = Number(config?.stopLoss || 1);
      const configuredStake = Number(config?.stake);
      const configuredRunCount = Number(config?.runCount || 1);
      const configuredRiskCap = Number(config?.riskCap);
      const configuredMartingale = config?.martingale as { enabled?: boolean; multiplier?: number; maxStake?: number } | undefined;
      const configuredMartingaleEnabled = configuredMartingale?.enabled === true;
      const configuredMartingaleMultiplier = Number(configuredMartingale?.multiplier || 2);
      const configuredMartingaleMaxStake = Number(configuredMartingale?.maxStake || configuredStake);
      const configuredConsecutiveLossLimit = Number(config?.consecutiveLossLimit || 3);
      if (!bot) {
        return errorResponse(res, 409, "Bot not found", "Review the saved bot before starting a new session.");
      }
      if (config?.mode !== "market_observer") {
        return errorResponse(res, 403, "Bot is monitor-only", "Recovery and monitoring bots cannot create trade proposals.");
      }
      if (
        bot.symbol !== symbol
        || configuredContractType !== requestedContractType
        || configuredDuration !== duration
        || configuredBarrier !== (barrier || null)
        || configuredStopLoss !== stopLoss
        || configuredStake !== stake
        || configuredRunCount !== runCount
        || configuredRiskCap !== riskCap
        || configuredMartingaleEnabled !== martingaleEnabled
        || configuredMartingaleMultiplier !== martingaleMultiplier
        || configuredMartingaleMaxStake !== martingaleMaxStake
        || configuredConsecutiveLossLimit !== consecutiveLossLimit
      ) {
        return errorResponse(res, 409, "Bot plan changed", "Review the saved bot settings before starting a new session.");
      }
      await db.insert(botRuns).values({
        id: sessionId as string,
        ownerKey,
        botId: bot.id,
        mode: "execution_plan",
        status: "active",
        contractType: requestedContractType,
        duration,
        barrier: barrier || null,
        stopLoss: String(stopLoss),
        accountId: account.account_id,
        accountType: account.account_type,
        stake: String(stake),
        runCount: Number(runCount),
        riskCap: String(riskCap),
        result: { sessionId, symbol, contractType: requestedContractType },
      }).onConflictDoNothing();
      const [plan] = await db.select().from(botRuns).where(and(
        eq(botRuns.id, sessionId as string),
        eq(botRuns.ownerKey, ownerKey),
        eq(botRuns.botId, bot.id),
      )).limit(1);
      if (
        !plan
        || plan.mode !== "execution_plan"
        || plan.accountId !== account.account_id
        || plan.contractType !== requestedContractType
        || plan.duration !== duration
        || plan.barrier !== (barrier || null)
        || Number(plan.stopLoss) !== stopLoss
        || Number(plan.stake) !== stake
        || plan.runCount !== runCount
        || Number(plan.riskCap) !== riskCap
      ) {
        return errorResponse(res, 409, "Bot session mismatch", "Start a fresh reviewed bot session.");
      }
    }
    const availableBalance = Number(account.balance);
    if (!Number.isFinite(availableBalance) || availableBalance <= 0) {
      return errorResponse(res, 502, "Account balance unavailable", "Reconnect or refresh the selected Deriv account.");
    }
    if (stake >= availableBalance) {
      return errorResponse(res, 400, "Stake exceeds available balance", "Enter a stake below the selected account balance.");
    }
    executionStage = "contract_availability";
    const availability = await derivRequest(session.accessToken, { contracts_for: symbol }, session.accountId);
    const offered = new Set((availability.contracts_for?.available || []).map((item: any) => String(item.contract_type)));
    if (!offered.has(requestedContractType)) return errorResponse(res, 400, "Contract unavailable", `${requestedContractType} is not offered by Deriv for ${symbol}.`);
    executionStage = "proposal";
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
      proposalToken: seal({ id: proposal.id, nonce: crypto.randomUUID(), accountId: account.account_id, source, botId, symbol, contractType: requestedContractType, stake, duration, barrier: barrier || null, stopLoss, runCount, riskCap, martingaleEnabled, martingaleMultiplier, martingaleMaxStake, consecutiveLossLimit, sessionId, askPrice, expiresAt: Date.now() + 30_000 }),
      symbol, contractType: requestedContractType, stake, duration, barrier: barrier || null,
      askPrice,
      payout: Number.isFinite(Number(proposal.payout)) ? Number(proposal.payout) : null,
      longcode: proposal.longcode || null,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      stopLossNote: "Stop loss is requested after Deriv accepts the contract; any rejection is reported explicitly.",
    });
  } catch (error) {
    const message = safeErrorMessage(error);
    req.log?.warn({ stage: executionStage, accountType: executionAccountType, symbol, contractType: requestedContractType, message }, "trade proposal failed");
    return errorResponse(res, 502, "Proposal unavailable", `${executionStage}: ${message}`);
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
  const runCount = req.body?.run_count === undefined ? null : Number(req.body.run_count);
  const riskCap = req.body?.risk_cap === undefined ? null : Number(req.body.risk_cap);
  const martingaleEnabled = req.body?.martingale_enabled === true;
  const martingaleMultiplier = req.body?.martingale_multiplier === undefined ? null : Number(req.body.martingale_multiplier);
  const martingaleMaxStake = req.body?.martingale_max_stake === undefined ? null : Number(req.body.martingale_max_stake);
  const consecutiveLossLimit = req.body?.consecutive_loss_limit === undefined ? null : Number(req.body.consecutive_loss_limit);
  const source = String(req.body?.source || "manual");
  const sessionId = typeof req.body?.session_id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(req.body.session_id)
    ? req.body.session_id
    : null;
  const requestedAccountId = typeof req.body?.account_id === "string" ? req.body.account_id : null;
  const botId = typeof req.body?.bot_id === "string" && /^[0-9a-f-]{36}$/i.test(req.body.bot_id) ? req.body.bot_id : null;
  if (!session.accountId || !requestedAccountId || requestedAccountId !== session.accountId) {
    return errorResponse(res, 409, "Trading account changed", "Review the order again using the currently selected account.");
  }
  const validationErrors = [
    !contractType ? "Choose a supported Deriv contract type." : "",
    !supportedVolatilitySymbols.has(symbol) ? "Choose a supported Volatility 10–100 market." : "",
    !Number.isFinite(stake) || stake <= 0 ? "Enter a valid stake amount." : "",
    !Number.isInteger(duration) || duration < 1 ? "Duration must be at least 1 tick." : "",
    duration > maxDuration ? `Duration cannot exceed ${maxDuration} ticks.` : "",
    contractType && barrierContractTypes.has(contractType) && !/^[0-9]$/.test(barrier || "") ? "Choose a digit barrier from 0 to 9." : "",
    stopLoss !== undefined && (!Number.isFinite(stopLoss) || stopLoss <= 0) ? "Stop loss must be greater than 0." : "",
    req.body?.source === "bot_assisted" && (!Number.isInteger(runCount) || Number(runCount) < 1 || Number(runCount) > 10) ? "Bot run count must be from 1 to 10." : "",
    req.body?.source === "bot_assisted" && (!Number.isFinite(riskCap) || Number(riskCap) <= 0 || (martingaleEnabled ? Number(martingaleMaxStake) : stake) * Number(runCount) > Number(riskCap)) ? "Bot plan exceeds its risk cap." : "",
    req.body?.source === "bot_assisted" && (!Number.isFinite(martingaleMultiplier) || Number(martingaleMultiplier) < 1 || Number(martingaleMultiplier) > 5) ? "Martingale multiplier must be between 1 and 5." : "",
    req.body?.source === "bot_assisted" && (!Number.isFinite(martingaleMaxStake) || Number(martingaleMaxStake) < stake) ? "Martingale max stake must be at least the starting stake." : "",
    req.body?.source === "bot_assisted" && (!Number.isInteger(consecutiveLossLimit) || Number(consecutiveLossLimit) < 1 || Number(consecutiveLossLimit) > 10) ? "Consecutive-loss guard must be from 1 to 10." : "",
    req.body?.source === "bot_assisted" && (!botId || !sessionId) ? "A saved bot and run session are required." : "",
    source !== "bot_assisted" && (req.body?.bot_id !== undefined || req.body?.run_count !== undefined || req.body?.risk_cap !== undefined || req.body?.martingale_enabled !== undefined || req.body?.martingale_multiplier !== undefined || req.body?.martingale_max_stake !== undefined || req.body?.consecutive_loss_limit !== undefined)
      ? "Bot plan fields require bot-assisted execution." : "",
  ].filter(Boolean);
  if (validationErrors.length) {
    return errorResponse(res, 400, "Invalid trade parameters", validationErrors.join(" "));
  }
  const validatedContractType = contractType as string;

  let executionStage = "list_deriv_accounts";
  let executionAccountType: string | undefined;
  try {
    const accounts = await listDerivAccounts(session.accessToken);
    executionStage = "account_selection";
    const account = chooseAccount(accounts, undefined, session.accountId);
    const loginId = String(account?.account_id || "");
    const isDemoAccount = account?.account_type === "demo";
    if (!loginId || !account) {
      logTradeStageError(req, executionStage, new Error("Account identity unavailable"), executionAccountType, symbol);
      return errorResponse(res, 502, "Account identity unavailable");
    }
    executionAccountType = account.account_type;
    const policy = accountTradingPolicy(account);
    if (!policy.allowed) return errorResponse(res, isDemoAccount ? 503 : 403, policy.error || "Account trading unavailable", policy.message);
    executionStage = "balance_validation";
    const availableBalance = Number(account.balance);
    if (!Number.isFinite(availableBalance) || availableBalance <= 0) {
      logTradeStageError(req, executionStage, new Error("Account balance unavailable"), executionAccountType, symbol);
      return errorResponse(res, 502, "Account balance unavailable", "Reconnect or refresh the selected Deriv account.");
    }
    if (stake >= availableBalance) {
      return errorResponse(res, 400, "Stake exceeds available balance", "Enter a stake below the selected account balance.");
    }
    if (!isDemoAccount && !allowedSymbols.has(symbol)) {
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
    if (!currency) {
      logTradeStageError(req, executionStage, new Error("Account currency unavailable"), executionAccountType, symbol);
      return errorResponse(res, 502, "Account currency unavailable");
    }

    executionStage = "contract_availability";
    const availability = await derivRequest(session.accessToken, { contracts_for: symbol }, session.accountId);
    const availableContractTypes = new Set(
      (Array.isArray(availability.contracts_for?.available) ? availability.contracts_for.available : [])
        .map((item: any) => String(item.contract_type)),
    );
    if (!availableContractTypes.has(validatedContractType)) {
      return errorResponse(res, 400, "Contract unavailable", `${validatedContractType} is not offered by Deriv for ${symbol}.`);
    }

    executionStage = "proposal_unseal";
    if (!req.body?.proposal_token) return errorResponse(res, 409, "Proposal review required", "Review a provider-backed proposal before execution.");
    const reviewed = unseal(req.body.proposal_token);
    const matches = reviewed?.accountId === loginId && reviewed?.source === source && reviewed?.symbol === symbol && reviewed?.contractType === validatedContractType
      && reviewed?.stake === stake && reviewed?.duration === duration && reviewed?.barrier === (barrier || null)
      && reviewed?.stopLoss === (stopLoss ?? null) && reviewed?.botId === botId && reviewed?.runCount === runCount && reviewed?.riskCap === riskCap
      && reviewed?.martingaleEnabled === martingaleEnabled && reviewed?.martingaleMultiplier === martingaleMultiplier && reviewed?.martingaleMaxStake === martingaleMaxStake
      && reviewed?.consecutiveLossLimit === consecutiveLossLimit
      && reviewed?.sessionId === sessionId && reviewed?.expiresAt > Date.now();
    if (!matches || !reviewed?.id || !reviewed?.nonce || !Number.isFinite(reviewed?.askPrice) || reviewed.askPrice <= 0) return errorResponse(res, 409, "Proposal expired or changed", "Review the current order again before execution.");
    executionStage = "consumed_trade_proposals_insert";
    let consumed: Array<{ nonce: string }>;
    try {
      consumed = await db.insert(consumedTradeProposals).values({
        nonce: reviewed.nonce,
        ownerKey: ownerKeyFor(account.account_id || loginId),
        proposalId: reviewed.id,
      }).onConflictDoNothing({ target: consumedTradeProposals.nonce }).returning({ nonce: consumedTradeProposals.nonce });
    } catch (error) {
      logTradeStageError(req, executionStage, error, executionAccountType, symbol);
      if (isConsumedProposalConflict(error)) {
        return errorResponse(res, 409, "Proposal already used", "Request a fresh Deriv proposal before running this session again.");
      }
      return errorResponse(
        res,
        502,
        "Trade request failed",
        "Proposal review could not be recorded. No purchase request was sent.",
      );
    }
    if (!consumed.length) return errorResponse(res, 409, "Proposal already used", "This proposal has already been submitted. Review a fresh proposal before another order.");
    if (reviewed.source === "bot_assisted") {
      executionStage = "bot_runs_lookup";
      const [plan] = await db.select().from(botRuns).where(and(
        eq(botRuns.id, sessionId as string),
        eq(botRuns.ownerKey, ownerKeyFor(loginId)),
        eq(botRuns.botId, botId as string),
        eq(botRuns.accountId, loginId),
        eq(botRuns.status, "active"),
      )).limit(1);
      if (
        !plan
        || plan.contractType !== reviewed.contractType
        || plan.duration !== reviewed.duration
        || plan.barrier !== reviewed.barrier
        || Number(plan.stopLoss) !== Number(reviewed.stopLoss)
        || Number(plan.stake) !== Number(reviewed.stake)
        || plan.runCount !== reviewed.runCount
        || Number(plan.riskCap) !== Number(reviewed.riskCap)
      ) {
        return errorResponse(res, 409, "Bot plan changed", "The saved bot execution plan no longer matches this proposal.");
      }
      executionStage = "bot_reservation";
      const reserved = await db.update(botRuns).set({
        acceptedRuns: sql`${botRuns.acceptedRuns} + 1`,
        updatedAt: new Date(),
      }).where(and(
        eq(botRuns.id, sessionId as string),
        eq(botRuns.ownerKey, ownerKeyFor(loginId)),
        eq(botRuns.botId, botId as string),
        eq(botRuns.accountId, loginId),
        eq(botRuns.status, "active"),
        lt(botRuns.acceptedRuns, Number(runCount)),
        sql`${botRuns.acceptedRuns} * ${botRuns.stake} + ${stake} <= ${botRuns.riskCap}`,
      )).returning({ id: botRuns.id });
      if (!reserved.length) {
        return errorResponse(res, 409, "Bot plan limit reached", "This bot session has no remaining reviewed runs or risk capacity.");
      }
    }
    executionStage = "deriv_proposal_and_buy";
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
    if (buy.error) {
      logTradeStageError(req, executionStage, buy.error, executionAccountType, symbol);
      return errorResponse(res, 502, "Trade request failed", buy.error.message);
    }
    const contractId = buy.buy?.contract_id ? Number(buy.buy.contract_id) : null;
    if (!contractId || !Number.isFinite(contractId)) {
      logTradeStageError(req, executionStage, new Error("Deriv did not return an accepted contract ID"), executionAccountType, symbol);
      return errorResponse(res, 502, "Trade not accepted", "Deriv did not return an accepted contract ID. No transaction was recorded.");
    }
    const buyPrice = transactionNumber(buy.buy?.buy_price ?? reviewed.askPrice);
    const entrySpot = transactionNumber(buy.buy?.entry_spot);
    let stopLossApplied: boolean | null = null;
    let stopLossMessage: string | null = null;
    if (stopLoss !== undefined && contractId) {
      executionStage = "stop_loss";
      try {
        await derivRequest(session.accessToken, {
          contract_update: 1,
          contract_id: contractId,
          limit_order: { stop_loss: stopLoss },
        }, session.accountId);
        stopLossApplied = true;
      } catch (error) {
        logTradeStageError(req, executionStage, error, executionAccountType, symbol);
        stopLossApplied = false;
        stopLossMessage = error instanceof Error ? error.message : "Deriv rejected the stop loss";
      }
    }
    executionStage = "transaction_persistence";
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
        botId,
        buyPrice,
        entrySpot,
        exitSpot: null,
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
       contractType: validatedContractType,
       buyPrice,
       entrySpot,
       exitSpot: null,
      stopLossApplied,
      stopLossMessage,
    });
  } catch (error) {
    const diagnostic = tradeErrorDiagnostic(error);
    logTradeStageError(req, executionStage, error, executionAccountType, symbol);
    const diagnosticDetails = [
      diagnostic.postgresCode ? `postgresCode=${diagnostic.postgresCode}` : "",
      diagnostic.postgresConstraint ? `postgresConstraint=${diagnostic.postgresConstraint}` : "",
    ].filter(Boolean).join(" ");
    return errorResponse(
      res,
      502,
      "Trade request failed",
      `${executionStage}: ${diagnostic.sanitizedErrorMessage}${diagnosticDetails ? ` (${diagnosticDetails})` : ""}`,
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
    if (state.targetAccount && selectedAccount?.account_type !== state.targetAccount) {
        clearOAuthCookie(res);
        return res.redirect(`/initializing?account_switch=mismatch&expected=${state.targetAccount}`);
    }
    if (selectedAccount?.account_id) {
      nextSession = { ...nextSession, accountId: selectedAccount.account_id };
    }
    setSessionCookie(res, nextSession);
    clearOAuthCookie(res);
    if (!selectedAccount?.account_id) {
      return res.redirect("/initializing?account_required=1");
    }
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