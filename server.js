"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

const ROOT = __dirname;

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
const appId =
process.env.DERIV_PUBLIC_APP_ID ||
process.env.DERIV_CLIENT_ID ||
"";

res.json({
configured: Boolean(appId),
publicAppId: appId
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
const baseUrl =
process.env.BASE_URL ||
"https://www.protradersfx.com";

res.json({
productionBaseUrl: baseUrl,
redirectUri: baseUrl + "/oauth/callback",
https: baseUrl.startsWith("https://"),
oauthClientConfigured: Boolean(
process.env.DERIV_CLIENT_ID ||
process.env.DERIV_PUBLIC_APP_ID
),
sessionSecretConfigured: Boolean(
process.env.SESSION_SECRET
)
});
});

/* =========================================================
DERIV LOGIN
========================================================= */

app.get("/api/deriv/login", function (req, res) {
const clientId =
process.env.DERIV_CLIENT_ID ||
process.env.DERIV_PUBLIC_APP_ID ||
"";

const baseUrl =
process.env.BASE_URL ||
"https://www.protradersfx.com";

if (!clientId) {
return res.status(503).json({
error: "Deriv client ID not configured",
message: "Set DERIV_CLIENT_ID in Vercel Environment Variables."
});
}

const redirectUri =
baseUrl.replace(//+$/, "") +
"/oauth/callback";

const url =
"https://oauth.deriv.com/oauth2/authorize" +
"?app_id=" +
encodeURIComponent(clientId) +
"&redirect_uri=" +
encodeURIComponent(redirectUri);

return res.redirect(url);
});

/* =========================================================
DERIV SIGNUP
========================================================= */

app.get("/api/deriv/signup", function (req, res) {
const clientId =
process.env.DERIV_CLIENT_ID ||
process.env.DERIV_PUBLIC_APP_ID ||
"";

const baseUrl =
process.env.BASE_URL ||
"https://www.protradersfx.com";

if (!clientId) {
return res.status(503).json({
error: "Deriv client ID not configured",
message: "Set DERIV_CLIENT_ID in Vercel Environment Variables."
});
}

const redirectUri =
baseUrl.replace(//+$/, "") +
"/oauth/callback";

const url =
"https://oauth.deriv.com/oauth2/authorize" +
"?app_id=" +
encodeURIComponent(clientId) +
"&redirect_uri=" +
encodeURIComponent(redirectUri);

return res.redirect(url);
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
"/?oauth_error=missing_authorization_code"
);
}

/*

* Do not fabricate an authenticated account.
* The actual OAuth token exchange still needs to be
* connected to the authenticated Deriv adapter.
  */

return res.redirect(
"/?oauth_code_received=true"
);
});

/* =========================================================
SESSION
========================================================= */

app.get("/api/session", function (req, res) {
res.json({
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
ACCOUNT
========================================================= */

app.get("/api/account", function (req, res) {
return res.status(501).json({
error: "Account adapter not configured",
message:
"Connect the authenticated Deriv account adapter before requesting account data."
});
});

/* =========================================================
TRADING
========================================================= */

app.post("/api/trades", function (req, res) {
return res.status(501).json({
error: "Trading adapter not configured",
message:
"Live trading is disabled until the authenticated Deriv trading adapter is connected."
});
});

/* =========================================================
BOT
========================================================= */

app.post("/api/bot", function (req, res) {
const action =
String(req.body && req.body.action || "")
.toLowerCase();

if (!["start", "stop"].includes(action)) {
return res.status(400).json({
error: "Invalid bot action"
});
}

return res.status(501).json({
error: "Bot adapter not configured",
message:
"Bot " +
action +
" was received, but live execution is not enabled yet."
});
});

/* =========================================================
LOGOUT
========================================================= */

app.post("/api/logout", function (req, res) {
res.json({
ok: true,
authenticated: false
});
});

/* =========================================================
TRACKING
========================================================= */

app.post("/api/track", function (req, res) {
res.status(204).end();
});

app.get("/api/analytics", function (req, res) {
res.json({
ok: true,
events: []
});
});

/* =========================================================
MARKET API
========================================================= */

app.get("/api/market", function (req, res) {
res.json({
service: "protraders-fx-market",
provider: "Deriv",
mode: "client-websocket",
configured: Boolean(
process.env.DERIV_PUBLIC_APP_ID ||
process.env.DERIV_CLIENT_ID
)
});
});

/* =========================================================
FAVICON
========================================================= */

app.get("/favicon.ico", function (req, res) {
const ico = path.join(ROOT, "favicon.ico");
const svg = path.join(ROOT, "favicon.svg");

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
const file = path.join(ROOT, "index.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(500).send(
"<!doctype html>" +
"<html>" +
"<head><title>ProTraders FX</title></head>" +
"<body>" +
"<h1>ProTraders FX</h1>" +
"<p>index.html is missing.</p>" +
"</body>" +
"</html>"
);
});

/* =========================================================
WORKSPACE
========================================================= */

app.get("/workspace", function (req, res) {
const file = path.join(ROOT, "workspace.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(404).send("workspace.html not found");
});

app.get("/workspace.html", function (req, res) {
const file = path.join(ROOT, "workspace.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(404).send("workspace.html not found");
});

/* =========================================================
STATIC FILES
========================================================= */

app.use(
express.static(ROOT, {
index: false,
dotfiles: "ignore"
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
const file = path.join(
ROOT,
htmlRoutes[route]
);

```
if (fs.existsSync(file)) {
  return res.sendFile(file);
}

return res.status(404).send(
  htmlRoutes[route] + " not found"
);
```

});
});

/* =========================================================
ERROR HANDLER
========================================================= */

app.use(function (error, req, res, next) {
console.error("SERVER ERROR:", error);

if (res.headersSent) {
return next(error);
}

res.status(500).json({
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
const PORT = Number(
process.env.PORT || 3000
);

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
