require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const PUBLIC_DIR = path.join(__dirname, 'public');

const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || '';
const DERIV_PUBLIC_APP_ID = process.env.DERIV_PUBLIC_APP_ID || '';
const DERIV_AFFILIATE_PARAM = process.env.DERIV_AFFILIATE_PARAM || 't';
const DERIV_AFFILIATE_TOKEN = process.env.DERIV_AFFILIATE_TOKEN || '';
const DERIV_AFFILIATE_ID = process.env.DERIV_AFFILIATE_ID || '';
const DERIV_CAMPAIGN = process.env.DERIV_CAMPAIGN || 'protraders-fx';
const DERIV_SCOPE = process.env.DERIV_SCOPE || 'trade account_manage';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.randomBytes(32).toString('hex');

/*
 * Vercel-safe analytics.
 *
 * IMPORTANT:
 * This is process memory only. Vercel can restart/redeploy the function,
 * so these counters are NOT permanent storage.
 */
const analytics = {
  visitors: 0,
  registrations: 0,
  events: []
};

function recordEvent(type, extra = {}) {
  analytics.events.push({
    type: String(type).slice(0, 40),
    at: new Date().toISOString(),
    ...extra
  });

  if (analytics.events.length > 5000) {
    analytics.events.splice(0, analytics.events.length - 5000);
  }
}

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function encryptionKey() {
  return crypto
    .createHash('sha256')
    .update(SESSION_SECRET)
    .digest();
}

function seal(object) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    encryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(object), 'utf8'),
    cipher.final()
  ]);

  return [
    base64url(iv),
    base64url(cipher.getAuthTag()),
    base64url(encrypted)
  ].join('.');
}

function unseal(value) {
  const [iv, tag, data] = String(value || '').split('.');

  if (!iv || !tag || !data) {
    throw new Error('Invalid session');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'base64url')
  );

  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final()
    ]).toString('utf8')
  );
}

function createVerifier() {
  return base64url(crypto.randomBytes(64));
}

function createChallenge(verifier) {
  return base64url(
    crypto.createHash('sha256').update(verifier).digest()
  );
}

