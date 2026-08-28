import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import WebSocket, { type RawData } from "ws";

type SessionValue = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
};

type OAuthState = {
  verifier: string;
  mode: "login" | "signup";
  nonce: string;
  issuedAt: number;
};

const router = Router();
const isProduction = process.env.NODE_ENV === "production";
const baseUrl = (
  process.env.BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5000")
).replace(/\/$/, "");
const redirectUri = `${baseUrl}/oauth/callback`;
const cookieSecure = baseUrl.startsWith("https://");
const sessionSecret = process.env.SESSION_SECRET || (
  isProduction ? "" : crypto.randomBytes(32).toString("hex")
);
const clientId = process.env.DERIV_CLIENT_ID || "";
const publicAppId = process.env.DERIV_PUBLIC_APP_ID || "";
const affiliateParam = process.env.DERIV_AFFILIATE_PARAM || "t";
const affiliateToken = process.env.DERIV_AFFILIATE_TOKEN || "";
const affiliateId = process.env.DERIV_AFFILIATE_ID || "";
const campaign = process.env.DERIV_CAMPAIGN || "protraders-fx";
const scope = process.env.DERIV_SCOPE || "trade account_manage";
const tradingEnabled = process.env.TRADING_ENABLED === "true";
const demoOnly = process.env.TRADING_DEMO_ONLY !== "false";
const maxStake = positiveNumber(process.env.TRADING_MAX_STAKE, 10);
const maxDuration = positiveInteger(process.env.TRADING_MAX_DURATION, 3600);
const allowedSymbols = new Set(
  String(process.env.TRADING_ALLOWED_SYMBOLS || "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean),
);

const analytics = {
  visitors: 0,
  registrations: 0,
  events: [] as Array<{ type: string; at: string; path?: string }>,
};

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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

async function getSession(req: Request, res: Response) {
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
    };
    setSessionCookie(res, refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

function oauthRequest(mode: "login" | "signup") {
  if (!clientId) throw new Error("DERIV_CLIENT_ID is not configured");
  if (mode === "signup" && !affiliateToken) {
    throw new Error("Deriv signup attribution is not configured");
  }

  const verifier = encode(crypto.randomBytes(64));
  const nonce = encode(crypto.randomBytes(16));
  const state: OAuthState = { verifier, mode, nonce, issuedAt: Date.now() };
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

function beginOAuth(mode: "login" | "signup", res: Response) {
  try {
    const request = oauthRequest(mode);
    res.cookie(
      "protraders_oauth_state",
      seal({ nonce: request.nonce }),
      cookieOptions(10 * 60 * 1000),
    );
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
  max: 180,
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
    frontendConfigured: false,
    tradingEnabled,
    demoOnly,
    readyForControlledLiveTest: Boolean(
      baseUrl.startsWith("https://") &&
      oauthClientConfigured &&
      partnerTrackingConfigured &&
      sessionSecretConfigured &&
      publicAppConfigured,
    ),
  });
});

router.get("/deriv/login", (_req, res) => beginOAuth("login", res));
router.get("/deriv/signup", (_req, res) => beginOAuth("signup", res));

router.get("/session", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return res.json({ authenticated: false });
  return res.json({ authenticated: true, expiresAt: session.expiresAt });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("protraders_session", cookieOptions(0));
  clearOAuthCookie(res);
  return res.status(204).end();
});

router.post("/track", (req, res) => {
  const type = String(req.body?.type || "page_view").slice(0, 40);
  if (type === "page_view") analytics.visitors += 1;
  analytics.events.push({
    type,
    at: new Date().toISOString(),
    path: String(req.body?.path || "/").slice(0, 200),
  });
  if (analytics.events.length > 5000) {
    analytics.events.splice(0, analytics.events.length - 5000);
  }
  return res.status(204).end();
});

