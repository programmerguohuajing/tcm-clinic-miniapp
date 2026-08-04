import { Hono } from "hono";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, "../../uploads");

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export const uploadRouter = () => {
  const app = new Hono();

  app.post("/upload/image", requireAdmin(), asyncHandler(async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || !(file instanceof File)) {
      return c.json({ error: { code: "BAD_REQUEST", message: "请选择要上传的图片文件" } }, 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ error: { code: "BAD_REQUEST", message: "仅支持 JPG、PNG、GIF、WebP 格式" } }, 400);
    }

    if (file.size > MAX_SIZE) {
      return c.json({ error: { code: "BAD_REQUEST", message: "图片大小不能超过 5MB" } }, 400);
    }

    const ext = extname(file.name) || "." + file.type.split("/")[1];
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    const buffer = await file.arrayBuffer();
    writeFileSync(filepath, Buffer.from(buffer));

    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/${filename}`;
    return c.json({ data: { url, filename } }, 201);
  }));

  return app;
};
