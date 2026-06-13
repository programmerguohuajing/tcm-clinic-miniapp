import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachDemoUser } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { catalogRouter } from "./routes/catalog.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { profileRouter } from "./routes/profile.js";
import { healthRecordsRouter } from "./routes/health-records.js";
import { adminRouter } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const previewDir = path.resolve(__dirname, "..", "preview");
const adminPcDir = path.resolve(__dirname, "..", "..", "pc-admin", "dist");

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));
  app.use(express.static(previewDir));
  app.use("/pc-admin", express.static(adminPcDir));
  app.get("/pc-admin/*", (_req, res) => {
    res.sendFile(path.join(adminPcDir, "index.html"));
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "tcm-clinic-api" });
  });

  app.use("/api", attachDemoUser);
  app.use("/api", catalogRouter);
  app.use("/api", appointmentsRouter);
  app.use("/api", profileRouter);
  app.use("/api", healthRecordsRouter);
  app.use("/api", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
