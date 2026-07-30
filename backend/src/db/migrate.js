import { neon } from "@neondatabase/serverless";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SQL = neon;

export async function migrate(databaseUrl) {
  if (!databaseUrl) {
    console.error("[migrate] DATABASE_URL is not set");
    return;
  }

  console.log("[migrate] running migrations...");

  // schema.sql contains CREATE TABLE IF NOT EXISTS, so it's safe to run on every cold start
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbDir = path.resolve(__dirname, "..", "..", "..", "database");

  try {
    const schema = await fs.readFile(path.join(dbDir, "schema.sql"), "utf8");
    await SQL(databaseUrl)`${SQL.raw(schema)}`;
    console.log("[migrate] schema OK");
  } catch (err) {
    console.error("[migrate] schema failed:", err.message);
  }

  try {
    const comments = await fs.readFile(path.join(dbDir, "comments.sql"), "utf8");
    await SQL(databaseUrl)`${SQL.raw(comments)}`;
    console.log("[migrate] comments OK");
  } catch (err) {
    console.error("[migrate] comments failed:", err.message);
  }

  try {
    const fav = await fs.readFile(path.join(dbDir, "migrate_favorites.sql"), "utf8");
    await SQL(databaseUrl)`${SQL.raw(fav)}`;
    console.log("[migrate] migrate_favorites OK");
  } catch (err) {
    console.error("[migrate] migrate_favorites failed:", err.message);
  }

  try {
    const payment = await fs.readFile(path.join(dbDir, "migrate_payment_configs.sql"), "utf8");
    await SQL(databaseUrl)`${SQL.raw(payment)}`;
    console.log("[migrate] migrate_payment_configs OK");
  } catch (err) {
    console.error("[migrate] migrate_payment_configs failed:", err.message);
  }

  console.log("[migrate] all done");
}
