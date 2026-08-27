```js
const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicPath = path.join(__dirname, "public");

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ProTradersFX",
    timestamp: new Date().toISOString()
  });
});

// API health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    api: "ProTradersFX",
    timestamp: new Date().toISOString()
  });
});

// Static website files
app.use(express.static(publicPath));

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"), (error) => {
    if (error) {
      console.error("Homepage error:", error);

      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ProTradersFX</title>
        </head>
        <body>
          <h1>ProTradersFX</h1>
          <p>Server is online.</p>
          <p><a href="/health">Check server health</a></p>
        </body>
        </html>
      `);
    }
  });
});

// Favicon requests must never crash the server
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

app.get("/favicon.png", (req, res) => {
  res.status(204).end();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path
  });
});

// Vercel serverless export
module.exports = app;

// Local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`ProTradersFX running on port ${PORT}`);
  });
}
```
