import { TCMContainer, getContainer } from "@cloudflare/containers";

export class AppContainer extends TCMContainer {
  defaultPort = 3000;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check bypass
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "tcm-clinic-api" }),
        { headers: { "content-type": "application/json" } }
      );
    }

    // Get the named container instance
    const container = getContainer(env.TCM_API, "default");

    // Start container with secrets injected as env vars (only on first start)
    if (!container.running) {
      await container.start({
        envVars: {
          NODE_ENV: "production",
          PORT: "3000",
          DATABASE_URL: env.DATABASE_URL,
          JWT_SECRET: env.JWT_SECRET,
          CORS_ORIGIN: env.CORS_ORIGIN,
          APP_HOST: env.APP_HOST,
          WECHAT_APP_ID: env.WECHAT_APP_ID,
          WECHAT_APP_SECRET: env.WECHAT_APP_SECRET,
          ADMIN_LOGIN_PHONE: env.ADMIN_LOGIN_PHONE,
          ADMIN_LOGIN_PASSWORD: env.ADMIN_LOGIN_PASSWORD,
        }
      });
    }

    // Proxy request to the container
    return container.fetch(request);
  },
};
