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
const PUBLIC = path.join(ROOT, "public");

function existingFile(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error("FILE CHECK ERROR:", error);
    return false;
  }
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
   FAVICON
========================= */

app.get("/favicon.ico", function (req, res) {
  const file = path.join(PUBLIC, "favicon.ico");

  if (existingFile(file)) {
    return res.sendFile(file);
  }

  return res.status(204).end();
});

/* =========================
   API CONFIG
========================= */

app.get("/api/config", function (req, res) {
  return res.status(200).json({
    configured: Boolean(process.env.DERIV_CLIENT_ID),
    publicAppId: process.env.DERIV_PUBLIC_APP_ID || ""
  });
});

/* =========================
   SESSION
========================= */

app.get("/api/session", function (req, res) {
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
});

/* =========================
   PREFLIGHT
========================= */

app.get("/api/preflight", function (req, res) {
  const baseUrl =
    process.env.BASE_URL || "https://protradersfx.com";

  return res.status(200).json({
    productionBaseUrl: baseUrl,
    redirectUri: baseUrl + "/oauth/callback",
    https: true,
    oauthClientConfigured: Boolean(
      process.env.DERIV_CLIENT_ID
    ),
    sessionSecretConfigured: Boolean(
      process.env.SESSION_SECRET
    )
  });
});

/* =========================
   PUBLIC APP CONFIG
========================= */

app.get("/app-config.js", function (req, res) {
  res.type("application/javascript");

  return res.send(
    "window.PROTRADERS_PUBLIC_APP_ID=" +
      JSON.stringify(
        process.env.DERIV_PUBLIC_APP_ID || ""
      ) +
      ";"
  );
});

/* =========================
   STATIC FILES
========================= */

if (existingFile(PUBLIC)) {
  app.use(express.static(PUBLIC));
}

/* =========================
   ROOT PAGE
========================= */

app.get("/", function (req, res) {
  const publicIndex = path.join(
    PUBLIC,
    "index.html"
  );

  const rootIndex = path.join(
    ROOT,
    "index.html"
  );

  if (existingFile(publicIndex)) {
    return res.sendFile(publicIndex);
  }

  if (existingFile(rootIndex)) {
    return res.sendFile(rootIndex);
  }

  return res.status(200).type("html").send(
    "<!doctype html>" +
      "<html>" +
      "<head>" +
      "<meta charset=\"utf-8\">" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
      "<title>ProTraders FX</title>" +
      "</head>" +
      "<body>" +
      "<h1>ProTraders FX</h1>" +
      "<p>Server is running.</p>" +
      "</body>" +
      "</html>"
  );
});

/* =========================
   WORKSPACE
========================= */

app.get("/workspace", function (req, res) {
  const file = path.join(
    PUBLIC,
    "workspace.html"
  );

  if (existingFile(file)) {
    return res.sendFile(file);
  }

  return res.status(404).send(
    "workspace.html not found"
  );
});

app.get("/workspace.html", function (req, res) {
  const file = path.join(
    PUBLIC,
    "workspace.html"
  );

  if (existingFile(file)) {
    return res.sendFile(file);
  }

  return res.status(404).send(
    "workspace.html not found"
  );
});

/* =========================
   OAUTH CALLBACK PLACEHOLDER
========================= */

app.get("/oauth/callback", function (req, res) {
  return res.status(200).send(
    "<!doctype html>" +
      "<html>" +
      "<head><title>ProTraders FX</title></head>" +
      "<body>" +
      "<h2>ProTraders FX OAuth Callback</h2>" +
      "<p>OAuth callback endpoint is active.</p>" +
      "</body>" +
      "</html>"
  );
});

/* =========================
   404
========================= */

app.use(function (req, res) {
  return res.status(404).json({
    error: "Not found",
    path: req.path
  });
});

/* =========================
   ERROR HANDLER
========================= */

app.use(function (error, req, res, next) {
  console.error(
    "[PROTRADERS FX] SERVER ERROR:",
    error
  );

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    error: "Internal server error"
  });
});

/* =========================
   LOCAL SERVER ONLY
========================= */

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

/* =========================
   VERCEL EXPORT
========================= */

module.exports = app;
```
