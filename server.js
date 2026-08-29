"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

const ROOT = __dirname;

const BASE_URL =
process.env.BASE_URL ||
"https://www.protradersfx.com";

const CLIENT_ID =
process.env.DERIV_CLIENT_ID ||
process.env.DERIV_PUBLIC_APP_ID ||
"";

const REDIRECT_URI =
process.env.DERIV_REDIRECT_URI ||
BASE_URL + "/oauth/callback";

/* =========================================================
HEALTH
========================================================= */

app.get("/health", function (req, res) {
res.status(200).json({
ok: true,
service: "protraders-fx",
status: "healthy",
time: new Date().toISOString()
});
});

/* =========================================================
PUBLIC CONFIG
========================================================= */

app.get("/api/config", function (req, res) {
res.status(200).json({
configured: Boolean(CLIENT_ID),
publicAppId:
process.env.DERIV_PUBLIC_APP_ID ||
process.env.DERIV_CLIENT_ID ||
""
});
});

app.get("/app-config.js", function (req, res) {
const appId =
process.env.DERIV_PUBLIC_APP_ID ||
process.env.DERIV_CLIENT_ID ||
"";

res
.type("application/javascript")
.send(
"window.PROTRADERS_PUBLIC_APP_ID=" +
JSON.stringify(appId) +
";"
);
});

/* =========================================================
PREFLIGHT
========================================================= */

app.get("/api/preflight", function (req, res) {
res.status(200).json({
productionBaseUrl: BASE_URL,
redirectUri: REDIRECT_URI,
https: BASE_URL.startsWith("https://"),
oauthClientConfigured: Boolean(CLIENT_ID),
sessionSecretConfigured:
Boolean(process.env.SESSION_SECRET)
});
});

/* =========================================================
SESSION
========================================================= */

app.get("/api/session", function (req, res) {
res.status(200).json({
authenticated: false,
accountId: null,
balance: null,
currency: null,
accountType: null,
status: null,
accounts: [],
expiresAt: null
});
});

/* =========================================================
DERIV LOGIN
========================================================= */

app.get("/api/deriv/login", function (req, res) {
if (!CLIENT_ID) {
return res.status(500).send(
"Deriv login is not configured. Set DERIV_CLIENT_ID in Vercel."
);
}

const params = new URLSearchParams();

params.set("response_type", "code");
params.set("client_id", CLIENT_ID);
params.set("redirect_uri", REDIRECT_URI);
params.set("scope", "trade account_manage");

const url =
"https://auth.deriv.com/oauth2/auth?" +
params.toString();

res.redirect(url);
});

/* =========================================================
DERIV SIGNUP
========================================================= */

app.get("/api/deriv/signup", function (req, res) {
if (!CLIENT_ID) {
return res.status(500).send(
"Deriv signup is not configured. Set DERIV_CLIENT_ID in Vercel."
);
}

const params = new URLSearchParams();

params.set("response_type", "code");
params.set("client_id", CLIENT_ID);
params.set("redirect_uri", REDIRECT_URI);
params.set("scope", "trade account_manage");

const affiliateToken =
process.env.DERIV_AFFILIATE_TOKEN ||
process.env.DERIV_AFFILIATE_PARAM ||
"";

if (affiliateToken) {
params.set(
process.env.DERIV_AFFILIATE_PARAM_NAME || "t",
affiliateToken
);
}

if (process.env.DERIV_CAMPAIGN) {
params.set(
"utm_campaign",
process.env.DERIV_CAMPAIGN
);
}

const url =
"https://auth.deriv.com/oauth2/auth?" +
params.toString();

res.redirect(url);
});

/* =========================================================
OAUTH CALLBACK
========================================================= */

app.get("/oauth/callback", function (req, res) {
const code = req.query.code;
const error = req.query.error;

if (error) {
return res.redirect(
"/?oauth_error=" +
encodeURIComponent(String(error))
);
}

if (!code) {
return res.redirect(
"/?oauth_error=missing_code"
);
}

/*

* The frontend is kept functional while the
* authenticated Deriv session adapter is connected.
  */
  return res.redirect(
  "/workspace?oauth_code_received=true"
  );
  });

/* =========================================================
ACCOUNT
========================================================= */

app.get("/api/account", function (req, res) {
res.status(501).json({
error: "Account adapter not configured",
message:
"Deriv account authentication is not yet connected to the account data adapter."
});
});

/* =========================================================
TRACKING
========================================================= */

app.post("/api/track", function (req, res) {
res.status(200).json({
ok: true
});
});

/* =========================================================
TRADES
========================================================= */

