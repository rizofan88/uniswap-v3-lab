import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import * as handlers from "./handlers";

const app = express();

app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    console.log(
      `[API] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`
    );
  });

  next();
});

const oneDayMs = 24 * 60 * 60 * 1000;

const initStateDailyLimiter = rateLimit({
  windowMs: oneDayMs,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Daily fork initialization limit reached. Please try again later.",
  },
});

const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many ping requests. Please slow down.",
  },
});

const generalDailyLimiter = rateLimit({
  windowMs: oneDayMs,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Daily API limit reached. Please try again later.",
  },
});


app.post("/api/init-session", initStateDailyLimiter, handlers.initSessionHandler);

app.post("/api/ping-session", pingLimiter, handlers.pingSessionHandler);

app.use("/api", generalDailyLimiter);

app.get("/api/session-status", handlers.sessionStatusHandler);

app.get("/api/quote", handlers.quoteHandler);

app.get("/api/accounts", handlers.getLocalAccountsListHandler);

app.get("/api/token-list", handlers.getTokenListHandler);

app.get("/api/wallet-summary", handlers.getWalletSummaryHandler);

app.post("/api/swap", handlers.swapHandler);

const port = 3001;

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

