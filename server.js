```javascript
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

/*
 * IMPORTANT:
 * This project is deployed on Vercel.
 * Files are served from the repository ROOT, not /public.
 */
const ROOT_DIR = __dirname;

const BASE_URL = (
  process.env.BASE_URL ||
  `http://localhost:${PORT}`
).replace(/\/$/, '');

const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID || '';
const DERIV_PUBLIC_APP_ID = process.env.DERIV_PUBLIC_APP_ID || '';
const DERIV_AFFILIATE_PARAM =
  process.env.DERIV_AFFILIATE_PARAM || 't';
const DERIV_AFFILIATE_TOKEN =
  process.env.DERIV_AFFILIATE_TOKEN || '';
const DERIV_AFFILIATE_ID =
  process.env.DERIV_AFFILIATE_ID || '';
const DERIV_CAMPAIGN =
  process.env.DERIV_CAMPAIGN || 'protraders-fx';
const DERIV_SCOPE =
  process.env.DERIV_SCOPE || 'trade account_manage';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.randomBytes(32).toString('hex');

/*
 * CORS
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  : [BASE_URL];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

/*
 * SECURITY HEADERS
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          'https://auth.deriv.com',
          'https://api.derivws.com',
          'https://ws.derivws.com',
          'wss://*.derivws.com'
        ],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        frameAncestors: ["'none'"]
      }
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    }
  })
);

app.disable('x-powered-by');

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(cookieParser());

/*
 * API RATE LIMIT
 */
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
 * SESSION HELPERS
 */
function base64url(buffer) {
  return Buffer.from(buffer)
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

  const tag = cipher.getAuthTag();

  return [
    base64url(iv),
    base64url(tag),
    base64url(encrypted)
  ].join('.');
}

function unseal(value) {
  const parts = String(value || '').split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid session');
  }

  const [iv, tag, data] = parts;

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

