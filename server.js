"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

const ROOT = __dirname;

/* ==================================================
HEALTH
================================================== */

app.get("/health", (req, res) => {
res.status(200).json({
ok: true,
service: "protraders-fx",
status: "healthy",
time: new Date().toISOString()
});
});

/* ==================================================
PUBLIC CONFIG
================================================== */

app.get("/api/config", (req, res) => {
const appId =
process.env.DERIV_PUBLIC_APP_ID ||
process.env.DERIV_CLIENT_ID ||
"";

res.status(200).json({
configured: Boolean(appId),
publicAppId: appId
});
});

app.get("/app-config.js", (req, res) => {
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

/* ==================================================
SESSION
================================================== */

app.get("/api/session", (req, res) => {
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

/* ==================================================
PREFLIGHT
================================================== */

app.get("/api/preflight", (req, res) => {
const baseUrl =
process.env.BASE_URL ||
"https://www.protradersfx.com";

res.status(200).json({
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

/* ==================================================
FAVICON
================================================== */

app.get("/favicon.ico", (req, res) => {
const ico = path.join(ROOT, "favicon.ico");
const svg = path.join(ROOT, "favicon.svg");

if (fs.existsSync(ico)) {
return res.sendFile(ico);
}

if (fs.existsSync(svg)) {
return res.type("image/svg+xml").sendFile(svg);
}

return res.status(204).end();
});

/* ==================================================
DERIV LOGIN
================================================== */

app.get("/api/deriv/login", (req, res) => {
const appId =
process.env.DERIV_CLIENT_ID ||
process.env.DERIV_PUBLIC_APP_ID ||
"";

const baseUrl =
process.env.BASE_URL ||
"https://www.protradersfx.com";

if (!appId) {
return res.status(503).send(
"Deriv login is not configured. Add DERIV_CLIENT_ID or DERIV_PUBLIC_APP_ID in Vercel Environment Variables."
);
}

const redirectUri =
baseUrl.replace(//$/, "") +
"/oauth/callback";

const loginUrl =
"https://oauth.deriv.com/oauth2/authorize" +
"?app_id=" +
encodeURIComponent(appId) +
"&redirect_uri=" +
encodeURIComponent(redirectUri);

return res.redirect(loginUrl);
});

/* ==================================================
DERIV SIGNUP
================================================== */

app.get("/api/deriv/signup", (req, res) => {
const appId =
process.env.DERIV_CLIENT_ID ||
process.env.DERIV_PUBLIC_APP_ID ||
"";

const baseUrl =
process.env.BASE_URL ||
"https://www.protradersfx.com";

if (!appId) {
return res.status(503).send(
"Deriv signup is not configured. Add DERIV_CLIENT_ID or DERIV_PUBLIC_APP_ID in Vercel Environment Variables."
);
}

const redirectUri =
baseUrl.replace(//$/, "") +
"/oauth/callback";

const signupUrl =
"https://oauth.deriv.com/oauth2/authorize" +
"?app_id=" +
encodeURIComponent(appId) +
"&redirect_uri=" +
encodeURIComponent(redirectUri);

return res.redirect(signupUrl);
});

/* ==================================================
OAUTH CALLBACK
================================================== */

app.get("/oauth/callback", (req, res) => {
const code = req.query.code;

if (!code) {
return res.redirect(
"/?oauth_error=authorization_failed"
);
}

/*

* The callback is deliberately kept safe here.
* A real authenticated Deriv session must be created
* by the account/session adapter before trading.
  */
  return res.redirect(
  "/workspace?oauth=received"
  );
  });

/* ==================================================
TRACKING
================================================== */

app.post("/api/track", (req, res) => {
res.status(200).json({
ok: true
});
});

/* ==================================================
ACCOUNT
================================================== */

app.get("/api/account", (req, res) => {
return res.status(501).json({
error: "Account adapter not configured",
message:
"Connect the authenticated Deriv account adapter before account data is displayed."
});
});

/* ==================================================
TRADING
================================================== */

app.post("/api/trades", (req, res) => {
if (req.method !== "POST") {
return res.status(405).json({
error: "Method not allowed"
});
}

return res.status(501).json({
error: "Trading adapter not configured",
message:
"The trading interface is ready, but live Deriv order execution requires the authenticated Deriv trading adapter."
});
});

/* ==================================================
BOT
================================================== */

app.post("/api/bot", (req, res) => {
const action =
String(req.body?.action || "").toLowerCase();

if (!["start", "stop"].includes(action)) {
return res.status(400).json({
error: "Invalid bot action"
});
}

return res.status(501).json({
error: "Free bot execution adapter not configured",
message:
"Free bot " +
action +
" acknowledged by the interface. Connect the authenticated Deriv bot adapter before real execution."
});
});

/* ==================================================
LOGOUT
================================================== */

app.post("/api/logout", (req, res) => {
res.status(200).json({
ok: true,
authenticated: false
});
});

/* ==================================================
WORKSPACE
================================================== */

app.get("/workspace", (req, res) => {
const file = path.join(ROOT, "workspace.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(404).send(
"workspace.html not found"
);
});

app.get("/workspace.html", (req, res) => {
const file = path.join(ROOT, "workspace.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(404).send(
"workspace.html not found"
);
});

/* ==================================================
HOMEPAGE
================================================== */

app.get("/", (req, res) => {
const file = path.join(ROOT, "index.html");

if (fs.existsSync(file)) {
return res.sendFile(file);
}

return res.status(500).send(
"<!doctype html>" +
"<html><head><title>ProTraders FX</title></head>" +
"<body><h1>ProTraders FX</h1>" +
"<p>index.html is missing.</p></body></html>"
);
});

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

Object.keys(htmlRoutes).forEach((route) => {
app.get(route, (req, res) => {
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

/* ==================================================
STATIC FILES
IMPORTANT:
style.css, tracker.js, workspace.js,
logo.svg and other frontend files are in ROOT.
================================================== */

app.use(
express.static(ROOT, {
index: false,
dotfiles: "ignore"
})
);

/* ==================================================
ERROR HANDLER
================================================== */

app.use((error, req, res, next) => {
console.error("SERVER ERROR:", error);

if (res.headersSent) {
return next(error);
}

return res.status(500).json({
error: "Internal server error"
});
});

/* ==================================================
404
================================================== */

app.use((req, res) => {
return res.status(404).json({
error: "Not found",
path: req.path
});
});

/* ==================================================
LOCAL DEVELOPMENT
================================================== */

if (require.main === module) {
const PORT =
Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
console.log(
"[PROTRADERS FX] Server running on port " +
PORT
);
});
}

/* ==================================================
VERCEL
================================================== */

module.exports = app;
