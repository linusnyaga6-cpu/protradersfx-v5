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
   PUBLIC DERIV CONFIG
   ========================================================= */

app.get("/api/config", function (req, res) {
  const appId =
    process.env.DERIV_PUBLIC_APP_ID ||
    process.env.DERIV_CLIENT_ID ||
    "";

  res.status(200).json({
    configured: Boolean(appId),
    publicAppId: appId
  });
});

/* =========================================================
   FRONTEND APP CONFIG
   ========================================================= */

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
   PREFLIGHT
   ========================================================= */

app.get("/api/preflight", function (req, res) {
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
   * The frontend/backend OAuth exchange must be connected
   * to the authenticated Deriv adapter separately.
   *
   * We do not fabricate an authenticated session here.
   */
  return res.redirect(
    "/?oauth_error=authentication_adapter_not_configured"
  );
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
    "<html><head><title>ProTraders FX</title></head>" +
    "<body><h1>ProTraders FX</h1>" +
    "<p>index.html is missing.</p></body></html>"
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
   STATIC FRONTEND
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
    const file = path.join(ROOT, htmlRoutes[route]);

    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }

    return res.status(404).send(
      htmlRoutes[route] + " not found"
    );
  });
});

/* =========================================================
   HTML FILE ALIASES
   ========================================================= */

const htmlAliases = [
  "privacy",
  "terms",
  "signals",
  "marketplace",
  "builder",
  "course"
];

htmlAliases.forEach(function (name) {
  app.get("/" + name + ".html", function (req, res) {
    const file = path.join(ROOT, name + ".html");

    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }

    return res.status(404).send(
      name + ".html not found"
    );
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
   LOCAL DEVELOPMENT
   ========================================================= */

if (require.main === module) {
  const PORT = Number(
    process.env.PORT || 3000
  );

  app.listen(PORT, function () {
    console.log(
      "[PROTRADERS FX] Server running on port " + PORT
    );
  });
}

/* =========================================================
   VERCEL
   ========================================================= */

module.exports = app;
