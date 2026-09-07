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
  const dbDir = path.resolve(__dirname, "..", "..", "database");
  const db = SQL(databaseUrl);

  // 按分号拆分 SQL，但 $$...$$ 内的分号（PL/pgSQL 函数体）不算语句边界。
  // @neondatabase/serverless 的整段 .unsafe() 不会可靠执行多语句，故逐条 query 执行（与 init-db.js 一致）。
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

  const run = async (label, file) => {
    try {
      const sql = await fs.readFile(path.join(dbDir, file), "utf8");
      const stmts = splitStatements(sql);
      for (const stmt of stmts) {
        try {
          await db.query(stmt, []);
        } catch (err) {
          // 幂等重跑：已存在 / 重复键 忽略
          if (!/already exists|duplicate key|already been|nothing to do/i.test(err.message || "")) {
            console.error(`  ✗ ${file} — ${err.message}`);
            console.error(`    SQL: ${stmt.slice(0, 120)}...`);
            throw err;
          }
        }
      }
      console.log(`[migrate] ${label} OK (${stmts.length} statements)`);
    } catch (err) {
      console.error(`[migrate] ${label} failed:`, err.message);
    }
  };

  await run("schema", "schema.sql");
  await run("comments", "comments.sql");
  await run("migrate_favorites", "migrate_favorites.sql");
  await run("migrate_payment_configs", "migrate_payment_configs.sql");
  await run("migrate_multi_tenant_page", "migrate_multi_tenant_page.sql");
  await run("migrate_tenant_isolation", "migrate_tenant_isolation.sql");
  await run("migrate_payment_model", "migrate_payment_model.sql");
  await run("migrate_gym_model", "migrate_gym_model.sql");
  await run("migrate_template_pages", "migrate_template_pages.sql");
  await run("migrate_refunds", "migrate_refunds.sql");
  await run("migrate_plans", "migrate_plans.sql");

  console.log("[migrate] all done");
}
