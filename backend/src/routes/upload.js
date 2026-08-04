import { Hono } from "hono";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAdmin } from "../middleware/auth.js";
import crypto from "node:crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const uploadRouter = () => {
  const app = new Hono();

  app.post("/upload/image", requireAdmin(), asyncHandler(async (c) => {
    const env = c.env;
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

    const ext = file.name.split(".").pop() || file.type.split("/")[1];
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    // Use R2 if available, otherwise fall back to local file system
    if (env.R2_BUCKET) {
      await env.R2_BUCKET.put(filename, arrayBuffer, {
        httpMetadata: { contentType: file.type },
        customMetadata: { originalName: file.name },
      });
      const baseUrl = env.APP_URL || new URL(c.req.url).origin;
      const url = `${baseUrl}/uploads/${filename}`;
      return c.json({ data: { url, filename } }, 201);
    }

    // Local fallback (development)
    const { writeFileSync, mkdirSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const UPLOAD_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../uploads");
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
    writeFileSync(join(UPLOAD_DIR, filename), Buffer.from(arrayBuffer));
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/${filename}`;
    return c.json({ data: { url, filename } }, 201);
  }));

  return app;
};