function getSession(req) {
  try {
    const value = req.cookies?.protraders_session;

    if (!value) {
      return null;
    }

    const session = unseal(value);

    if (
      !session ||
      !session.accessToken ||
      !session.expiresAt ||
      Date.now() >= session.expiresAt
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/*
 * PKCE
 */
function createVerifier() {
  return base64url(crypto.randomBytes(64));
}

function createChallenge(verifier) {
  return base64url(
    crypto
      .createHash('sha256')
      .update(verifier)
      .digest()
  );
}

/*
 * BASIC CONFIG
 */
app.get('/api/config', (req, res) => {
  res.json({
    configured: Boolean(
      DERIV_CLIENT_ID &&
      DERIV_AFFILIATE_TOKEN
    ),
    publicAppId: DERIV_PUBLIC_APP_ID,
    partnerParam: DERIV_AFFILIATE_PARAM,
    campaign: DERIV_CAMPAIGN
  });
});

/*
 * ANALYTICS
 *
 * IMPORTANT:
 * Vercel serverless functions do not provide reliable
 * persistent local storage.
 *
 * Therefore this endpoint reports runtime-safe values
 * rather than writing analytics.json to /var/task.
 */
app.get('/api/analytics', (req, res) => {
  res.json({
    visitors: null,
    registrations: null,
    oauthSuccesses: null,
    fundedAccounts: null,
    storage: 'external_storage_required',
    note:
      'Persistent analytics must use a database or external storage. No local filesystem data is written on Vercel.'
  });
});

app.post('/api/track', (req, res) => {
  /*
   * Deliberately do not write to /var/task.
   * This prevents FUNCTION_INVOCATION_FAILED on Vercel.
   */
  res.status(204).end();
});

/*
 * DERIV OAUTH
 */
function createOAuthUrl(mode) {
  if (!DERIV_CLIENT_ID) {
    throw new Error(
      'DERIV_CLIENT_ID is not configured'
    );
  }

  const verifier = createVerifier();

  const state = seal({
    verifier,
    mode,
    nonce: base64url(
      crypto.randomBytes(16)
    ),
    issuedAt: Date.now()
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
    params.set(
      'utm_campaign',
      DERIV_CAMPAIGN
    );
    params.set(
      'utm_medium',
      'affiliate'
    );

    if (DERIV_AFFILIATE_ID) {
      params.set(
        'utm_source',
        DERIV_AFFILIATE_ID
      );
    }
  }

  return (
    'https://auth.deriv.com/oauth2/auth?' +
    params.toString()
  );
}

/*
 * LOGIN
 */
app.get('/api/deriv/login', (req, res) => {
  try {
    res.redirect(
      createOAuthUrl('login')
    );
  } catch (error) {
    console.error(
      'Deriv login configuration error:',
      error.message
    );

    res.status(503).json({
      error: error.message
    });
  }
});

/*
 * SIGNUP
 */
app.get('/api/deriv/signup', (req, res) => {
  try {
    res.redirect(
      createOAuthUrl('signup')
    );
  } catch (error) {
    console.error(
      'Deriv signup configuration error:',
      error.message
    );

    res.status(503).json({
      error: error.message
    });
  }
});

/*
 * OAUTH CALLBACK
 */
app.get(
  '/oauth/callback',
  async (req, res) => {
    try {
      if (req.query.error) {
        return res.redirect(
          `/?oauth_error=${encodeURIComponent(
            String(req.query.error)
          )}`
        );
      }

      const code = String(
        req.query.code || ''
      );

      if (!code) {
        throw new Error(
          'OAuth authorization code missing'
        );
      }

      const oauthState = unseal(
        String(req.query.state || '')
      );

      if (
        !oauthState?.verifier ||
        !['login', 'signup'].includes(
          oauthState.mode
        )
      ) {
        throw new Error(
          'Invalid OAuth state'
        );
      }

      if (
        Date.now() -
          Number(oauthState.issuedAt || 0) >
        10 * 60 * 1000
      ) {
        throw new Error(
          'OAuth state expired'
        );
      }

      const body = new URLSearchParams({
        grant_type:
          'authorization_code',
        client_id:
          DERIV_CLIENT_ID,
        code,
        code_verifier:
          oauthState.verifier,
        redirect_uri:
          `${BASE_URL}/oauth/callback`
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
        const errorText =
          await response.text();

        console.error(
          'Deriv token exchange failed:',
          response.status,
          errorText
        );

        throw new Error(
          `Token exchange failed (${response.status})`
        );
      }

      const token =
        await response.json();

      if (!token.access_token) {
        throw new Error(
          'No access token returned'
        );
      }

      const expiresIn =
        Number(token.expires_in || 3600);

      const session = seal({
        accessToken:
          token.access_token,
        refreshToken:
          token.refresh_token || null,
        expiresAt:
          Date.now() +
          expiresIn * 1000
      });

      res.cookie(
        'protraders_session',
        session,
        {
          httpOnly: true,
          secure:
            BASE_URL.startsWith(
              'https://'
            ),
          sameSite: 'lax',
          maxAge:
            expiresIn * 1000,
          path: '/'
        }
      );

      /*
       * No filesystem analytics are written here.
       */
      return res.redirect(
        '/workspace.html'
      );
    } catch (error) {
      console.error(
        'OAuth callback error:',
        error.message
      );

      return res.redirect(
        '/?oauth_error=oauth_failed'
      );
    }
  }
);

/*
 * SESSION
 */
app.get(
  '/api/session',
  (req, res) => {
    const session =
      getSession(req);

    if (!session) {
      return res.json({
        authenticated: false
      });
    }

    res.json({
      authenticated: true,
      expiresAt:
        session.expiresAt
    });
  }
);

/*
 * LOGOUT
 */
app.post(
  '/api/logout',
  (req, res) => {
    res.clearCookie(
      'protraders_session',
      {
        httpOnly: true,
        secure:
          BASE_URL.startsWith(
            'https://'
          ),
        sameSite: 'lax',
        path: '/'
      }
    );

    res.status(204).end();
  }
);

/*
 * DERIV WEBSOCKET REQUEST
 */
function derivRequest(
  accessToken,
  payload
) {
  return new Promise(
    (resolve, reject) => {
      const appId =
        DERIV_PUBLIC_APP_ID ||
        '1089';

      const ws =
        new WebSocket(
          `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(
            appId
          )}`
        );

      let finished = false;

      const finishError =
        (error) => {
          if (finished) return;

          finished = true;

          try {
            ws.close();
          } catch {}

          reject(error);
        };

      const finishSuccess =
        (result) => {
          if (finished) return;

          finished = true;

          try {
            ws.close();
          } catch {}

          resolve(result);
        };

      const timer =
        setTimeout(() => {
          finishError(
            new Error(
              'Deriv request timeout'
            )
          );
        }, 12000);

      ws.on(
        'open',
        () => {
          ws.send(
            JSON.stringify({
              authorize:
                accessToken
            })
          );
        }
      );

      ws.on(
        'message',
        (raw) => {
          let data;

          try {
            data =
              JSON.parse(
                raw.toString()
              );
          } catch {
            return;
          }

          if (data.error) {
            clearTimeout(timer);

            finishError(
              new Error(
                data.error.message ||
                  'Deriv API error'
              )
            );

            return;
          }

          if (
            data.msg_type ===
            'authorize'
          ) {
            ws.send(
              JSON.stringify(
                payload
              )
            );

            return;
          }

          if (data.msg_type) {
            clearTimeout(timer);
            finishSuccess(data);
          }
        }
      );

      ws.on(
        'error',
        (error) => {
          clearTimeout(timer);
          finishError(error);
        }
      );

      ws.on(
        'close',
        () => {
          clearTimeout(timer);
        }
      );
    }
  );
}

/*
 * ACCOUNT
 */
app.get(
  '/api/account',
  async (req, res) => {
    const session =
      getSession(req);

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

      res.json({
        authenticated: true,
        balance:
          account.balance ??
          null,
        currency:
          account.currency ??
          null,
        loginid:
          account.loginid ??
          null,
        openPnl: 0
      });
    } catch (error) {
      console.error(
        'Account request error:',
        error.message
      );

      res.status(502).json({
        error:
          'Account data unavailable',
        message:
          error.message
      });
    }
  }
);

/*
 * TRADING
 */
app.post(
  '/api/trades',
  async (req, res) => {
    const session =
      getSession(req);

    if (!session) {
      return res.status(401).json({
        error:
          'Not authenticated'
      });
    }

    const symbol =
      String(
        req.body?.symbol ||
          'R_100'
      );

    const contractType =
      ['CALL', 'PUT'].includes(
        req.body?.contract_type
      )
        ? req.body.contract_type
        : null;

    const stake =
      Number(
        req.body?.stake
      );

    const duration =
      Number(
        req.body?.duration
      );

    if (
      !contractType ||
      !/^([A-Z0-9_]+)$/.test(
        symbol
      ) ||
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
            contract_type:
              contractType,
            currency,
            duration,
            duration_unit: 't',
            symbol
          }
        );

      if (
        !proposal.proposal?.id
      ) {
        return res.status(502).json({
          error:
            'Deriv did not return a proposal'
        });
      }

      const buy =
        await derivRequest(
          session.accessToken,
          {
            buy:
              proposal.proposal.id,
            price: stake
          }
        );

      if (buy.error) {
        return res.status(502).json({
          error:
            buy.error.message
        });
      }

      res.json({
        ok: true,
        message:
          `Trade opened on ${symbol}.`,
        contractId:
          buy.buy?.contract_id ||
          null
      });
    } catch (error) {
      console.error(
        'Trade request error:',
        error.message
      );

      res.status(502).json({
        error:
          'Trade request failed',
        message:
          error.message
      });
    }
  }
);

/*
 * FREE BOT
 *
 * Controlled interface only.
 * No automatic live execution.
 */
app.post(
  '/api/bot',
  async (req, res) => {
    const session =
      getSession(req);

    if (!session) {
      return res.status(401).json({
        error:
          'Not authenticated'
      });
    }

    const action =
      req.body?.action ===
      'start'
        ? 'start'
        : 'stop';

    res.json({
      ok: true,
      message:
        action === 'start'
          ? 'Free bot interface started in controlled mode. Live bot execution remains disabled until the bot adapter is separately tested.'
          : 'Free bot stopped.',
      execution:
        'interface_only'
    });
  }
);

/*
 * PREFLIGHT
 */
app.get(
  '/api/preflight',
  (req, res) => {
    res.json({
      productionBaseUrl:
        BASE_URL,

      redirectUri:
        `${BASE_URL}/oauth/callback`,

      https:
        BASE_URL.startsWith(
          'https://'
        ),

      oauthClientConfigured:
        Boolean(
          DERIV_CLIENT_ID
        ),

      partnerTrackingConfigured:
        Boolean(
          DERIV_AFFILIATE_TOKEN
        ),

      sessionSecretConfigured:
        Boolean(
          process.env.SESSION_SECRET
        ),

      readyForControlledLiveTest:
        Boolean(
          BASE_URL.startsWith(
            'https://'
          ) &&
          DERIV_CLIENT_ID &&
          DERIV_AFFILIATE_TOKEN &&
          process.env.SESSION_SECRET
        )
    });
  }
);

/*
 * HEALTH CHECK
 *
 * This route is intentionally before
 * static-file handling.
 */
app.get(
  '/health',
  (req, res) => {
    res.status(200).json({
      ok: true,
      service:
        'protraders-fx',
      environment:
        process.env.VERCEL
          ? 'vercel'
          : 'node',
      time:
        new Date().toISOString()
    });
  }
);

/*
 * PUBLIC DERIV APP CONFIG
 */
app.get(
  '/app-config.js',
  (req, res) => {
    res
      .type(
        'application/javascript'
      )
      .send(
        `window.PROTRADERS_PUBLIC_APP_ID=${JSON.stringify(
          DERIV_PUBLIC_APP_ID
        )};`
      );
  }
);

/*
 * EXPLICIT WEBSITE PAGES
 *
 * Files are expected at repository root.
 */
function sendIfExists(
  fileName,
  res
) {
  const filePath =
    path.join(
      ROOT_DIR,
      fileName
    );

  res.sendFile(
    filePath,
    (error) => {
      if (error && !res.headersSent) {
        res.status(
          error.statusCode || 404
        ).send(
          'Page not found'
        );
      }
    }
  );
}

app.get(
  '/workspace',
  (req, res) =>
    sendIfExists(
      'workspace.html',
      res
    )
);

app.get(
  '/workspace.html',
  (req, res) =>
    sendIfExists(
      'workspace.html',
      res
    )
);

/*
 * Pages can exist either:
 *
 * /pages/name.html
 * OR
 * /name.html
 */
const pageNames = [
  'marketplace',
  'course',
  'signals',
  'manual',
  'builder'
];

for (const page of pageNames) {
  app.get(
    `/${page}`,
    (req, res) => {
      const pagesPath =
        path.join(
          ROOT_DIR,
          'pages',
          `${page}.html`
        );

      const rootPath =
        path.join(
          ROOT_DIR,
          `${page}.html`
        );

      res.sendFile(
        pagesPath,
        (error) => {
          if (
            error &&
            !res.headersSent
          ) {
            res.sendFile(
              rootPath,
              (rootError) => {
                if (
                  rootError &&
                  !res.headersSent
                ) {
                  res
                    .status(404)
                    .send(
                      'Page not found'
                    );
                }
              }
            );
          }
        }
      );
    }
  );
}

/*
 * STATIC FILES
 *
 * IMPORTANT:
 * Serve the repository ROOT.
 */
app.use(
  express.static(
    ROOT_DIR,
    {
      extensions: [
        'html'
      ],
      index: false
    }
  )
);

/*
 * ROOT PAGE
 */
app.get(
  '/',
  (req, res) => {
    const indexPath =
      path.join(
        ROOT_DIR,
        'index.html'
      );

    res.sendFile(
      indexPath,
      (error) => {
        if (
          error &&
          !res.headersSent
        ) {
          console.error(
            'index.html error:',
            error.message
          );

          res.status(500).send(
            'ProTraders FX could not load index.html. Check that index.html exists in the repository root.'
          );
        }
      }
    );
  }
);

/*
 * FALLBACK
 */
app.get(
  '*',
  (req, res) => {
    const indexPath =
      path.join(
        ROOT_DIR,
        'index.html'
      );

    res.sendFile(
      indexPath,
      (error) => {
        if (
          error &&
          !res.headersSent
        ) {
          res.status(404).send(
            'Page not found'
          );
        }
      }
    );
  }
);

/*
 * ERROR HANDLER
 */
app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      'Server error:',
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error:
        'Internal server error'
    });
  }
);

/*
 * VERCEL / LOCAL START
 *
 * Vercel can use the exported Express app.
 * Local Node can still run with npm start.
 */
if (!process.env.VERCEL) {
  app.listen(
    PORT,
    () => {
      console.log(
        `[PROTRADERS FX] running on ${BASE_URL}`
      );
    }
  );
}

module.exports = app;
```
