"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const WebSocket = require("ws");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));
app.use(cookieParser());

const ROOT = __dirname;

const BASE_URL = (
  process.env.BASE_URL ||
  "https://www.protradersfx.com"
).replace(/\/$/, "");

const DERIV_CLIENT_ID =
  process.env.DERIV_CLIENT_ID ||
  "";

const DERIV_PUBLIC_APP_ID =
  process.env.DERIV_PUBLIC_APP_ID ||
  "";

const DERIV_AFFILIATE_TOKEN =
  process.env.DERIV_AFFILIATE_TOKEN ||
  "";

const DERIV_AFFILIATE_ID =
  process.env.DERIV_AFFILIATE_ID ||
  "";

const DERIV_AFFILIATE_PARAM =
  process.env.DERIV_AFFILIATE_PARAM ||
  "t";

const DERIV_CAMPAIGN =
  process.env.DERIV_CAMPAIGN ||
  "protraders-fx";

const DERIV_SCOPE =
  process.env.DERIV_SCOPE ||
  "trade account_manage";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.randomBytes(32).toString("hex");


/* ==================================================
   HELPERS
   ================================================== */

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sessionKey() {
  return crypto
    .createHash("sha256")
    .update(SESSION_SECRET)
    .digest();
}

function seal(data) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    sessionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    base64url(iv),
    base64url(tag),
    base64url(encrypted)
  ].join(".");
}

function unseal(value) {
  const parts = String(value || "").split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid session");
  }

  const iv = Buffer.from(parts[0], "base64url");
  const tag = Buffer.from(parts[1], "base64url");
  const encrypted = Buffer.from(parts[2], "base64url");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    sessionKey(),
    iv
  );

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return JSON.parse(
    decrypted.toString("utf8")
  );
}

function getSession(req) {
  try {
    const raw =
      req.cookies &&
      req.cookies.protraders_session;

    if (!raw) {
      return null;
    }

    const session = unseal(raw);

    if (
      !session ||
      !session.accessToken ||
      !session.expiresAt ||
      Date.now() >= session.expiresAt
    ) {
      return null;
    }

    return session;
  } catch (error) {
    return null;
  }
}

function createVerifier() {
  return base64url(
    crypto.randomBytes(64)
  );
}

function createChallenge(verifier) {
  return base64url(
    crypto
      .createHash("sha256")
      .update(verifier)
      .digest()
  );
}


/* ==================================================
   HEALTH
   ================================================== */

app.get("/health", function (req, res) {
  res.status(200).json({
    ok: true,
    service: "protraders-fx",
    status: "healthy",
    time: new Date().toISOString()
  });
});


/* ==================================================
   CONFIG
   ================================================== */

app.get("/api/config", function (req, res) {
  res.status(200).json({
    configured: Boolean(DERIV_CLIENT_ID),
    publicAppId: DERIV_PUBLIC_APP_ID
  });
});


app.get("/app-config.js", function (req, res) {
  res
    .type("application/javascript")
    .send(
      "window.PROTRADERS_PUBLIC_APP_ID=" +
      JSON.stringify(DERIV_PUBLIC_APP_ID) +
      ";"
    );
});


/* ==================================================
   PREFLIGHT
   ================================================== */

app.get("/api/preflight", function (req, res) {
  res.status(200).json({
    productionBaseUrl: BASE_URL,
    redirectUri:
      BASE_URL + "/oauth/callback",
    https:
      BASE_URL.startsWith("https://"),
    oauthClientConfigured:
      Boolean(DERIV_CLIENT_ID),
    partnerTrackingConfigured:
      Boolean(DERIV_AFFILIATE_TOKEN),
    sessionSecretConfigured:
      Boolean(process.env.SESSION_SECRET)
  });
});


/* ==================================================
   TRACKING
   ================================================== */

app.post("/api/track", function (req, res) {
  res.status(200).json({
    ok: true
  });
});


/* ==================================================
   DERIV OAUTH URL
   ================================================== */