router.get("/analytics", (_req, res) => {
  res.json({
    visitors: analytics.visitors,
    registrations: analytics.registrations,
    oauthSuccesses: analytics.events.filter(
      (event) => event.type === "oauth_login_success" ||
        event.type === "oauth_signup_success",
    ).length,
    fundedAccounts: null,
    note: "Funded-account status must be confirmed in Deriv Partner Hub; it is not fabricated here.",
    ephemeral: true,
  });
});

async function derivRequest(accessToken: string, payload: Record<string, unknown>) {
  if (!publicAppId) throw new Error("DERIV_PUBLIC_APP_ID is not configured");

  return new Promise<any>((resolve, reject) => {
    const socket = new WebSocket(
      `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(publicAppId)}`,
    );
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

    socket.on("open", () => socket.send(JSON.stringify({ authorize: accessToken })));
    socket.on("message", (raw: RawData) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (data.error) {
        finish(reject, new Error(data.error.message || "Deriv API error"));
      } else if (data.msg_type === "authorize") {
        socket.send(JSON.stringify(payload));
      } else if (data.msg_type) {
        finish(resolve, data);
      }
    });
    socket.on("error", (error: Error) => finish(reject, error));
    socket.on("close", () => clearTimeout(timer));
  });
}

router.get("/account", async (req, res) => {
  const session = await getSession(req, res);
  if (!session) return errorResponse(res, 401, "Not authenticated");

  try {
    const data = await derivRequest(session.accessToken, { balance: 1 });
    const account = data.balance || {};
    return res.json({
      authenticated: true,
      balance: account.balance ?? null,
      currency: account.currency ?? null,
      loginid: account.loginid ?? null,
      openPnl: null,
    });
  } catch (error) {
    return errorResponse(
      res,
      502,
      "Account data unavailable",
      error instanceof Error ? error.message : undefined,
    );
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
  const contractType = ["CALL", "PUT"].includes(req.body?.contract_type)
    ? req.body.contract_type as "CALL" | "PUT"
    : null;
  const stake = Number(req.body?.stake);
  const duration = Number(req.body?.duration);
  if (
    !contractType ||
    !/^([A-Z0-9_]+)$/.test(symbol) ||
    (allowedSymbols.size > 0 && !allowedSymbols.has(symbol)) ||
    !Number.isFinite(stake) ||
    stake <= 0 ||
    stake > maxStake ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > maxDuration
  ) {
    return errorResponse(res, 400, "Invalid trade parameters");
  }

  try {
    const account = await derivRequest(session.accessToken, { balance: 1 });
    const loginId = String(account.balance?.loginid || "");
    if (demoOnly && !/^VRTC/i.test(loginId)) {
      return errorResponse(
        res,
        403,
        "Demo account required",
        "Live trading is disabled by TRADING_DEMO_ONLY.",
      );
    }
    const currency = account.balance?.currency;
    if (!currency) return errorResponse(res, 502, "Account currency unavailable");

    const proposal = await derivRequest(session.accessToken, {
      proposal: 1,
      amount: stake,
      basis: "stake",
      contract_type: contractType,
      currency,
      duration,
      duration_unit: "t",
      symbol,
    });
    if (!proposal.proposal?.id) {
      return errorResponse(res, 502, "Deriv did not return a proposal");
    }
    const buy = await derivRequest(session.accessToken, {
      buy: proposal.proposal.id,
      price: stake,
    });
    if (buy.error) return errorResponse(res, 502, "Trade request failed", buy.error.message);
    return res.json({
      ok: true,
      message: `Trade opened on ${symbol}. Contract ${buy.buy?.contract_id || "created"}.`,
      contractId: buy.buy?.contract_id || null,
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

    setSessionCookie(res, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    });
    clearOAuthCookie(res);
    analytics.events.push({
      type: state.mode === "signup" ? "oauth_signup_success" : "oauth_login_success",
      at: new Date().toISOString(),
    });
    if (state.mode === "signup") analytics.registrations += 1;
    return res.redirect("/workspace.html");
  } catch (error) {
    clearOAuthCookie(res);
    console.error("[oauth]", error instanceof Error ? error.message : error);
    return res.redirect("/?oauth_error=oauth_failed");
  }
}

export default router;