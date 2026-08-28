import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import router from "./routes";
import { handleOAuthCallback } from "./routes/protraders";
import { logger } from "./lib/logger";

const app: Express = express();
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

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.get("/oauth/callback", handleOAuthCallback);

export default app;