app.post("/api/trades", function (req, res) {
if (req.method !== "POST") {
return res.status(405).json({
error: "Method not allowed"
});
}

const symbol =
String(req.body?.symbol || "").trim();

const contractType =
String(
req.body?.contract_type || ""
)
.trim()
.toUpperCase();

const stake =
Number(req.body?.stake);

const duration =
Number(req.body?.duration);

if (!symbol) {
return res.status(400).json({
error: "Trading symbol is required."
});
}

if (
contractType !== "CALL" &&
contractType !== "PUT"
) {
return res.status(400).json({
error: "Invalid contract direction."
});
}

if (
!Number.isFinite(stake) ||
stake <= 0
) {
return res.status(400).json({
error: "Invalid stake."
});
}

if (
!Number.isFinite(duration) ||
duration <= 0
) {
return res.status(400).json({
error: "Invalid duration."
});
}

return res.status(501).json({
error: "Trading adapter not configured",
message:
"The ProTraders FX trading interface is ready, but live Deriv order execution has not yet been connected."
});
});

/* =========================================================
BOT
========================================================= */

app.post("/api/bot", function (req, res) {
if (req.method !== "POST") {
return res.status(405).json({
error: "Method not allowed"
});
}

const action =
String(req.body?.action || "")
.toLowerCase();

const symbol =
String(req.body?.symbol || "");

if (
action !== "start" &&
action !== "stop"
) {
return res.status(400).json({
error: "Invalid bot action"
});
}

return res.status(501).json({
error:
"Free bot execution adapter not configured",
message:
"Free bot " +
action +
" received for " +
symbol +
". Real Deriv bot execution is not yet connected."
});
});

/* =========================================================
LOGOUT
========================================================= */

app.post("/api/logout", function (req, res) {
res.status(200).json({
ok: true,
authenticated: false
});
});

app.get("/logout", function (req, res) {
res.redirect("/");
});

/* =========================================================
FAVICON
========================================================= */

app.get("/favicon.ico", function (req, res) {
const ico =
path.join(ROOT, "favicon.ico");

const svg =
path.join(ROOT, "favicon.svg");

if (fs.existsSync(ico)) {
return res.sendFile(ico);
}

if (fs.existsSync(svg)) {
return res
.type("image/svg+xml")
.sendFile(svg);
}

return res.status(204).end();
});

/* =========================================================
HOMEPAGE
========================================================= */

app.get("/", function (req, res) {
const file =
path.join(ROOT, "index.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(500).send(
"<!doctype html>" +
"<html><head>" +
"<title>ProTraders FX</title>" +
"</head><body>" +
"<h1>ProTraders FX</h1>" +
"<p>index.html is missing.</p>" +
"</body></html>"
);
});

/* =========================================================
WORKSPACE
========================================================= */

app.get("/workspace", function (req, res) {
const file =
path.join(ROOT, "workspace.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(404).send(
"workspace.html not found"
);
});

app.get("/workspace.html", function (req, res) {
const file =
path.join(ROOT, "workspace.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(404).send(
"workspace.html not found"
);
});

/* =========================================================
STATIC FILES
========================================================= */

/*

* Your Replit frontend stores CSS, JavaScript,
* images and HTML files in the repository root.
*
* This makes /style.css, /workspace.js,
* /tracker.js, /logo.svg, etc. available.
  */

app.use(
express.static(ROOT, {
index: false,
dotfiles: "ignore",
fallthrough: true
})
);

/* =========================================================
HTML ROUTES
========================================================= */

const htmlRoutes = {
"/signals": "signals.html",
"/marketplace": "marketplace.html",
"/builder": "builder.html",
"/course": "course.html",
"/privacy": "privacy.html",
"/terms": "terms.html"
};

Object.keys(htmlRoutes).forEach(function (route) {
app.get(route, function (req, res) {
const file =
path.join(
ROOT,
htmlRoutes[route]
);

```
if (fs.existsSync(file)) {
  return res.sendFile(file);
}

return res.status(404).send(
  htmlRoutes[route] +
  " not found"
);
```

});
});

/* =========================================================
ERROR HANDLER
========================================================= */

app.use(function (
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
error: "Internal server error"
});
});

/* =========================================================
404
========================================================= */

app.use(function (req, res) {
res.status(404).json({
error: "Not found",
path: req.path
});
});

/* =========================================================
LOCAL DEVELOPMENT
========================================================= */

if (require.main === module) {
const PORT =
Number(process.env.PORT || 3000);

app.listen(PORT, function () {
console.log(
"[PROTRADERS FX] Server running on port " +
PORT
);
});
}

/* =========================================================
VERCEL
========================================================= */

module.exports = app;
