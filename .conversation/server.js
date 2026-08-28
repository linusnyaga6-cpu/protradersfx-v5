require('dotenv').config();

const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_VERCEL = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_URL);
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || IS_VERCEL;
const BASE_URL = (process.env.BASE_URL || (
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`
)).replace(/\/$/, '');
const PUBLIC_DIR = path.join(__dirname, 'public');
const REDIRECT_URI = `${BASE_URL}/oauth/callback`;
const COOKIE_SECURE = BASE_URL.startsWith('https://');

const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || '';
const DERIV_PUBLIC_APP_ID = process.env.DERIV_PUBLIC_APP_ID || '';
const DERIV_AFFILIATE_PARAM = process.env.DERIV_AFFILIATE_PARAM || 't';
const DERIV_AFFILIATE_TOKEN = process.env.DERIV_AFFILIATE_TOKEN || '';
const DERIV_AFFILIATE_ID = process.env.DERIV_AFFILIATE_ID || '';
const DERIV_CAMPAIGN = process.env.DERIV_CAMPAIGN || 'protraders-fx';
const DERIV_SCOPE = process.env.DERIV_SCOPE || 'trade account_manage';
const SESSION_SECRET = process.env.SESSION_SECRET || (
  IS_PRODUCTION ? '' : crypto.randomBytes(32).toString('hex')
);
const TRADING_ENABLED = process.env.TRADING_ENABLED === 'true';
const TRADING_DEMO_ONLY = process.env.TRADING_DEMO_ONLY !== 'false';
const TRADING_MAX_STAKE = positiveNumber(process.env.TRADING_MAX_STAKE, 10);
const TRADING_MAX_DURATION = positiveInteger(process.env.TRADING_MAX_DURATION, 3600);
const TRADING_ALLOWED_SYMBOLS = new Set(
  String(process.env.TRADING_ALLOWED_SYMBOLS || '')
    .split(',')
    .map((symbol) => symbol.trim())
    .filter(Boolean)
);

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function jsonError(res, status, error, message) {
  return res.status(status).json({ error, ...(message ? { message } : {}) });
}

// Vercel's deployment filesystem is read-only. /tmp is writable but ephemeral,
// so analytics must never be treated as durable production storage.
const DATA_FILE = process.env.ANALYTICS_FILE || (
  IS_VERCEL
    ? path.join('/tmp', 'protradersfx', 'analytics.json')
    : path.join(__dirname, 'data', 'analytics.json')
);

function emptyData() {
  return { visitors: 0, registrations: 0, events: [] };
}

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(emptyData(), null, 2), 'utf8');
  }
}

try {
  ensureDataFile();
} catch (error) {
  // A failed analytics store must not prevent health checks or static files
  // from serving. The write route reports the failure explicitly.
  console.error('[analytics] unable to initialize store:', error.message);
}

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      visitors: Number(data.visitors) || 0,
      registrations: Number(data.registrations) || 0,
      events: Array.isArray(data.events) ? data.events : []
    };
  } catch {
    return emptyData();
  }
}

function writeData(data) {
  const directory = path.dirname(DATA_FILE);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryFile = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporaryFile, DATA_FILE);
}

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function key() {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return crypto.createHash('sha256').update(SESSION_SECRET).digest();
}

function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final()
  ]);
  return `${base64url(iv)}.${base64url(cipher.getAuthTag())}.${base64url(encrypted)}`;
}

function unseal(value) {
  const [iv, tag, encrypted] = String(value || '').split('.');
  if (!iv || !tag || !encrypted) throw new Error('Invalid session');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final()
  ]).toString('utf8'));
}

function randomVerifier() {
  return base64url(crypto.randomBytes(64));
}

function challenge(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge,
    path: '/'
  };
}

function clearOAuthCookie(res) {
  res.clearCookie('protraders_oauth_state', cookieOptions(0));
}

function readRawSession(req) {
  try {
    const sessionValue = unseal(req.cookies?.protraders_session);
    if (!sessionValue?.accessToken || !Number.isFinite(sessionValue.expiresAt)) {
      return null;
    }
    return sessionValue;
  } catch {
    return null;
  }
}

function setSessionCookie(res, sessionValue) {
  const maxAge = Math.max(0, sessionValue.expiresAt - Date.now());
  res.cookie('protraders_session', seal(sessionValue), cookieOptions(maxAge));
}

async function getSession(req, res) {
  const current = readRawSession(req);
  if (!current) return null;

  // Refresh shortly before expiry when Deriv supplied a refresh token.
  if (current.expiresAt > Date.now() + 30_000 || !current.refreshToken) {
    return current.expiresAt > Date.now() ? current : null;
  }

  try {
    const response = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: DERIV_CLIENT_ID,
        refresh_token: current.refreshToken
      })
    });
    if (!response.ok) return null;
    const token = await response.json();
    if (!token.access_token) return null;
    const refreshed = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || current.refreshToken,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000
    };
    setSessionCookie(res, refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

function allowedOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length ? configured : [BASE_URL];
}

app.use(cors({
  origin(origin, callback) {
    // Same-origin requests and non-browser health probes have no Origin header.
    if (!origin || allowedOrigins().includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed'));
  },
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https://auth.deriv.com', 'https://api.derivws.com', 'wss://*.derivws.com'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(cookieParser());
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'protraders-fx', time: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json({
    configured: Boolean(DERIV_CLIENT_ID),
    loginConfigured: Boolean(DERIV_CLIENT_ID),
    signupConfigured: Boolean(DERIV_CLIENT_ID && DERIV_AFFILIATE_TOKEN),
    publicAppId: DERIV_PUBLIC_APP_ID,
    partnerParam: DERIV_AFFILIATE_PARAM,
    campaign: DERIV_CAMPAIGN
  });
});

app.post('/api/track', (req, res) => {
  const type = String(req.body?.type || 'page_view').slice(0, 40);
  const data = readData();
  if (type === 'page_view') data.visitors += 1;
  data.events.push({
    type,
    at: new Date().toISOString(),
    path: String(req.body?.path || '/').slice(0, 200)
  });
  if (data.events.length > 5000) data.events = data.events.slice(-5000);
  try {
    writeData(data);
    return res.status(204).end();
  } catch (error) {
    console.error('[analytics] write failed:', error.message);
    return jsonError(res, 503, 'Analytics unavailable');
  }
});

app.get('/api/analytics', (req, res) => {
  const data = readData();
  res.json({
    visitors: data.visitors,
    registrations: data.registrations,
    oauthSuccesses: data.events.filter(
      (event) => event.type === 'oauth_login_success' || event.type === 'oauth_signup_success'
    ).length,
    fundedAccounts: null,
    note: 'Funded-account status must be confirmed in Deriv Partner Hub; it is not fabricated here.',
    ephemeral: IS_VERCEL
  });
});

function oauthRequest(mode) {
  if (!DERIV_CLIENT_ID) throw new Error('DERIV_CLIENT_ID is not configured');
  if (mode === 'signup' && !DERIV_AFFILIATE_TOKEN) {
    throw new Error('Deriv signup attribution is not configured');
  }

  const verifier = randomVerifier();
  const nonce = base64url(crypto.randomBytes(16));
  const state = seal({ verifier, mode, nonce, iat: Date.now() });
  const parameters = new URLSearchParams({
    response_type: 'code',
    client_id: DERIV_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: DERIV_SCOPE,
    state,
    code_challenge: challenge(verifier),
    code_challenge_method: 'S256'
  });

  if (mode === 'signup') {
    parameters.set('prompt', 'registration');
    parameters.set(DERIV_AFFILIATE_PARAM, DERIV_AFFILIATE_TOKEN);
    parameters.set('utm_campaign', DERIV_CAMPAIGN);
    parameters.set('utm_medium', 'affiliate');
    if (DERIV_AFFILIATE_ID) parameters.set('utm_source', DERIV_AFFILIATE_ID);
  }

  return {
    url: `https://auth.deriv.com/oauth2/auth?${parameters.toString()}`,
    nonce
  };
}