function buildOAuthUrl(mode) {
  if (!DERIV_CLIENT_ID) {
    throw new Error(
      "DERIV_CLIENT_ID is not configured"
    );
  }

  const verifier = createVerifier();

  const state = seal({
    verifier: verifier,
    mode: mode,
    createdAt: Date.now()
  });

  const params = new URLSearchParams();

  params.set(
    "response_type",
    "code"
  );

  params.set(
    "client_id",
    DERIV_CLIENT_ID
  );

  params.set(
    "redirect_uri",
    BASE_URL + "/oauth/callback"
  );

  params.set(
    "scope",
    DERIV_SCOPE
  );

  params.set(
    "state",
    state
  );

  params.set(
    "code_challenge",
    createChallenge(verifier)
  );

  params.set(
    "code_challenge_method",
    "S256"
  );

  if (
    mode === "signup" &&
    DERIV_AFFILIATE_TOKEN
  ) {
    params.set(
      "prompt",
      "registration"
    );

    params.set(
      DERIV_AFFILIATE_PARAM,
      DERIV_AFFILIATE_TOKEN
    );

    params.set(
      "utm_campaign",
      DERIV_CAMPAIGN
    );

    params.set(
      "utm_medium",
      "affiliate"
    );

    if (DERIV_AFFILIATE_ID) {
      params.set(
        "utm_source",
        DERIV_AFFILIATE_ID
      );
    }
  }

  return (
    "https://auth.deriv.com/oauth2/auth?" +
    params.toString()
  );
}


/* ==================================================
   LOGIN
   ================================================== */

app.get(
  "/api/deriv/login",
  function (req, res) {
    try {
      const url =
        buildOAuthUrl("login");

      return res.redirect(url);
    } catch (error) {
      return res.status(503).json({
        error: error.message
      });
    }
  }
);


/* ==================================================
   SIGNUP
   ================================================== */

app.get(
  "/api/deriv/signup",
  function (req, res) {
    try {
      const url =
        buildOAuthUrl("signup");

      return res.redirect(url);
    } catch (error) {
      return res.status(503).json({
        error: error.message
      });
    }
  }
);


/* ==================================================
   OAUTH CALLBACK
   ================================================== */

app.get(
  "/oauth/callback",
  async function (req, res) {
    try {
      if (req.query.error) {
        return res.redirect(
          "/?oauth_error=" +
          encodeURIComponent(
            String(req.query.error)
          )
        );
      }

      const code =
        String(req.query.code || "");

      const state =
        String(req.query.state || "");

      if (!code || !state) {
        return res.redirect(
          "/?oauth_error=missing_oauth_data"
        );
      }

      const stateData =
        unseal(state);

      if (
        !stateData ||
        !stateData.verifier ||
        !["login", "signup"].includes(
          stateData.mode
        )
      ) {
        throw new Error(
          "Invalid OAuth state"
        );
      }

      if (
        Date.now() -
          Number(stateData.createdAt) >
        10 * 60 * 1000
      ) {
        throw new Error(
          "OAuth state expired"
        );
      }

      const body =
        new URLSearchParams();

      body.set(
        "grant_type",
        "authorization_code"
      );

      body.set(
        "client_id",
        DERIV_CLIENT_ID
      );

      body.set(
        "code",
        code
      );

      body.set(
        "code_verifier",
        stateData.verifier
      );

      body.set(
        "redirect_uri",
        BASE_URL + "/oauth/callback"
      );

      const tokenResponse =
        await fetch(
          "https://auth.deriv.com/oauth2/token",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded"
            },
            body: body.toString()
          }
        );

      if (!tokenResponse.ok) {
        const errorText =
          await tokenResponse.text();

        console.error(
          "DERIV TOKEN ERROR:",
          errorText
        );

        throw new Error(
          "Deriv token exchange failed"
        );
      }

      const token =
        await tokenResponse.json();

      if (!token.access_token) {
        throw new Error(
          "No Deriv access token returned"
        );
      }

      const session = seal({
        accessToken:
          token.access_token,

        refreshToken:
          token.refresh_token || null,

        expiresAt:
          Date.now() +
          Number(
            token.expires_in || 3600
          ) *
          1000
      });

      res.cookie(
        "protraders_session",
        session,
        {
          httpOnly: true,
          secure:
            BASE_URL.startsWith(
              "https://"
            ),
          sameSite: "lax",
          maxAge:
            Number(
              token.expires_in || 3600
            ) *
            1000,
          path: "/"
        }
      );

      return res.redirect(
        "/workspace.html"
      );

    } catch (error) {
      console.error(
        "OAUTH CALLBACK ERROR:",
        error
      );

      return res.redirect(
        "/?oauth_error=oauth_failed"
      );
    }
  }
);


