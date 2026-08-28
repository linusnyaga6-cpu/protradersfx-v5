```javascript
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

const ROOT = __dirname;

app.get("/health", function (req, res) {
  res.status(200).json({
    ok: true,
    service: "protraders-fx",
    status: "healthy",
    time: new Date().toISOString()
  });
});

app.get("/api/config", function (req, res) {
  res.status(200).json({
    configured: Boolean(process.env.DERIV_CLIENT_ID),
    publicAppId: process.env.DERIV_PUBLIC_APP_ID || ""
  });
});

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

app.get("/api/preflight", function (req, res) {
  const baseUrl =
    process.env.BASE_URL || "https://protradersfx.com";

  res.status(200).json({
    productionBaseUrl: baseUrl,
    redirectUri: baseUrl + "/oauth/callback",
    https: baseUrl.startsWith("https://"),
    oauthClientConfigured:
      Boolean(process.env.DERIV_CLIENT_ID),
    sessionSecretConfigured:
      Boolean(process.env.SESSION_SECRET)
  });
});

app.get("/app-config.js", function (req, res) {
  res
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
  const svg = path.join(ROOT, "favicon.svg");
  const ico = path.join(ROOT, "favicon.ico");

  if (fs.existsSync(ico)) {
    return res.sendFile(ico);
  }

  if (fs.existsSync(svg)) {
    return res.sendFile(svg);
  }

  return res.status(204).end();
});

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

app.get("/", function (req, res) {
  const file = path.join(ROOT, "index.html");

  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }

  return res.status(200).send(
    "<!doctype html>" +
    "<html><head><title>ProTraders FX</title></head>" +
    "<body><h1>ProTraders FX</h1>" +
    "<p>Server is running.</p></body></html>"
  );
});

app.use(express.static(ROOT));

app.use(function (req, res) {
  res.status(404).json({
    error: "Not found",
    path: req.path
  });
});

app.use(function (error, req, res, next) {
  console.error("SERVER ERROR:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal server error"
  });
});

if (require.main === module) {
  const PORT = Number(process.env.PORT || 3000);

  app.listen(PORT, function () {
    console.log(
      "[PROTRADERS FX] Server running on port " + PORT
    );
  });
}

module.exports = app;
```
