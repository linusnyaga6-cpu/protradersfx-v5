const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel/serverless-safe static directory.
// IMPORTANT: this does NOT create or write to /var/task/data.
const publicDir = path.join(__dirname, "public");

// Health check — must work even if other files are missing.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ProTradersFX",
    environment: process.env.VERCEL_ENV || "production",
    timestamp: new Date().toISOString()
  });
});

// Simple API status endpoint.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ProTradersFX API",
    timestamp: new Date().toISOString()
  });
});

// Serve the website files if /public exists.
app.use(express.static(publicDir));

// Homepage.
app.get("/", (req, res) => {
  res.sendFile(
    path.join(publicDir, "index.html"),
    (err) => {
      if (err) {
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <title>ProTradersFX</title>
            </head>
            <body>
              <h1>ProTradersFX</h1>
              <p>Server is running.</p>
              <p>Health: <a href="/health">/health</a></p>
            </body>
          </html>
        `);
      }
    }
  );
});

// Do not crash on favicon requests.
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

app.get("/favicon.png", (req, res) => {
  res.status(204).end();
});

// Basic 404 response.
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path
  });
});

// Export for Vercel.
module.exports = app;

// Also allow normal Node execution.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`ProTradersFX running on port ${PORT}`);
  });
}
