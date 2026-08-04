import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { initDb } from "./config/db.js";
import { attachCurrentUser } from "./middleware/auth.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.js";
import { asyncHandler } from "./middleware/async-handler.js";
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
import { uploadRouter } from "./routes/upload.js";
import { corsAllowlist } from "./config/env.js";

export function createApp(env) {
  initDb(env.DATABASE_URL);

  const app = new Hono();

  app.use("*", secureHeaders({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        fontSrc: ["'self'", "https:", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
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

  const allowedOrigins = corsAllowlist(env);
  const isWildcard = allowedOrigins.includes("*");

  app.use("*", cors({
    origin: (origin) => {
      if (isWildcard) return "*";
      if (!origin || origin === "null") return "";
      if (allowedOrigins.includes(origin)) return origin;
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(origin)) return origin;
      return "";
    }
  }));

  const rateLimiter = (windowMs, max) => {
    const hits = new Map();
    return async (c, next) => {
      const key = c.req.header("CF-Connecting-IP") || "anon";
      const now = Date.now();
      const window = Math.floor(now / windowMs);
      const slotKey = `${key}:${window}`;
      hits.set(slotKey, (hits.get(slotKey) || 0) + 1);

      if (hits.get(slotKey) > max) {
        const retryAfter = Math.ceil((windowMs - (now % windowMs)) / 1_000);
        c.header("Retry-After", String(retryAfter));
        return c.json({ error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后重试" } }, 429);
      }

      if (hits.size > 10000) {
        const cutoff = window - 2;
        for (const [k] of hits) {
          if (parseInt(k.split(":").pop() || "0", 10) < cutoff) hits.delete(k);
        }
      }

      await next();
    };
  };

  app.get("/health", (c) => c.json({ status: "ok", service: "tcm-clinic-api" }));

  app.use("/api/*", async (c, next) => {
    const publicPaths = ["/api/auth/wechat-login", "/api/auth/admin-login"];
    if (publicPaths.includes(c.req.path)) return next();
    return attachCurrentUser(c, next);
  });

  app.use("/api/auth/admin-login", rateLimiter(60_000, 5));
  app.use("/api/appointments", rateLimiter(60_000, 10));
  app.use("/api", rateLimiter(60_000, 100));

  app.route("/api", authRouter());
  app.route("/api", catalogRouter());
  app.route("/api", appointmentsRouter());
  app.route("/api", profileRouter());
  app.route("/api", healthRecordsRouter());
  app.route("/api", technicianRouter());
  app.route("/api", ordersRouter());
  app.route("/api", reviewsRouter());
  app.route("/api", contentRouter());
  app.route("/api", userRouter());
  app.route("/api", favoritesRouter());
  app.route("/api", uploadRouter());
  app.route("/api", adminRouter());

  app.notFound(notFoundMiddleware);
  app.onError(errorMiddleware);

  return app;
}