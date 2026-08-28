```javascript
"use strict";

const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const BASE_URL = (
  process.env.BASE_URL ||
  "https://protradersfx.com"
).replace(/\/$/, "");

const DERIV_CLIENT_ID =
  process.env.DERIV_CLIENT_ID || "";

const DERIV_AFFILIATE_PARAM =
  process.env.DERIV_AFFILIATE_PARAM || "t";

const DERIV_AFFILIATE_TOKEN =
  process.env.DERIV_AFFILIATE_TOKEN || "";

const DERIV_AFFILIATE_ID =
  process.env.DERIV_AFFILIATE_ID || "";

const DERIV_CAMPAIGN =
  process.env.DERIV_CAMPAIGN || "protraders-fx";

const DERIV_PUBLIC_APP_ID =
  process.env.DERIV_PUBLIC_APP_ID || "";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.randomBytes(32).toString("hex");

const sessions = new Map();

let analyticsData = {
  visitors: 0,
  registrations: 0,
  events: []
};

app.disable("x-powered-by");

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({
  extended: false,
  limit: "20kb"
}));

/* =========================
   HELPERS
========================= */

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pkceVerifier() {
  return base64url(crypto.randomBytes(64));
}

function challenge(verifier) {
  return base64url(
    crypto
      .createHash("sha256")
      .update(verifier)
      .digest()
  );
}

function encrypt(data) {
  const iv = crypto.randomBytes(12);

  const key = crypto
    .createHash("sha256")
    .update(SESSION_SECRET)
    .digest();

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(
      JSON.stringify(data),
      "utf8"
    ),
    cipher.final()
  ]);

  return [
    base64url(iv),
    base64url(cipher.getAuthTag()),
    base64url(encrypted)
  ].join(".");
}

function decrypt(token) {
  const parts = String(token || "").split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid OAuth state");
  }

  const iv = Buffer.from(parts[0], "base64url");
  const tag = Buffer.from(parts[1], "base64url");
  const encrypted = Buffer.from(
    parts[2],
    "base64url"
  );

  const key = crypto
    .createHash("sha256")
    .update(SESSION_SECRET)
    .digest();

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
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

function hashIp(ip) {
  return crypto
    .createHash("sha256")
    .update(
      String(ip || "") +
      "|" +
      SESSION_SECRET
    )
    .digest("hex")
    .slice(0, 16);
}

function readData() {
  return analyticsData;
}

function writeData(data) {
  analyticsData = data;
}

/* =========================
   HEALTH
========================= */

app.get("/health", function (req, res) {
  return res.status(200).json({
    ok: true,
    service: "protraders-fx",
    status: "healthy",
    time: new Date().toISOString()
  });
});

/* =========================
   CONFIG
========================= */

app.get("/api/config", function (req, res) {
  return res.status(200).json({
    configured: Boolean(DERIV_CLIENT_ID),
    publicAppId: DERIV_PUBLIC_APP_ID,
    partnerConfigured: Boolean(
      DERIV_AFFILIATE_TOKEN
    )
  });
});

/* =========================
   PREFLIGHT
========================= */

app.get("/api/preflight", function (req, res) {
  const redirectUri =
    BASE_URL + "/oauth/callback";

  return res.status(200).json({
    productionBaseUrl: BASE_URL,
    redirectUri: redirectUri,
    https: BASE_URL.startsWith("https://"),
    oauthClientConfigured:
      Boolean(DERIV_CLIENT_ID),
    partnerTrackingConfigured:
      Boolean(DERIV_AFFILIATE_TOKEN),
    sessionSecretConfigured:
      Boolean(process.env.SESSION_SECRET),
    readyForControlledLiveTest:
      Boolean(
        BASE_URL.startsWith("https://") &&
        DERIV_CLIENT_ID &&
        DERIV_AFFILIATE_TOKEN &&
        process.env.SESSION_SECRET
      )
  });
});

/* =========================
   SESSION
========================= */

app.get("/api/session", function (req, res) {
  const sessionId =
    req.headers.cookie
      ?.split(";")
      .map(function (item) {
        return item.trim();
      })
      .find(function (item) {
        return item.startsWith(
          "protraders_session="
        );
      })
      ?.split("=")[1];

  if (!sessionId) {
    return res.status(200).json({
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

  const session =
    sessions.get(sessionId);

  if (
    !session ||
    Date.now() >= session.expiresAt
  ) {
    return res.status(200).json({
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

  return res.status(200).json({
    authenticated: true,
    accountId: null,
    balance: null,
    currency: null,
    accountType: null,
    status: null,
    accounts: [],
    expiresAt: session.expiresAt
  });
});

/* =========================
   PUBLIC APP CONFIG
========================= */

app.get("/app-config.js", function (req, res) {
  res.type("application/javascript");

  return res.send(
    "window.PROTRADERS_PUBLIC_APP_ID=" +
    JSON.stringify(DERIV_PUBLIC_APP_ID) +
    ";"
  );
});

/* =========================
   TRACKING
========================= */

app.post("/api/track", function (req, res) {
  try {
    const type = String(
      req.body?.type || "page_view"
    ).slice(0, 40);

    const data = readData();

    if (type === "page_view") {
      data.visitors += 1;
    }

    data.events.push({
      type: type,
      at: new Date().toISOString(),
      ip: hashIp(req.ip),
      path: String(
        req.body?.path || "/"
      ).slice(0, 200)
    });

    if (data.events.length > 5000) {
      data.events =
        data.events.slice(-5000);
    }

    writeData(data);

    return res.status(204).end();
  } catch (error) {
    console.error(
      "TRACKING ERROR:",
      error
    );

    return res.status(204).end();
  }
});

/* =========================
   ANALYTICS
========================= */

app.get("/api/analytics", function (req, res) {
  const data = readData();

  const registrations =
    data.events.filter(function (event) {
      return (
        event.type ===
        "registration_complete"
      );
    }).length;

  const successful =
    data.events.filter(function (event) {
      return (
        event.type ===
        "oauth_login_success" ||
        event.type ===
        "oauth_signup_success"
      );
    }).length;

  return res.status(200).json({
    visitors: data.visitors,
    registrations: Math.max(
      data.registrations || 0,
      registrations
    ),
    oauthSuccesses: successful,
    fundedAccounts: null
  });
});

/* =========================
   DERIV OAUTH URL
========================= */

function buildDerivOAuthUrl(mode) {
  if (!DERIV_CLIENT_ID) {
    throw new Error(
      "Deriv OAuth client is not configured"
    );
  }

  const verifier =
    pkceVerifier();

  const state = encrypt({
    verifier: verifier,
    nonce: base64url(
      crypto.randomBytes(16)
    ),
    mode: mode,
    iat: Date.now()
  });

  const params =
    new URLSearchParams({
      response_type: "code",
      client_id: DERIV_CLIENT_ID,
      redirect_uri:
        BASE_URL +
        "/oauth/callback",
      scope:
        process.env.DERIV_SCOPE ||
        "trade",
      state: state,
      code_challenge:
        challenge(verifier),
      code_challenge_method:
        "S256"
    });

  if (mode === "signup") {
    if (!DERIV_AFFILIATE_TOKEN) {
      throw new Error(
        "Deriv signup attribution is not configured"
      );
    }

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

/* =========================
   DERIV SIGNUP
========================= */

app.get(
  "/api/deriv/signup",
  function (req, res) {
    try {
      return res.redirect(
        buildDerivOAuthUrl("signup")
      );
    } catch (error) {
      console.error(
        "SIGNUP ERROR:",
        error
      );

      return res.status(503).json({
        error: error.message
      });
    }
  }
);

/* =========================
   DERIV LOGIN
========================= */

app.get(
  "/api/deriv/login",
  function (req, res) {
    try {
      return res.redirect(
        buildDerivOAuthUrl("login")
      );
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      return res.status(503).json({
        error: error.message
      });
    }
  }
);

/* =========================
   OAUTH CALLBACK
========================= */

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

      if (!req.query.state) {
        throw new Error(
          "Missing OAuth state"
        );
      }

      const payload =
        decrypt(req.query.state);

      if (
        !payload ||
        !payload.verifier ||
        !["signup", "login"].includes(
          payload.mode
        )
      ) {
        throw new Error(
          "Invalid OAuth state"
        );
      }

      if (
        Date.now() -
        Number(payload.iat) >
        10 * 60 * 1000
      ) {
        throw new Error(
          "Expired OAuth state"
        );
      }

      if (!req.query.code) {
        throw new Error(
          "Missing authorization code"
        );
      }

      if (!DERIV_CLIENT_ID) {
        throw new Error(
          "OAuth client is not configured"
        );
      }

      const body =
        new URLSearchParams({
          grant_type:
            "authorization_code",
          client_id:
            DERIV_CLIENT_ID,
          code: String(
            req.query.code
          ),
          code_verifier:
            payload.verifier,
          redirect_uri:
            BASE_URL +
            "/oauth/callback"
        });

      const tokenResponse =
        await fetch(
          "https://auth.deriv.com/oauth2/token",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded"
            },
            body: body
          }
        );

      if (!tokenResponse.ok) {
        throw new Error(
          "Token exchange failed (" +
          tokenResponse.status +
          ")"
        );
      }

      const token =
        await tokenResponse.json();

      if (!token.access_token) {
        throw new Error(
          "Token response did not contain an access token"
        );
      }

      const sessionId =
        base64url(
          crypto.randomBytes(32)
        );

      const expiresIn =
        Number(
          token.expires_in || 3600
        );

      sessions.set(
        sessionId,
        {
          accessToken:
            token.access_token,
          refreshToken:
            token.refresh_token ||
            null,
          expiresAt:
            Date.now() +
            expiresIn * 1000
        }
      );

      setTimeout(
        function () {
          sessions.delete(
            sessionId
          );
        },
        expiresIn * 1000
      );

      const data =
        readData();

      data.events.push({
        type:
          payload.mode === "signup"
            ? "oauth_signup_success"
            : "oauth_login_success",
        at:
          new Date().toISOString(),
        expiresIn:
          token.expires_in ||
          null
      });

      if (
        payload.mode ===
        "signup"
      ) {
        data.registrations =
          (data.registrations || 0) +
          1;

        data.events.push({
          type:
            "registration_complete",
          at:
            new Date().toISOString()
        });
      }

      writeData(data);

      return res
        .status(302)
        .set(
          "Set-Cookie",
          "protraders_session=" +
          sessionId +
          "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" +
          expiresIn
        )
        .set(
          "Location",
          "/?trading=1"
        )
        .end();
    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      return res.redirect(
        "/?oauth_error=oauth_failed"
      );
    }
  }
);

/* =========================
   FAVICON
========================= */

app.get(
  "/favicon.ico",
  function (req, res) {
    const favicon =
      path.join(
        ROOT,
        "favicon.ico"
      );

    if (
      require("fs").existsSync(
        favicon
      )
    ) {
      return res.sendFile(
        favicon
      );
    }

    const faviconSvg =
      path.join(
        ROOT,
        "favicon.svg"
      );

    if (
      require("fs").existsSync(
        faviconSvg
      )
    ) {
      return res.sendFile(
        faviconSvg
      );
    }

    return res.status(204).end();
  }
);

/* =========================
   FRONTEND
========================= */

app.get(
  "/workspace",
  function (req, res) {
    const file =
      path.join(
        ROOT,
        "workspace.html"
      );

    if (
      require("fs").existsSync(file)
    ) {
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

    if (
      require("fs").existsSync(file)
    ) {
      return res.sendFile(file);
    }

    return res.status(404).send(
      "workspace.html not found"
    );
  }
);

app.use(
  express.static(ROOT)
);

/* =========================
   ROOT
========================= */

app.get(
  "/",
  function (req, res) {
    const file =
      path.join(
        ROOT,
        "index.html"
      );

    if (
      require("fs").existsSync(file)
    ) {
      return res.sendFile(file);
    }

    return res.status(200).send(
      "<!doctype html>" +
      "<html>" +
      "<head>" +
      "<meta charset=\"utf-8\">" +
      "<title>ProTraders FX</title>" +
      "</head>" +
      "<body>" +
      "<h1>ProTraders FX</h1>" +
      "<p>Server is running.</p>" +
      "</body>" +
      "</html>"
    );
  }
);

/* =========================
   404
========================= */

app.use(
  function (req, res) {
    return res.status(404).json({
      error: "Not found",
      path: req.path
    });
  }
);

/* =========================
   ERROR HANDLER
========================= */

app.use(
  function (
    error,
    req,
    res,
    next
  ) {
    console.error(
      "[PROTRADERS FX] SERVER ERROR:",
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

/* =========================
   LOCAL ONLY
========================= */

if (require.main === module) {
  app.listen(
    PORT,
    function () {
      console.log(
        "[PROTRADERS FX] running on port " +
        PORT
      );
    }
  );
}

module.exports = app;
```
