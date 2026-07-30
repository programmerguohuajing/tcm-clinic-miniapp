import { createApp } from "../app.js";

/**
 * Cloudflare Workers entry point.
 */
export default {
  async fetch(request, env, ctx) {
    const app = createApp(env);
    return app.fetch(request, env);
  }
};
