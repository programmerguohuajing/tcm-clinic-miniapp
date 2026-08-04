import { createApp } from "../app.js";
import { getStaticFile } from "./static-files.js";

/**
 * Cloudflare Workers entry point.
 * Serves PC admin static files for non-API routes, and Hono app for /api/*.
 * Uploads are served from R2 bucket.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // R2 uploads - serve directly from bucket
    if (url.pathname.startsWith("/uploads/")) {
      if (!env.R2_BUCKET) {
        return new Response("Upload not configured", { status: 503 });
      }
      const key = url.pathname.slice("/uploads/".length);
      const object = await env.R2_BUCKET.get(key);
      if (!object) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // API routes go to Hono app
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      const app = createApp(env);
      return app.fetch(request, env);
    }

    // Serve static files for all other routes (SPA fallback to index.html)
    const file = getStaticFile(url.pathname);
    if (file) {
      return new Response(file.body, {
        headers: {
          "content-type": file.contentType,
          "cache-control": url.pathname === "/" || url.pathname === "/index.html"
            ? "no-cache"
            : "public, max-age=86400",
        },
      });
    }

    // Fallback: return index.html for SPA routes
    const index = getStaticFile("/index.html");
    if (index) {
      return new Response(index.body, {
        headers: {
          "content-type": "text/html",
          "cache-control": "no-cache",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
