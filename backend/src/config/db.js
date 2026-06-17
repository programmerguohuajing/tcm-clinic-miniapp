import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000)
});

pool.on("error", (err) => {
  console.error("[db] unexpected pool error:", err.message);
});

export async function query(text, params = []) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (process.env.NODE_ENV !== "test") {
    const duration = Date.now() - start;
    const threshold = Number(process.env.SLOW_QUERY_MS || 250);
    if (duration > threshold) {
      console.warn(`[db] slow query ${duration}ms`, text);
    }
  }
  return result;
}