function beginOAuth(mode, req, res) {
  try {
    const request = oauthRequest(mode);
    res.cookie(
      'protraders_oauth_state',
      seal({ nonce: request.nonce }),
      cookieOptions(10 * 60 * 1000)
    );
    return res.redirect(request.url);
  } catch (error) {
    return jsonError(res, 503, 'OAuth unavailable', error.message);
  }
}

app.get('/api/deriv/login', (req, res) => beginOAuth('login', req, res));
app.get('/api/deriv/signup', (req, res) => beginOAuth('signup', req, res));

app.get('/oauth/callback', async (req, res) => {
  try {
    if (req.query.error) {
      clearOAuthCookie(res);
      return res.redirect(`/?oauth_error=${encodeURIComponent(String(req.query.error))}`);
    }

    const state = unseal(req.query.state);
    const browserState = unseal(req.cookies?.protraders_oauth_state);
    const stateNonce = Buffer.from(String(state?.nonce || ''));
    const browserNonce = Buffer.from(String(browserState?.nonce || ''));
    const nonceMatches = stateNonce.length === browserNonce.length &&
      stateNonce.length > 0 &&
      crypto.timingSafeEqual(stateNonce, browserNonce);

    if (
      !state?.verifier ||
      !['login', 'signup'].includes(state.mode) ||
      !Number.isFinite(state.iat) ||
      Date.now() - state.iat > 600_000 ||
      !nonceMatches ||
      !req.query.code
    ) {
      throw new Error('Invalid or expired OAuth state');
    }

    const response = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: DERIV_CLIENT_ID,
        code: String(req.query.code),
        code_verifier: state.verifier,
        redirect_uri: REDIRECT_URI
      })
    });
    if (!response.ok) throw new Error(`Token exchange failed (${response.status})`);
    const token = await response.json();
    if (!token.access_token) throw new Error('No access token returned');

    const sessionValue = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000
    };
    setSessionCookie(res, sessionValue);
    clearOAuthCookie(res);

    const data = readData();
    data.events.push({
      type: state.mode === 'signup' ? 'oauth_signup_success' : 'oauth_login_success',
      at: new Date().toISOString()
    });
    if (state.mode === 'signup') {
      data.registrations += 1;
      data.events.push({ type: 'registration_complete', at: new Date().toISOString() });
    }
    try {
      writeData(data);
    } catch (error) {
      console.error('[analytics] OAuth event write failed:', error.message);
    }
    return res.redirect('/workspace.html');
  } catch (error) {
    clearOAuthCookie(res);
    console.error('[oauth]', error.message);
    return res.redirect('/?oauth_error=oauth_failed');
  }
});

