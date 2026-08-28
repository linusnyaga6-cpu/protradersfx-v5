const express = require("express");

const app = express();

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "protraders-fx",
    time: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.status(200).send("PROTRADERS FX API ONLINE");
});

module.exports = app;
