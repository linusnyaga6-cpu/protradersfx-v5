"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const WebSocket = require("ws");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

const ROOT = __dirname;

const BASE_URL =
process.env.BASE_URL ||
"https://www.protradersfx.com";

const DERIV_CLIENT_ID =
process.env.DERIV_CLIENT_ID ||
process.env.DERIV_PUBLIC_APP_ID ||
"";

const DERIV_APP_ID =
process.env.DERIV_PUBLIC_APP_ID ||
process.env.DERIV_CLIENT_ID ||
"";

const SESSION_SECRET =
process.env.SESSION_SECRET ||
"";

const DERIV_AUTH_URL =
"https://auth.deriv.com/oauth2/auth";

const DERIV_TOKEN_URL =
"https://auth.deriv.com/oauth2/token";

const DERIV_API_URL =
"https://api.derivws.com";

const CALLBACK_URL =
BASE_URL.replace(//+$/, "") +
"/oauth/callback";

const COOKIE_NAME = "protraders_session";
const OAUTH_COOKIE = "protraders_oauth";

const COOKIE_MAX_AGE = 60 * 60 * 1000;

const allowedSymbols = new Set([
"R_10",
"R_25",
"R_50",
"R_75",
"R_100",
"1HZ100V",
"1HZ75V",
"1HZ50V",
"1HZ25V",
"1HZ10V",
"BOOM1000",
"BOOM500",
"CRASH1000",
"CRASH500",
"stpRNG",
"RDBULL",
"RDBEAR"
]);

const allowedContractTypes = new Set([
"CALL",
"PUT"
]);

/* --------------------------------------------------
BASIC HELPERS
-------------------------------------------------- */

function jsonError(res, status, message, extra) {
return res.status(status).json(
Object.assign(
{
error: message
},
extra || {}
)
);
}

function randomString(bytes = 32) {
return crypto
.randomBytes(bytes)
.toString("base64url");
}

function base64url(buffer) {
return Buffer.from(buffer)
.toString("base64")
.replace(/+/g, "-")
.replace(///g, "_")
.replace(/=+$/g, "");
}

function pkceChallenge(verifier) {
return base64url(
crypto
.createHash("sha256")
.update(verifier)
.digest()
);
}

function cookieOptions(maxAge) {
return [
"Path=/",
"HttpOnly",
"Secure",
"SameSite=Lax",
"Max-Age=" + Math.floor(maxAge / 1000)
].join("; ");
}

function clearCookie(name) {
return (
name +
"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
);
}

/* --------------------------------------------------
ENCRYPTED COOKIE STORAGE
-------------------------------------------------- */

function getEncryptionKey() {
if (!SESSION_SECRET) {
throw new Error(
"SESSION_SECRET is not configured"
);
}

return crypto
.createHash("sha256")
.update(SESSION_SECRET)
.digest();
}

function encryptObject(value) {
const key = getEncryptionKey();

const iv = crypto.randomBytes(12);

const cipher = crypto.createCipheriv(
"aes-256-gcm",
key,
iv
);

const plaintext = Buffer.from(
JSON.stringify(value),
"utf8"
);

const encrypted = Buffer.concat([
cipher.update(plaintext),
cipher.final()
]);

const tag = cipher.getAuthTag();

return [
iv.toString("base64url"),
tag.toString("base64url"),
encrypted.toString("base64url")
].join(".");
}

function decryptObject(value) {
if (!value) return null;

try {
const key = getEncryptionKey();

```
const parts = value.split(".");

if (parts.length !== 3) {
  return null;
}

const iv = Buffer.from(parts[0], "base64url");
const tag = Buffer.from(parts[1], "base64url");
const encrypted = Buffer.from(
  parts[2],
  "base64url"
);

const decipher = crypto.createDecipheriv(
  "aes-256-gcm",
  key,
  iv
);

decipher.setAuthTag(tag);

const plaintext = Buffer.concat([
  decipher.update(encrypted),
  decipher.final()
]);

return JSON.parse(
  plaintext.toString("utf8")
);
```

} catch {
return null;
}
}

function parseCookies(req) {
const result = {};

const header = req.headers.cookie || "";

header.split(";").forEach(function (part) {
const index = part.indexOf("=");

```
if (index < 0) return;

const key = part
  .slice(0, index)
  .trim();

const value = part
  .slice(index + 1)
  .trim();

if (key) {
  result[key] = value;
}
```

});

return result;
}

function setEncryptedCookie(res, name, value, maxAge) {
const encrypted = encryptObject(value);

res.setHeader(
"Set-Cookie",
name +
"=" +
encrypted +
"; " +
cookieOptions(maxAge)
);
}

function getEncryptedCookie(req, name) {
const cookies = parseCookies(req);

return decryptObject(
cookies[name]
);
}

/* --------------------------------------------------
DERIV CONFIG
-------------------------------------------------- */

app.get("/api/config", function (req, res) {
res.status(200).json({
configured: Boolean(DERIV_CLIENT_ID),
publicAppId: DERIV_APP_ID
});
});

app.get("/app-config.js", function (req, res) {
res
.type("application/javascript")
.send(
"window.PROTRADERS_PUBLIC_APP_ID=" +
JSON.stringify(DERIV_APP_ID) +
";"
);
});

/* --------------------------------------------------
HEALTH
-------------------------------------------------- */

app.get("/health", function (req, res) {
res.status(200).json({
ok: true,
service: "protraders-fx",
status: "healthy",
time: new Date().toISOString(),
oauthConfigured: Boolean(DERIV_CLIENT_ID),
sessionConfigured: Boolean(SESSION_SECRET)
});
});

/* --------------------------------------------------
PREFLIGHT
-------------------------------------------------- */

app.get("/api/preflight", function (req, res) {
res.status(200).json({
productionBaseUrl: BASE_URL,
redirectUri: CALLBACK_URL,
https: BASE_URL.startsWith("https://"),
oauthClientConfigured:
Boolean(DERIV_CLIENT_ID),
sessionSecretConfigured:
Boolean(SESSION_SECRET)
});
});

/* --------------------------------------------------
OAUTH LOGIN
-------------------------------------------------- */

function beginOAuth(req, res, signup) {
if (!DERIV_CLIENT_ID) {
return jsonError(
res,
503,
"Deriv OAuth is not configured"
);
}

if (!SESSION_SECRET) {
return jsonError(
res,
503,
"SESSION_SECRET is not configured"
);
}

const state = randomString(32);

const verifier = randomString(48);

const challenge =
pkceChallenge(verifier);

const scope = "trade";

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
CALLBACK_URL
);

params.set(
"scope",
scope
);

params.set(
"state",
state
);

params.set(
"code_challenge",
challenge
);

params.set(
"code_challenge_method",
"S256"
);

if (signup) {
params.set(
"prompt",
"registration"
);

```
const affiliateToken =
  process.env.DERIV_AFFILIATE_TOKEN ||
  process.env.DERIV_AFFILIATE_PARAM ||
  "";

if (affiliateToken) {
  params.set(
    "t",
    affiliateToken
  );
}

const campaign =
  process.env.DERIV_CAMPAIGN ||
  "";

if (campaign) {
  params.set(
    "utm_campaign",
    campaign
  );
}
```

}

setEncryptedCookie(
res,
OAUTH_COOKIE,
{
state,
verifier,
createdAt: Date.now(),
signup: Boolean(signup)
},
10 * 60 * 1000
);

return res.redirect(
DERIV_AUTH_URL +
"?" +
params.toString()
);
}

app.get(
"/api/deriv/login",
function (req, res) {
return beginOAuth(
req,
res,
false
);
}
);

app.get(
"/api/deriv/signup",
function (req, res) {
return beginOAuth(
req,
res,
true
);
}
);

/* --------------------------------------------------
OAUTH CALLBACK
-------------------------------------------------- */

app.get(
"/oauth/callback",
async function (req, res) {
try {
const oauth =
getEncryptedCookie(
req,
OAUTH_COOKIE
);

```
  if (!oauth) {
    return res
      .status(400)
      .send(
        "OAuth session expired. Please start login again."
      );
  }

  res.setHeader(
    "Set-Cookie",
    clearCookie(OAUTH_COOKIE)
  );

  if (req.query.error) {
    const description =
      String(
        req.query.error_description ||
          req.query.error
      );

    return res
      .status(400)
      .send(
        "Deriv authentication failed: " +
          description
      );
  }

  const state =
    String(
      req.query.state || ""
    );

  const code =
    String(
      req.query.code || ""
    );

  if (!state || !code) {
    return res
      .status(400)
      .send(
        "Missing OAuth authorization code."
      );
  }

  if (
    state !== oauth.state
  ) {
    return res
      .status(400)
      .send(
        "OAuth state validation failed."
      );
  }

  if (
    Date.now() -
      Number(oauth.createdAt || 0) >
    10 * 60 * 1000
  ) {
    return res
      .status(400)
      .send(
        "OAuth authorization expired."
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
    oauth.verifier
  );

  body.set(
    "redirect_uri",
    CALLBACK_URL
  );

  const tokenResponse =
    await fetch(
      DERIV_TOKEN_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body
      }
    );

  const tokenData =
    await tokenResponse
      .json()
      .catch(
        function () {
          return {};
        }
      );

  if (
    !tokenResponse.ok ||
    !tokenData.access_token
  ) {
    console.error(
      "DERIV TOKEN ERROR:",
      tokenData
    );

    return res
      .status(502)
      .send(
        "Deriv login could not be completed. Please try again."
      );
  }

  const session = {
    accessToken:
      tokenData.access_token,

    tokenType:
      tokenData.token_type ||
      "Bearer",

    expiresAt:
      Date.now() +
      Number(
        tokenData.expires_in ||
          3600
      ) *
        1000,

    createdAt:
      Date.now()
  };

  setEncryptedCookie(
    res,
    COOKIE_NAME,
    session,
    COOKIE_MAX_AGE
  );

  return res.redirect(
    "/workspace"
  );
} catch (error) {
  console.error(
    "OAUTH CALLBACK ERROR:",
    error
  );

  return res
    .status(500)
    .send(
      "Unable to complete Deriv login."
    );
}
```

}
);

/* --------------------------------------------------
SESSION
-------------------------------------------------- */

app.get(
"/api/session",
async function (req, res) {
const session =
getEncryptedCookie(
req,
COOKIE_NAME
);

```
if (
  !session ||
  !session.accessToken
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

if (
  session.expiresAt &&
  Date.now() >=
    Number(session.expiresAt)
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

try {
  const accounts =
    await derivRequest(
      "/trading/v1/options/accounts",
      session.accessToken,
      {
        method: "GET"
      }
    );

  const list =
    extractAccounts(
      accounts
    );

  const selected =
    chooseAccount(list);

  return res.status(200).json({
    authenticated: true,
    accountId:
      selected?.account_id ||
      selected?.accountId ||
      null,
    balance:
      selected?.balance ??
      null,
    currency:
      selected?.currency ||
      null,
    accountType:
      selected?.account_type ||
      selected?.accountType ||
      null,
    status:
      selected?.status ||
      null,
    accounts: list,
    expiresAt:
      session.expiresAt || null
  });
} catch (error) {
  console.error(
    "SESSION ACCOUNT ERROR:",
    error
  );

  return res.status(200).json({
    authenticated: true,
    accountId: null,
    balance: null,
    currency: null,
    accountType: null,
    status: null,
    accounts: [],
    expiresAt:
      session.expiresAt || null
  });
}
```

}
);

/* --------------------------------------------------
ACCOUNT
-------------------------------------------------- */

app.get(
"/api/account",
async function (req, res) {
const session =
requireSession(
req,
res
);

```
if (!session) return;

try {
  const result =
    await derivRequest(
      "/trading/v1/options/accounts",
      session.accessToken,
      {
        method: "GET"
      }
    );

  const accounts =
    extractAccounts(result);

  const account =
    chooseAccount(accounts);

  if (!account) {
    return jsonError(
      res,
      404,
      "No Deriv trading account was found."
    );
  }

  return res.status(200).json({
    accountId:
      account.account_id ||
      account.accountId ||
      null,

    loginid:
      account.loginid ||
      account.login_id ||
      account.account_id ||
      null,

    balance:
      account.balance ??
      null,

    currency:
      account.currency ||
      null,

    accountType:
      account.account_type ||
      account.accountType ||
      null,

    status:
      account.status ||
      null,

    openPnl: 0,

    accounts
  });
} catch (error) {
  console.error(
    "ACCOUNT ERROR:",
    error
  );

  return jsonError(
    res,
    error.status || 502,
    error.message ||
      "Unable to load Deriv account."
  );
}
```

}
);

/* --------------------------------------------------
DERIV REST REQUEST
-------------------------------------------------- */

async function derivRequest(
endpoint,
accessToken,
options
) {
const headers =
Object.assign(
{
"Deriv-App-ID":
DERIV_APP_ID,

```
    Authorization:
      "Bearer " +
      accessToken
  },
  options?.headers || {}
);
```

const response =
await fetch(
DERIV_API_URL +
endpoint,
Object.assign(
{},
options || {},
{
headers
}
)
);

const data =
await response
.json()
.catch(
function () {
return {};
}
);

if (!response.ok) {
const error =
new Error(
extractDerivError(
data
)
);

```
error.status =
  response.status;

error.data = data;

throw error;
```

}

return data;
}

/* --------------------------------------------------
ACCOUNT NORMALIZATION
-------------------------------------------------- */

function extractAccounts(result) {
if (!result) return [];

if (
Array.isArray(
result.data
)
) {
return result.data;
}

if (
result.data &&
typeof result.data ===
"object"
) {
if (
Array.isArray(
result.data.accounts
)
) {
return result.data.accounts;
}

```
return [
  result.data
];
```

}

if (
Array.isArray(
result.accounts
)
) {
return result.accounts;
}

return [];
}

function chooseAccount(accounts) {
if (!Array.isArray(accounts)) {
return null;
}

const requested =
String(
process.env.DERIV_ACCOUNT_TYPE ||
""
).toLowerCase();

if (requested) {
const match =
accounts.find(
function (account) {
return String(
account.account_type ||
account.accountType ||
""
).toLowerCase() ===
requested;
}
);

```
if (match) return match;
```

}

const demo =
accounts.find(
function (account) {
return String(
account.account_type ||
account.accountType ||
""
).toLowerCase() ===
"demo";
}
);

return (
demo ||
accounts[0] ||
null
);
}

function extractDerivError(data) {
if (
data?.errors &&
Array.isArray(data.errors) &&
data.errors[0]?.message
) {
return data.errors[0].message;
}

if (
data?.error?.message
) {
return data.error.message;
}

if (
data?.message
) {
return data.message;
}

return "Deriv API request failed.";
}

/* --------------------------------------------------
AUTH SESSION REQUIREMENT
-------------------------------------------------- */

function requireSession(req, res) {
const session =
getEncryptedCookie(
req,
COOKIE_NAME
);

if (
!session ||
!session.accessToken
) {
jsonError(
res,
401,
"Not authenticated"
);

```
return null;
```

}

if (
session.expiresAt &&
Date.now() >=
Number(session.expiresAt)
) {
jsonError(
res,
401,
"Deriv session expired"
);

```
return null;
```

}

return session;
}

/* --------------------------------------------------
AUTHENTICATED DERIV WEBSOCKET
-------------------------------------------------- */

async function getAuthenticatedWebSocket(
session,
accountId
) {
if (!accountId) {
throw new Error(
"No Deriv account ID available."
);
}

const otp =
await derivRequest(
"/trading/v1/options/accounts/" +
encodeURIComponent(
accountId
) +
"/otp",
session.accessToken,
{
method: "POST"
}
);

const url =
otp?.data?.url;

if (!url) {
throw new Error(
"Deriv did not return an authenticated WebSocket URL."
);
}

return new Promise(
function (resolve, reject) {
const ws =
new WebSocket(
url
);

```
  const timer =
    setTimeout(
      function () {
        try {
          ws.close();
        } catch {}

        reject(
          new Error(
            "Deriv WebSocket connection timed out."
          )
        );
      },
      15000
    );

  ws.once(
    "open",
    function () {
      clearTimeout(
        timer
      );

      resolve(ws);
    }
  );

  ws.once(
    "error",
    function (error) {
      clearTimeout(
        timer
      );

      reject(error);
    }
  );
}
```

);
}

function wsRequest(
ws,
payload,
timeoutMs = 15000
) {
return new Promise(
function (resolve, reject) {
const reqId =
Date.now() +
Math.floor(
Math.random() *
100000
);

```
  const message =
    Object.assign(
      {},
      payload,
      {
        req_id:
          reqId
      }
    );

  let timer;

  function cleanup() {
    clearTimeout(
      timer
    );

    ws.removeListener(
      "message",
      onMessage
    );

    ws.removeListener(
      "error",
      onError
    );

    ws.removeListener(
      "close",
      onClose
    );
  }

  function onMessage(raw) {
    try {
      const data =
        JSON.parse(
          raw.toString()
        );

      if (
        Number(
          data.req_id
        ) !==
        Number(reqId)
      ) {
        return;
      }

      cleanup();

      if (data.error) {
        const error =
          new Error(
            data.error.message ||
              "Deriv WebSocket request failed."
          );

        error.code =
          data.error.code;

        reject(error);

        return;
      }

      resolve(data);
    } catch {
      // Ignore unrelated/non-JSON messages.
    }
  }

  function onError(error) {
    cleanup();
    reject(error);
  }

  function onClose() {
    cleanup();

    reject(
      new Error(
        "Deriv WebSocket closed unexpectedly."
      )
    );
  }

  ws.on(
    "message",
    onMessage
  );

  ws.once(
    "error",
    onError
  );

  ws.once(
    "close",
    onClose
  );

  timer =
    setTimeout(
      function () {
        cleanup();

        reject(
          new Error(
            "Deriv WebSocket request timed out."
          )
        );
      },
      timeoutMs
    );

  ws.send(
    JSON.stringify(
      message
    )
  );
}
```

);
}

/* --------------------------------------------------
TRADING
-------------------------------------------------- */

app.post(
"/api/trades",
async function (req, res) {
const session =
requireSession(
req,
res
);

```
if (!session) return;

try {
  const symbol =
    String(
      req.body?.symbol ||
        ""
    ).trim();

  const contractType =
    String(
      req.body?.contract_type ||
        ""
    ).toUpperCase();

  const stake =
    Number(
      req.body?.stake
    );

  const duration =
    Number(
      req.body?.duration
    );

  if (
    !allowedSymbols.has(
      symbol
    )
  ) {
    return jsonError(
      res,
      400,
      "Unsupported trading symbol."
    );
  }

  if (
    !allowedContractTypes.has(
      contractType
    )
  ) {
    return jsonError(
      res,
      400,
      "Unsupported contract type."
    );
  }

  if (
    !Number.isFinite(
      stake
    ) ||
    stake <= 0 ||
    stake > 10000
  ) {
    return jsonError(
      res,
      400,
      "Stake must be between 0 and 10000."
    );
  }

  if (
    !Number.isInteger(
      duration
    ) ||
    duration < 1 ||
    duration > 86400
  ) {
    return jsonError(
      res,
      400,
      "Duration must be between 1 and 86400 seconds."
    );
  }

  const accounts =
    await derivRequest(
      "/trading/v1/options/accounts",
      session.accessToken,
      {
        method: "GET"
      }
    );

  const accountList =
    extractAccounts(
      accounts
    );

  const account =
    chooseAccount(
      accountList
    );

  if (!account) {
    return jsonError(
      res,
      404,
      "No Deriv trading account found."
    );
  }

  const accountId =
    account.account_id ||
    account.accountId;

  const currency =
    account.currency ||
    "USD";

  const ws =
    await getAuthenticatedWebSocket(
      session,
      accountId
    );

  try {
    const proposal =
      await wsRequest(
        ws,
        {
          proposal: 1,
          amount: stake,
          basis: "stake",
          contract_type:
            contractType,
          currency,
          duration,
          duration_unit: "s",
          underlying_symbol:
            symbol
        }
      );

    const proposalId =
      proposal?.proposal?.id;

    const askPrice =
      Number(
        proposal?.proposal?.ask_price
      );

    if (
      !proposalId ||
      !Number.isFinite(
        askPrice
      )
    ) {
      throw new Error(
        "Deriv did not return a valid trade proposal."
      );
    }

    const buy =
      await wsRequest(
        ws,
        {
          buy:
            String(
              proposalId
            ),
          price:
            askPrice
        }
      );

    const result =
      buy?.buy || {};

    return res.status(200).json({
      ok: true,
      message:
        "Trade confirmed by Deriv.",
      contractId:
        result.contract_id ||
        null,
      transactionId:
        result.transaction_id ||
        null,
      buyPrice:
        result.buy_price ??
        askPrice,
      payout:
        result.payout ??
        null,
      balanceAfter:
        result.balance_after ??
        null,
      contractType,
      symbol,
      duration,
      currency
    });
  } finally {
    try {
      ws.close();
    } catch {}
  }
} catch (error) {
  console.error(
    "TRADE ERROR:",
    error
  );

  return jsonError(
    res,
    error.status || 502,
    error.message ||
      "Deriv trade request failed."
  );
}
```

}
);

/* --------------------------------------------------
BOT
-------------------------------------------------- */

app.post(
"/api/bot",
async function (req, res) {
const session =
requireSession(
req,
res
);

```
if (!session) return;

const action =
  String(
    req.body?.action ||
      ""
  ).toLowerCase();

const symbol =
  String(
    req.body?.symbol ||
      ""
  ).trim();

if (
  !["start", "stop"].includes(
    action
  )
) {
  return jsonError(
    res,
    400,
    "Invalid bot action."
  );
}

if (
  symbol &&
  !allowedSymbols.has(
    symbol
  )
) {
  return jsonError(
    res,
    400,
    "Unsupported bot market."
  );
}

/*
  The existing frontend provides only start/stop and symbol.
  We acknowledge the control safely here rather than inventing
  a trading strategy or placing trades without explicit strategy
  parameters.
*/

if (action === "stop") {
  return res.status(200).json({
    ok: true,
    message:
      "Free bot stopped.",
    running: false,
    symbol:
      symbol || null
  });
}

return res.status(200).json({
  ok: true,
  message:
    "Free bot is ready. Configure the bot strategy and risk parameters before automated execution.",
  running: false,
  ready: true,
  symbol:
    symbol || null
});
```

}
);

/* --------------------------------------------------
LOGOUT
-------------------------------------------------- */

app.post(
"/api/logout",
function (req, res) {
res.setHeader(
"Set-Cookie",
clearCookie(
COOKIE_NAME
)
);

```
return res.status(200).json({
  ok: true,
  authenticated: false
});
```

}
);

app.get(
"/api/logout",
function (req, res) {
res.setHeader(
"Set-Cookie",
clearCookie(
COOKIE_NAME
)
);

```
return res.redirect(
  "/"
);
```

}
);

/* --------------------------------------------------
TRACKING
-------------------------------------------------- */

app.post(
"/api/track",
function (req, res) {
return res.status(204).end();
}
);

/* --------------------------------------------------
FAVICON
-------------------------------------------------- */

app.get(
"/favicon.ico",
function (req, res) {
const ico =
path.join(
ROOT,
"favicon.ico"
);

```
const svg =
  path.join(
    ROOT,
    "favicon.svg"
  );

if (
  fs.existsSync(
    ico
  )
) {
  return res.sendFile(
    ico
  );
}

if (
  fs.existsSync(
    svg
  )
) {
  return res
    .type(
      "image/svg+xml"
    )
    .sendFile(svg);
}

return res
  .status(204)
  .end();
```

}
);

/* --------------------------------------------------
FRONTEND PAGES
-------------------------------------------------- */

app.get(
"/",
function (req, res) {
const file =
path.join(
ROOT,
"index.html"
);

```
if (
  fs.existsSync(
    file
  )
) {
  return res.sendFile(
    file
  );
}

return res
  .status(500)
  .send(
    "index.html is missing."
  );
```

}
);

app.get(
"/workspace",
function (req, res) {
const file =
path.join(
ROOT,
"workspace.html"
);

```
if (
  fs.existsSync(
    file
  )
) {
  return res.sendFile(
    file
  );
}

return res
  .status(404)
  .send(
    "workspace.html not found."
  );
```

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

```
if (
  fs.existsSync(
    file
  )
) {
  return res.sendFile(
    file
  );
}

return res
  .status(404)
  .send(
    "workspace.html not found."
  );
```

}
);

/* --------------------------------------------------
COMMON HTML ROUTES
-------------------------------------------------- */

const htmlRoutes = {
"/signals": "signals.html",
"/marketplace": "marketplace.html",
"/builder": "builder.html",
"/course": "course.html",
"/privacy": "privacy.html",
"/privacy.html": "privacy.html",
"/terms": "terms.html",
"/terms.html": "terms.html"
};

Object.keys(
htmlRoutes
).forEach(
function (route) {
app.get(
route,
function (req, res) {
const file =
path.join(
ROOT,
htmlRoutes[
route
]
);

```
    if (
      fs.existsSync(
        file
      )
    ) {
      return res.sendFile(
        file
      );
    }

    return res
      .status(404)
      .send(
        htmlRoutes[
          route
        ] +
          " not found."
      );
  }
);
```

}
);

/* --------------------------------------------------
STATIC FILES
-------------------------------------------------- */

app.use(
express.static(
ROOT,
{
index: false,
dotfiles: "ignore",
maxAge: "1h"
}
)
);

/* --------------------------------------------------
ERROR HANDLER
-------------------------------------------------- */

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

```
if (
  res.headersSent
) {
  return next(
    error
  );
}

return res
  .status(500)
  .json({
    error:
      "Internal server error"
  });
```

}
);

/* --------------------------------------------------
404
-------------------------------------------------- */

app.use(
function (
req,
res
) {
return res
.status(404)
.json({
error:
"Not found",
path:
req.path
});
}
);

/* --------------------------------------------------
LOCAL DEVELOPMENT
-------------------------------------------------- */

if (
require.main ===
module
) {
const PORT =
Number(
process.env.PORT ||
3000
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

module.exports =
app;
