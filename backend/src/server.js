import http from "node:http";
import { createApp } from "./app.js";
import { createReadStream, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const UPLOADS_DIR = join(__dirname, "../uploads");

const app = createApp({ DATABASE_URL: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 3000);

if (!process.env.DATABASE_URL) {
  console.warn("[server] DATABASE_URL not set — set it in .env for local dev");
}

console.log(`[server] starting on http://localhost:${port}`);

const server = http.createServer(async (req, res) => {
  try {
    // Serve uploaded files directly
    if (req.url.startsWith("/uploads/")) {
      const filename = req.url.slice("/uploads/".length);
      const filepath = join(UPLOADS_DIR, filename);

      if (!existsSync(filepath)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      const ext = extname(filepath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      createReadStream(filepath).pipe(res);
      return;
    }

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