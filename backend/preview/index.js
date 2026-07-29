import { TCMContainer, getContainer } from "@cloudflare/containers";

export class AppContainer extends TCMContainer {
  defaultPort = 3000;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check — bypass container, respond directly
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "tcm-clinic-api" }), {
        headers: { "content-type": "application/json" }
      });
    }

    // Proxy all other requests to the container
    const container = getContainer(env.TCM_API, "default");
    return container.fetch(request);
  },
};
