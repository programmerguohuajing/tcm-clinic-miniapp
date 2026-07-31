import { createApp } from "../app.js";
import { getStaticFile } from "./static-files.js";

/**
 * Cloudflare Workers entry point.
 * Serves PC admin static files for non-API routes, and Hono app for /api/*.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API routes go to Hono app
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      try {
        const app = createApp(env);
        return await app.fetch(request, env);
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "WORKER_INIT_FAILED",
            message: String(err?.message || err),
            stack: String(err?.stack || "").slice(0, 2000)
          }),
          { status: 500, headers: { "content-type": "application/json" } }
        );
      }
    }

    // Serve static files for all other routes (SPA fallback to index.html)
    const file = getStaticFile(url.pathname);
    if (file) {
      return new Response(file.body, {
        headers: {
          "content-type": file.contentType,
          "cache-control": "public, max-age=86400",
        },
      });
    }

    // Fallback: return index.html for SPA routes
    const index = getStaticFile("/index.html");
    if (index) {
      return new Response(index.body, {
        headers: {
          "content-type": "text/html",
          "cache-control": "public, max-age=86400",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