function getSession(req) {
  try {
    const sessionCookie = req.cookies?.protraders_session;

    if (!sessionCookie) {
      return null;
    }

    const session = unseal(sessionCookie);

    if (
      !session ||
      !session.accessToken ||
      Date.now() >= Number(session.expiresAt || 0)
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/*
 * Middleware
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  : [BASE_URL];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          'https://auth.deriv.com',
          'https://api.derivws.com',
          'wss://*.derivws.com'
        ],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        frameAncestors: ["'none'"]
      }
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    }
  })
);

app.disable('x-powered-by');

app.use(
  express.json({
    limit: '20kb'
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: '20kb'
  })
);

app.use(cookieParser());

app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false
  })
);

/*
 * Configuration
 */
app.get('/api/config', (req, res) => {
  res.json({
    configured: Boolean(
      DERIV_CLIENT_ID && DERIV_AFFILIATE_TOKEN
    ),
    publicAppId: DERIV_PUBLIC_APP_ID,
    partnerParam: DERIV_AFFILIATE_PARAM,
    campaign: DERIV_CAMPAIGN
  });
});

/*
 * Analytics
 */
app.post('/api/track', (req, res) => {
  const type = String(
    req.body?.type || 'page_view'
  ).slice(0, 40);

  if (type === 'page_view') {
    analytics.visitors++;
  }

  recordEvent(type, {
    path: String(req.body?.path || '/').slice(0, 200)
  });

  res.status(204).end();
});

app.get('/api/analytics', (req, res) => {
  const oauthSuccesses = analytics.events.filter(
    event =>
      event.type === 'oauth_login_success' ||
      event.type === 'oauth_signup_success'
  ).length;

  res.json({
    visitors: analytics.visitors,
    registrations: analytics.registrations,
    oauthSuccesses,
    fundedAccounts: null,
    note:
      'Funded-account status must be confirmed in Deriv Partner Hub; it is not fabricated here.',
    storage:
      'Analytics are process-memory only in this deployment.'
  });
});

/*
 * Deriv OAuth
 */
function createOAuthUrl(mode) {
  if (!DERIV_CLIENT_ID) {
    throw new Error('DERIV_CLIENT_ID is not configured');
  }

  const verifier = createVerifier();

  const state = seal({
    verifier,
    mode,
    nonce: base64url(crypto.randomBytes(16)),
    iat: Date.now()
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: DERIV_CLIENT_ID,
    redirect_uri: `${BASE_URL}/oauth/callback`,
    scope: DERIV_SCOPE,
    state,
    code_challenge: createChallenge(verifier),
    code_challenge_method: 'S256'
  });

  if (mode === 'signup') {
    if (!DERIV_AFFILIATE_TOKEN) {
      throw new Error(
        'Deriv signup attribution is not configured'
      );
    }

    params.set('prompt', 'registration');
    params.set(
      DERIV_AFFILIATE_PARAM,
      DERIV_AFFILIATE_TOKEN
    );
    params.set('utm_campaign', DERIV_CAMPAIGN);
    params.set('utm_medium', 'affiliate');

    if (DERIV_AFFILIATE_ID) {
      params.set('utm_source', DERIV_AFFILIATE_ID);
    }
  }

  return `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
}

app.get('/api/deriv/login', (req, res) => {
  try {
    res.redirect(createOAuthUrl('login'));
  } catch (error) {
    res.status(503).json({
      error: error.message
    });
  }
});

app.get('/api/deriv/signup', (req, res) => {
  try {
    res.redirect(createOAuthUrl('signup'));
  } catch (error) {
    res.status(503).json({
      error: error.message
    });
  }
});

/*
 * OAuth callback
 */
app.get('/oauth/callback', async (req, res) => {
  try {
    if (req.query.error) {
      return res.redirect(
        `/?oauth_error=${encodeURIComponent(
          String(req.query.error)
        )}`
      );
    }

    if (!req.query.code || !req.query.state) {
      throw new Error('Missing OAuth code or state');
    }

    const state = unseal(req.query.state);

    if (
      !state?.verifier ||
      !['login', 'signup'].includes(state.mode) ||
      Date.now() - Number(state.iat || 0) > 600000
    ) {
      throw new Error('Invalid or expired OAuth state');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: DERIV_CLIENT_ID,
      code: String(req.query.code),
      code_verifier: state.verifier,
      redirect_uri: `${BASE_URL}/oauth/callback`
    });

    const response = await fetch(
      'https://auth.deriv.com/oauth2/token',
      {
        method: 'POST',
        headers: {
          'content-type':
            'application/x-www-form-urlencoded'
        },
        body
      }
    );

    if (!response.ok) {
      throw new Error(
        `Token exchange failed (${response.status})`
      );
    }

    const token = await response.json();

    if (!token.access_token) {
      throw new Error(
        'No access token returned'
      );
    }

    const expiresIn =
      Number(token.expires_in || 3600);

    const session = seal({
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt: Date.now() + expiresIn * 1000
    });

    res.cookie(
      'protraders_session',
      session,
      {
        httpOnly: true,
        secure: BASE_URL.startsWith('https://'),
        sameSite: 'lax',
        maxAge: expiresIn * 1000,
        path: '/'
      }
    );

    const eventType =
      state.mode === 'signup'
        ? 'oauth_signup_success'
        : 'oauth_login_success';

    recordEvent(eventType);

    if (state.mode === 'signup') {
      analytics.registrations++;

      recordEvent(
        'registration_complete'
      );
    }

    return res.redirect('/workspace.html');
  } catch (error) {
    console.error(
      '[OAUTH ERROR]',
      error.message
    );

    return res.redirect(
      '/?oauth_error=oauth_failed'
    );
  }
});

/*
 * Session
 */
app.get('/api/session', (req, res) => {
  const session = getSession(req);

  if (!session) {
    return res.json({
      authenticated: false
    });
  }

  return res.json({
    authenticated: true,
    expiresAt: session.expiresAt
  });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(
    'protraders_session',
    {
      httpOnly: true,
      secure: BASE_URL.startsWith('https://'),
      sameSite: 'lax',
      path: '/'
    }
  );

  res.status(204).end();
});

/*
 * Deriv WebSocket request helper
 */
function derivRequest(accessToken, payload) {
  return new Promise((resolve, reject) => {
    const appId =
      DERIV_PUBLIC_APP_ID || '1089';

    const ws = new WebSocket(
      `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(
        appId
      )}`
    );

    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;

      settled = true;

      try {
        ws.close();
      } catch {}

      reject(
        new Error(
          'Deriv request timeout'
        )
      );
    }, 12000);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          authorize: accessToken
        })
      );
    });

    ws.on('message', raw => {
      let data;

      try {
        data = JSON.parse(
          raw.toString()
        );
      } catch {
        return;
      }

      if (data.error) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);

          try {
            ws.close();
          } catch {}

          reject(
            new Error(
              data.error.message ||
                'Deriv API error'
            )
          );
        }

        return;
      }

      if (data.msg_type === 'authorize') {
        ws.send(
          JSON.stringify(payload)
        );

        return;
      }

      if (data.msg_type && !settled) {
        settled = true;
        clearTimeout(timer);

        try {
          ws.close();
        } catch {}

        resolve(data);
      }
    });

    ws.on('error', error => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);

      reject(error);
    });

    ws.on('close', () => {
      clearTimeout(timer);
    });
  });
}

/*
 * Account
 */
app.get('/api/account', async (req, res) => {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({
      authenticated: false
    });
  }

  try {
    const response =
      await derivRequest(
        session.accessToken,
        {
          balance: 1
        }
      );

    const account =
      response.balance || {};

    return res.json({
      authenticated: true,
      balance:
        account.balance ?? null,
      currency:
        account.currency ?? null,
      loginid:
        account.loginid ?? null,
      openPnl: 0
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Account data unavailable',
      message: error.message
    });
  }
});

/*
 * Trading
 */
app.post('/api/trades', async (req, res) => {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({
      error: 'Not authenticated'
    });
  }

  const symbol = String(
    req.body?.symbol || 'R_100'
  );

  const contractType =
    ['CALL', 'PUT'].includes(
      req.body?.contract_type
    )
      ? req.body.contract_type
      : null;

  const stake = Number(
    req.body?.stake
  );

  const duration = Number(
    req.body?.duration
  );

  if (
    !contractType ||
    !/^([A-Z0-9_]+)$/.test(symbol) ||
    !Number.isFinite(stake) ||
    stake <= 0 ||
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > 3600
  ) {
    return res.status(400).json({
      error:
        'Invalid trade parameters'
    });
  }

  try {
    const account =
      await derivRequest(
        session.accessToken,
        {
          balance: 1
        }
      );

    const currency =
      account.balance?.currency ||
      'USD';

    const proposal =
      await derivRequest(
        session.accessToken,
        {
          proposal: 1,
          amount: stake,
          basis: 'stake',
          contract_type: contractType,
          currency,
          duration,
          duration_unit: 't',
          symbol
        }
      );

    if (!proposal.proposal?.id) {
      return res.status(502).json({
        error:
          'Deriv did not return a proposal'
      });
    }

    const buy =
      await derivRequest(
        session.accessToken,
        {
          buy: proposal.proposal.id,
          price: stake
        }
      );

    if (buy.error) {
      return res.status(502).json({
        error: buy.error.message
      });
    }

    return res.json({
      ok: true,
      message:
        `Trade opened on ${symbol}. Contract ${
          buy.buy?.contract_id ||
          'created'
        }.`,
      contractId:
        buy.buy?.contract_id ||
        null
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Trade request failed',
      message: error.message
    });
  }
});

/*
 * Free bot interface
 */
app.post('/api/bot', async (req, res) => {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({
      error: 'Not authenticated'
    });
  }

  const action =
    req.body?.action === 'start'
      ? 'start'
      : 'stop';

  return res.json({
    ok: true,
    message:
      action === 'start'
        ? 'Free bot interface started in controlled mode. Live bot execution remains disabled until the bot adapter is separately tested.'
        : 'Free bot stopped.',
    execution: 'interface_only'
  });
});

/*
 * Preflight
 */
app.get('/api/preflight', (req, res) => {
  const https =
    BASE_URL.startsWith('https://');

  return res.json({
    productionBaseUrl: BASE_URL,
    redirectUri:
      `${BASE_URL}/oauth/callback`,
    https,
    oauthClientConfigured:
      Boolean(DERIV_CLIENT_ID),
    partnerTrackingConfigured:
      Boolean(DERIV_AFFILIATE_TOKEN),
    sessionSecretConfigured:
      Boolean(process.env.SESSION_SECRET),
    readyForControlledLiveTest:
      Boolean(
        https &&
        DERIV_CLIENT_ID &&
        DERIV_AFFILIATE_TOKEN &&
        process.env.SESSION_SECRET
      )
  });
});

/*
 * Health
 */
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'protraders-fx',
    time: new Date().toISOString()
  });
});

/*
 * Public Deriv app configuration
 */
app.get('/app-config.js', (req, res) => {
  res
    .type('application/javascript')
    .send(
      `window.PROTRADERS_PUBLIC_APP_ID=${JSON.stringify(
        DERIV_PUBLIC_APP_ID
      )};`
    );
});

/*
 * Frontend routes
 */
app.get('/workspace', (req, res) => {
  res.sendFile(
    path.join(
      PUBLIC_DIR,
      'workspace.html'
    )
  );
});

app.get('/workspace.html', (req, res) => {
  res.sendFile(
    path.join(
      PUBLIC_DIR,
      'workspace.html'
    )
  );
});

for (
  const page of [
    'marketplace',
    'course',
    'signals',
    'manual',
    'builder'
  ]
) {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(
      path.join(
        PUBLIC_DIR,
        'pages',
        `${page}.html`
      )
    );
  });
}

/*
 * Static frontend
 */
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html']
  })
);

/*
 * SPA fallback
 */
app.get('*', (req, res) => {
  res.sendFile(
    path.join(
      PUBLIC_DIR,
      'index.html'
    )
  );
});

/*
 * Error handler
 */
app.use(
  (error, req, res, next) => {
    console.error(
      '[SERVER ERROR]',
      error
    );

    res.status(500).json({
      error: 'Internal server error'
    });
  }
);

/*
 * Local development only.
 *
 * Vercel handles the serverless function itself.
 */
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(
      `[PROTRADERS FX] running on ${BASE_URL}`
    );
  });
}

module.exports = app;
