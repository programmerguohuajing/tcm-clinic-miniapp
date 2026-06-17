import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { pool } from "./config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const port = Number(process.env.PORT || 3000);

process.on("unhandledRejection", (err) => {
  console.error("[server] Unhandled rejection:", err);
  process.exit(1);
});

async function start() {
  try {
    await pool.query("select 1");
    console.log("[server] database connection OK");
  } catch (err) {
    console.error("[server] database connection FAILED:", err.message);
    process.exit(1);
  }

  const app = createApp();
  app.listen(port, () => {
    console.log(`TCM clinic API listening on http://localhost:${port}`);
  });
}

start();