/* ==================================================
   SESSION
   ================================================== */

app.get(
  "/api/session",
  function (req, res) {
    const session =
      getSession(req);

    if (!session) {
      return res.json({
        authenticated: false,
        accountId: null,
        balance: null,
        currency: null,
        accountType: null,
        status: null,
        accounts: [],
        expiresAt: null
      });
    }

    return res.json({
      authenticated: true,
      accountId: null,
      balance: null,
      currency: null,
      accountType: null,
      status: "connected",
      accounts: [],
      expiresAt:
        session.expiresAt
    });
  }
);


/* ==================================================
   DERIV WEBSOCKET REQUEST
   ================================================== */

function derivRequest(
  accessToken,
  payload
) {
  return new Promise(
    function (resolve, reject) {
      const appId =
        DERIV_PUBLIC_APP_ID ||
        "1089";

      const socket =
        new WebSocket(
          "wss://ws.derivws.com/websockets/v3?app_id=" +
          encodeURIComponent(appId)
        );

      let finished = false;

      const timer =
        setTimeout(
          function () {
            if (finished) {
              return;
            }

            finished = true;

            try {
              socket.close();
            } catch {}

            reject(
              new Error(
                "Deriv request timeout"
              )
            );
          },
          15000
        );

      socket.on(
        "open",
        function () {
          socket.send(
            JSON.stringify({
              authorize:
                accessToken
            })
          );
        }
      );

      socket.on(
        "message",
        function (raw) {
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
            if (!finished) {
              finished = true;
              clearTimeout(timer);

              try {
                socket.close();
              } catch {}

              reject(
                new Error(
                  data.error.message ||
                  "Deriv API error"
                )
              );
            }

            return;
          }

          if (
            data.msg_type ===
            "authorize"
          ) {
            socket.send(
              JSON.stringify(payload)
            );

            return;
          }

          if (data.msg_type) {
            if (!finished) {
              finished = true;
              clearTimeout(timer);

              try {
                socket.close();
              } catch {}

              resolve(data);
            }
          }
        }
      );

      socket.on(
        "error",
        function (error) {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            reject(error);
          }
        }
      );
    }
  );
}


/* ==================================================
   ACCOUNT
   ================================================== */

app.get(
  "/api/account",
  async function (req, res) {
    const session =
      getSession(req);

    if (!session) {
      return res.status(401).json({
        authenticated: false,
        error: "Not authenticated"
      });
    }

    try {
      const data =
        await derivRequest(
          session.accessToken,
          {
            balance: 1
          }
        );

      const balance =
        data.balance || {};

      return res.json({
        authenticated: true,
        balance:
          balance.balance ?? null,
        currency:
          balance.currency ?? null,
        loginid:
          balance.loginid ?? null,
        openPnl: 0
      });

    } catch (error) {
      return res.status(502).json({
        error:
          "Account data unavailable",
        message:
          error.message
      });
    }
  }
);


/* ==================================================
   TRADING
   ================================================== */

