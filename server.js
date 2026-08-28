"use strict";

const express = require("express");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = String(
process.env.BASE_URL || "https://www.protradersfx.com"
).replace(//+$/, "");

const PUBLIC_DIR = path.join(__dirname, "public");

app.disable("x-powered-by");

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

app.get("/health", function (req, res) {
return res.status(200).json({
ok: true,
service: "protraders-fx",
status: "healthy"
});
});

app.get("/api/config", function (req, res) {
return res.status(200).json({
configured: Boolean(process.env.DERIV_CLIENT_ID),
publicAppId: process.env.DERIV_PUBLIC_APP_ID || ""
});
});

app.get("/api/session", function (req, res) {
return res.status(200).json({
authenticated: false,
accountId: null,
balance: null,
currency: null
});
});

app.get("/api/preflight", function (req, res) {
return res.status(200).json({
productionBaseUrl: BASE_URL,
redirectUri: BASE_URL + "/oauth/callback",
https: BASE_URL.indexOf("https://") === 0,
oauthClientConfigured: Boolean(
process.env.DERIV_CLIENT_ID
),
sessionSecretConfigured: Boolean(
process.env.SESSION_SECRET
)
});
});

app.get("/app-config.js", function (req, res) {
return res
.type("application/javascript")
.send(
"window.PROTRADERS_PUBLIC_APP_ID=" +
JSON.stringify(
process.env.DERIV_PUBLIC_APP_ID || ""
) +
";"
);
});

app.get("/favicon.ico", function (req, res) {
return res.status(204).end();
});

app.use(
express.static(PUBLIC_DIR, {
extensions: ["html"],
fallthrough: true
})
);

app.get("/", function (req, res) {
const indexFile = path.join(
PUBLIC_DIR,
"index.html"
);

return res.sendFile(indexFile, function (error) {
if (error) {
console.error("INDEX ERROR:", error);
return res.status(200).send(
"<!doctype html><html><head><title>ProTraders FX</title></head><body><h1>ProTraders FX</h1><p>Server is running.</p></body></html>"
);
}

```
return undefined;
```

});
});

app.get("*", function (req, res) {
if (
req.path === "/health" ||
req.path === "/favicon.ico"
) {
return undefined;
}

const indexFile = path.join(
PUBLIC_DIR,
"index.html"
);

return res.sendFile(indexFile, function (error) {
if (error) {
return res.status(404).json({
error: "Not found"
});
}

```
return undefined;
```

});
});

app.use(function (error, req, res, next) {
console.error("SERVER ERROR:", error);

if (res.headersSent) {
return next(error);
}

return res.status(500).json({
error: "Internal server error"
});
});

if (require.main === module) {
app.listen(PORT, function () {
console.log(
"[PROTRADERS FX] running on " + BASE_URL
);
});
}

module.exports = app;
