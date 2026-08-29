import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { databaseConfigured } from "@workspace/db";
import router from "./routes";
import { handleOAuthCallback } from "./routes/protraders";
import { logger } from "./lib/logger";

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
if (allowedOrigins.length > 0) {
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));
}
app.use(helmet({
  contentSecurityPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "protraders-fx",
    persistence: databaseConfigured ? "configured" : "optional-unavailable",
  });
});

const persistenceRoutes = [
  "/transactions",
  "/trades",
  "/risk-acknowledgements",
  "/templates",
  "/bots",
  "/runs",
  "/snapshots",
  "/recovery-incidents",
];

app.use("/api", (req, res, next) => {
  if (
    !databaseConfigured &&
    persistenceRoutes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))
  ) {
    res.status(503).json({
      error: "Persistence unavailable",
      message: "Configure DATABASE_URL or POSTGRES_URL with a Vercel-compatible PostgreSQL database to use this feature.",
    });
    return;
  }
  next();
});

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.get("/oauth/callback", handleOAuthCallback);

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  req.log?.error({ err: error }, "Unhandled API request error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
