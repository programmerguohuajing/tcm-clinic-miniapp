import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, initDb } from "../src/config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .dev.vars so scripts work without manual env setup
const devVarsPath = path.join(__dirname, "..", "..", ".dev.vars");
try {
  const devVars = await fs.readFile(devVarsPath, "utf8");
  for (const line of devVars.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch (_e) {
  // .dev.vars not found — rely on environment variables
}

initDb();

/**
 * Split SQL text into individual statements.
 * Skips semicolons inside $$...$$ blocks (PL/pgSQL function bodies).
 */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inDollar = false;

  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === "$" && sql[i + 1] === "$") {
      inDollar = !inDollar;
      current += sql[i];
      continue;
    }

    if (sql[i] === ";" && !inDollar) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      continue;
    }

    current += sql[i];
  }

  const last = current.trim();
  if (last) statements.push(last);

  return statements;
}

const sqlFiles = [
  "seed.sql",
  "seed_messages.sql"
];

for (const file of sqlFiles) {
  const sqlPath = path.join(__dirname, "..", "database", file);
  const sql = await fs.readFile(sqlPath, "utf8");
  const statements = splitStatements(sql);

  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch (err) {
      if (!err.message?.includes("already exists") && !err.message?.includes("duplicate key")) {
        console.error(`  ✗ ${file} — ${err.message}`);
        console.error(`    SQL: ${stmt.slice(0, 100)}...`);
        throw err;
      }
    }
  }

  console.log(`  ✓ ${file} (${statements.length} statements)`);
}

console.log("演示数据写入完成");
