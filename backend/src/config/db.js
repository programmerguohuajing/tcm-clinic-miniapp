import { neon } from "@neondatabase/serverless";

let _sql = null;

export function initDb(databaseUrl) {
  if (_sql) return;
  databaseUrl = databaseUrl || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("[db] DATABASE_URL is not set");
  _sql = neon(databaseUrl);
}

export function getSql() {
  if (!_sql) throw new Error("[db] initDb() not called");
  return _sql;
}

/**
 * Execute a SQL query with $1, $2 parameterized style.
 * Uses sql`...` tagged template for param-less queries,
 * sql.query(...) for parameterized queries.
 */
export async function query(text, params = []) {
  const sql = getSql();
  const result = await sql.query(text, params);
  return { rows: result, rowCount: result.length };
}

export async function tx(queries) {
  const sql = getSql();
  const taggedQueries = queries.map(([text, params]) => {
    return sql.query(text, params || []);
  });

  return await sql.transaction(taggedQueries);
}