app.post(
  "/api/trades",
  async function (req, res) {
    const session =
      getSession(req);

    if (!session) {
      return res.status(401).json({
        error: "Not authenticated"
      });
    }

    const symbol =
      String(
        req.body?.symbol ||
        "R_100"
      );

    const contractType =
      ["CALL", "PUT"].includes(
        req.body?.contract_type
      )
        ? req.body.contract_type
        : null;

    const stake =
      Number(req.body?.stake);

    const duration =
      Number(req.body?.duration);

    if (
      !contractType ||
      !/^[A-Z0-9_]+$/.test(symbol) ||
      !Number.isFinite(stake) ||
      stake <= 0 ||
      !Number.isFinite(duration) ||
      duration < 1 ||
      duration > 3600
    ) {
      return res.status(400).json({
        error:
          "Invalid trade parameters"
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
        "USD";

      const proposal =
        await derivRequest(
          session.accessToken,
          {
            proposal: 1,
            amount: stake,
            basis: "stake",
            contract_type:
              contractType,
            currency: currency,
            duration: duration,
            duration_unit: "t",
            symbol: symbol
          }
        );

      if (
        !proposal.proposal ||
        !proposal.proposal.id
      ) {
        return res.status(502).json({
          error:
            "Deriv did not return a trade proposal"
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

      return res.json({
        ok: true,
        message:
          "Trade opened on " +
          symbol,
        contractId:
          buy.buy?.contract_id ||
          null
      });

    } catch (error) {
      return res.status(502).json({
        error:
          "Trade request failed",
        message:
          error.message
      });
    }
  }
);


/* ==================================================
   FREE BOT
   ================================================== */

app.post(
  "/api/bot",
  async function (req, res) {
    const session =
      getSession(req);

    if (!session) {
      return res.status(401).json({
        error: "Not authenticated"
      });
    }

    const action =
      String(
        req.body?.action || ""
      ).toLowerCase();

    if (
      !["start", "stop"].includes(
        action
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid bot action"
      });
    }

    return res.json({
      ok: true,
      message:
        action === "start"
          ? "Free bot interface started in controlled mode."
          : "Free bot stopped.",
      execution:
        "interface_only"
    });
  }
);


/* ==================================================
   LOGOUT
   ================================================== */

app.post(
  "/api/logout",
  function (req, res) {
    res.clearCookie(
      "protraders_session",
      {
        httpOnly: true,
        secure:
          BASE_URL.startsWith(
            "https://"
          ),
        sameSite: "lax",
        path: "/"
      }
    );

    return res.status(200).json({
      ok: true,
      authenticated: false
    });
  }
);


/* ==================================================
   FAVICON
   ================================================== */

app.get(
  "/favicon.ico",
  function (req, res) {
    const ico =
      path.join(
        ROOT,
        "favicon.ico"
      );

    const svg =
      path.join(
        ROOT,
        "favicon.svg"
      );

    if (fs.existsSync(ico)) {
      return res.sendFile(ico);
    }

    if (fs.existsSync(svg)) {
      return res
        .type("image/svg+xml")
        .sendFile(svg);
    }

    return res.status(204).end();
  }
);


/* ==================================================
   WORKSPACE
   ================================================== */

app.get(
  "/workspace",
  function (req, res) {
    const file =
      path.join(
        ROOT,
        "workspace.html"
      );

    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }

    return res.status(404).send(
      "workspace.html not found"
    );
  }
);

app.get(
  "/workspace.html",
  function (req, res) {
    const file =
      path.join(
        ROOT,
        "workspace.html"
      );

    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }

    return res.status(404).send(
      "workspace.html not found"
    );
  }
);


/* ==================================================
   HOMEPAGE
   ================================================== */

app.get(
  "/",
  function (req, res) {
    const file =
      path.join(
        ROOT,
        "index.html"
      );

    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }

    return res.status(500).send(
      "ProTraders FX index.html is missing."
    );
  }
);


/* ==================================================
   HTML ROUTES
   ================================================== */

const htmlRoutes = {
  "/signals": "signals.html",
  "/marketplace": "marketplace.html",
  "/builder": "builder.html",
  "/course": "course.html",
  "/privacy": "privacy.html",
  "/terms": "terms.html"
};

Object.keys(htmlRoutes).forEach(
  function (route) {
    app.get(
      route,
      function (req, res) {
        const file =
          path.join(
            ROOT,
            htmlRoutes[route]
          );

        if (fs.existsSync(file)) {
          return res.sendFile(file);
        }

        return res.status(404).send(
          htmlRoutes[route] +
          " not found"
        );
      }
    );
  }
);


/* ==================================================
   STATIC FRONTEND
   ================================================== */

app.use(
  express.static(
    ROOT,
    {
      index: false,
      dotfiles: "ignore"
    }
  )
);


/* ==================================================
   ERROR HANDLER
   ================================================== */

app.use(
  function (
    error,
    req,
    res,
    next
  ) {
    console.error(
      "SERVER ERROR:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      error:
        "Internal server error"
    });
  }
);


/* ==================================================
   404
   ================================================== */

app.use(
  function (req, res) {
    return res.status(404).json({
      error: "Not found",
      path: req.path
    });
  }
);


/* ==================================================
   LOCAL
   ================================================== */

if (require.main === module) {
  const PORT =
    Number(
      process.env.PORT || 3000
    );

  app.listen(
    PORT,
    function () {
      console.log(
        "[PROTRADERS FX] Server running on port " +
        PORT
      );
    }
  );
}


/* ==================================================
   VERCEL
   ================================================== */

module.exports = app;
