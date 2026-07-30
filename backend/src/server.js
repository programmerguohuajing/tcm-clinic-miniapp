import http from "node:http";
import { createApp } from "./app.js";

const app = createApp({ DATABASE_URL: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 3000);

if (!process.env.DATABASE_URL) {
  console.warn("[server] DATABASE_URL not set — set it in .env for local dev");
}

console.log(`[server] starting on http://localhost:${port}`);

const server = http.createServer(async (req, res) => {
  try {
    const response = await app.fetch(req, { DATABASE_URL: process.env.DATABASE_URL });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const body = await response.text();
    res.end(body);
  } catch (err) {
    console.error("[server] unhandled error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "服务器内部错误" } }));
    }
  }
});

server.listen(port, () => {
  console.log(`[server] TCM clinic API listening on http://localhost:${port}`);
});
