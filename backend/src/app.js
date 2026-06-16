import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const previewDir = path.resolve(__dirname, "..", "preview");
const adminPcDir = path.resolve(__dirname, "..", "..", "pc-admin", "dist");
const isProduction = process.env.NODE_ENV === "production";

function corsOptions() {
  if (!isProduction) return {};

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

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(isProduction ? "combined" : "dev"));
  app.use(express.static(previewDir));
  app.use("/pc-admin", express.static(adminPcDir));
  app.get("/pc-admin/*", (_req, res) => {
    res.sendFile(path.join(adminPcDir, "index.html"));
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "tcm-clinic-api" });
  });

  app.use("/api", authRouter);
  app.use("/api", attachCurrentUser);
  app.use("/api", catalogRouter);
  app.use("/api", appointmentsRouter);
  app.use("/api", profileRouter);
  app.use("/api", healthRecordsRouter);
  app.use("/api", technicianRouter);
  app.use("/api", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
