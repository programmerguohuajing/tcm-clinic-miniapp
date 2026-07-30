import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachCurrentUser } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { profileRouter } from "./routes/profile.js";
import { healthRecordsRouter } from "./routes/health-records.js";
import { adminRouter } from "./routes/admin.js";
import { technicianRouter } from "./routes/technician.js";
import { ordersRouter } from "./routes/orders.js";
import { reviewsRouter } from "./routes/reviews.js";
import { contentRouter } from "./routes/content.js";
import { userRouter } from "./routes/user.js";
import { favoritesRouter } from "./routes/favorites.js";
import { isProduction } from "./config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const previewDir = path.resolve(__dirname, "..", "preview");
const adminPcDir = path.resolve(__dirname, "..", "..", "pc-admin", "dist");

function corsOptions() {
  if (!isProduction()) {
    console.warn("[app] DEV: CORS allows localhost origins");
    return {
      origin(origin, callback) {
        if (!origin || /^https?:\/\/localhost(:\d+)?/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?/.test(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      }
    };
  }

  const allowlist = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowlist.includes(origin)) return callback(null, true);
      return callback(new Error("当前来源不允许访问"));
    }
  };
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: { code: "RATE_LIMITED", message: "登录请求过于频繁，请稍后重试" } }
});

const appointmentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: { code: "RATE_LIMITED", message: "预约请求过于频繁，请稍后重试" } }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后重试" } }
});

export function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        fontSrc: ["'self'", "https:", "data:"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false
  }));
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(isProduction() ? "combined" : "dev"));
  app.use(express.static(previewDir));
  app.use("/pc-admin", express.static(adminPcDir));
  app.get("/pc-admin/*", (_req, res) => {
    res.sendFile(path.join(adminPcDir, "index.html"));
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "tcm-clinic-api" });
  });

  app.use("/api/auth/wechat-login", loginLimiter);
  app.use("/api/auth/admin-login", loginLimiter);
  app.use("/api/appointments", appointmentLimiter);
  app.use("/api", apiLimiter);

  app.use("/api", authRouter);
  app.use("/api", attachCurrentUser);
  app.use("/api", catalogRouter);
  app.use("/api", appointmentsRouter);
  app.use("/api", profileRouter);
  app.use("/api", healthRecordsRouter);
  app.use("/api", technicianRouter);
  app.use("/api", ordersRouter);
  app.use("/api", reviewsRouter);
  app.use("/api", contentRouter);
  app.use("/api", userRouter);
  app.use("/api", favoritesRouter);
  app.use("/api", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