app.get('/api/session', async (req, res) => {
  const sessionValue = await getSession(req, res);
  if (!sessionValue) return res.json({ authenticated: false });
  return res.json({ authenticated: true, expiresAt: sessionValue.expiresAt });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('protraders_session', cookieOptions(0));
  clearOAuthCookie(res);
  return res.status(204).end();
});

function derivRequest(accessToken, payload) {
  const appId = DERIV_PUBLIC_APP_ID || (IS_PRODUCTION ? '' : '1089');
  if (!appId) return Promise.reject(new Error('DERIV_PUBLIC_APP_ID is not configured'));

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`
    );
    let settled = false;
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error('Deriv request timeout'));
    }, 12_000);

    function finish(callback, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      callback(value);
    }

    socket.on('open', () => socket.send(JSON.stringify({ authorize: accessToken })));
    socket.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (data.error) return finish(reject, new Error(data.error.message || 'Deriv API error'));
      if (data.msg_type === 'authorize') return socket.send(JSON.stringify(payload));
      if (data.msg_type) return finish(resolve, data);
    });
    socket.on('error', (error) => finish(reject, error));
    socket.on('close', () => clearTimeout(timer));
  });
}

app.get('/api/account', async (req, res) => {
  const sessionValue = await getSession(req, res);
  if (!sessionValue) return jsonError(res, 401, 'Not authenticated');

  try {
    const data = await derivRequest(sessionValue.accessToken, { balance: 1 });
    const account = data.balance || {};
    return res.json({
      authenticated: true,
      balance: account.balance ?? null,
      currency: account.currency ?? null,
      loginid: account.loginid ?? null,
      // No open-position query exists in this adapter; do not present 0 as a
      // fabricated trading result.
      openPnl: null
    });
  } catch (error) {
    return jsonError(res, 502, 'Account data unavailable', error.message);
  }
});

app.post('/api/trades', async (req, res) => {
  if (!TRADING_ENABLED) {
    return jsonError(res, 503, 'Trading disabled', 'Enable TRADING_ENABLED only after the controlled demo test passes.');
  }

  const sessionValue = await getSession(req, res);
  if (!sessionValue) return jsonError(res, 401, 'Not authenticated');

  const symbol = String(req.body?.symbol || 'R_100');
  const contractType = ['CALL', 'PUT'].includes(req.body?.contract_type)
    ? req.body.contract_type
    : null;
  const stake = Number(req.body?.stake);
  const duration = Number(req.body?.duration);

  if (
    !contractType ||
    !/^([A-Z0-9_]+)$/.test(symbol) ||
    (TRADING_ALLOWED_SYMBOLS.size > 0 && !TRADING_ALLOWED_SYMBOLS.has(symbol)) ||
    !Number.isFinite(stake) ||
    stake <= 0 ||
    stake > TRADING_MAX_STAKE ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > TRADING_MAX_DURATION
  ) {
    return jsonError(res, 400, 'Invalid trade parameters');
  }

  try {
    const account = await derivRequest(sessionValue.accessToken, { balance: 1 });
    const loginid = String(account.balance?.loginid || '');
    if (TRADING_DEMO_ONLY && !/^VRTC/i.test(loginid)) {
      return jsonError(res, 403, 'Demo account required', 'Live trading is disabled by TRADING_DEMO_ONLY.');
    }

    const currency = account.balance?.currency;
    if (!currency) return jsonError(res, 502, 'Account currency unavailable');

    const proposal = await derivRequest(sessionValue.accessToken, {
      proposal: 1,
      amount: stake,
      basis: 'stake',
      contract_type: contractType,
      currency,
      duration,
      duration_unit: 't',
      symbol
    });
    if (!proposal.proposal?.id) return jsonError(res, 502, 'Deriv did not return a proposal');

    const buy = await derivRequest(sessionValue.accessToken, {
      buy: proposal.proposal.id,
      price: stake
    });
    if (buy.error) return jsonError(res, 502, 'Trade request failed', buy.error.message);
    return res.json({
      ok: true,
      message: `Trade opened on ${symbol}. Contract ${buy.buy?.contract_id || 'created'}.`,
      contractId: buy.buy?.contract_id || null
    });
  } catch (error) {
    return jsonError(res, 502, 'Trade request failed', error.message);
  }
});

app.post('/api/bot', async (req, res) => {
  const sessionValue = await getSession(req, res);
  if (!sessionValue) return jsonError(res, 401, 'Not authenticated');
  const action = req.body?.action === 'start' ? 'start' : 'stop';
  return res.json({
    ok: true,
    message: action === 'start'
      ? 'Free bot interface started in controlled mode. Live bot execution remains disabled until the bot adapter is separately tested.'
      : 'Free bot stopped.',
    execution: 'interface_only'
  });
});

app.get('/api/preflight', (req, res) => {
  const oauthClientConfigured = Boolean(DERIV_CLIENT_ID);
  const partnerTrackingConfigured = Boolean(DERIV_AFFILIATE_TOKEN);
  const sessionSecretConfigured = Boolean(process.env.SESSION_SECRET);
  const publicAppConfigured = Boolean(DERIV_PUBLIC_APP_ID);
  const frontendConfigured = fs.existsSync(path.join(PUBLIC_DIR, 'index.html')) &&
    fs.existsSync(path.join(PUBLIC_DIR, 'workspace.html'));
  res.json({
    productionBaseUrl: BASE_URL,
    redirectUri: REDIRECT_URI,
    https: BASE_URL.startsWith('https://'),
    oauthClientConfigured,
    partnerTrackingConfigured,
    sessionSecretConfigured,
    publicAppConfigured,
    frontendConfigured,
    tradingEnabled: TRADING_ENABLED,
    demoOnly: TRADING_DEMO_ONLY,
    readyForControlledLiveTest: Boolean(
      BASE_URL.startsWith('https://') &&
      oauthClientConfigured &&
      partnerTrackingConfigured &&
      sessionSecretConfigured &&
      publicAppConfigured &&
      frontendConfigured
    )
  });
});

app.get('/app-config.js', (req, res) => {
  res.type('application/javascript').send(
    `window.PROTRADERS_PUBLIC_APP_ID=${JSON.stringify(DERIV_PUBLIC_APP_ID)};`
  );
});

function sendPublicFile(fileName, res, next) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!fs.existsSync(filePath)) return next();
  return res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) next(error);
  });
}

app.get('/workspace', (req, res, next) => sendPublicFile('workspace.html', res, next));
app.get('/workspace.html', (req, res, next) => sendPublicFile('workspace.html', res, next));
for (const page of ['marketplace', 'course', 'signals', 'manual', 'builder']) {
  app.get(`/${page}`, (req, res, next) => sendPublicFile(`pages/${page}.html`, res, next));
}

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return jsonError(res, 404, 'Not found');
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(503).type('text').send(
      'Frontend assets are missing. Add the public/ directory before deploying the website.'
    );
  }
  return res.sendFile(indexPath);
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return jsonError(res, error.status || 500, 'Internal server error');
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`[PROTRADERS FX] running on ${BASE_URL}`));
}