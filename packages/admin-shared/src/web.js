import { createAdminApi } from "./admin-api.js";

const DEMO_USER_ID = 1;

export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      "x-demo-user-id": DEMO_USER_ID
    },
    body: options.data ? JSON.stringify(options.data) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "请求失败");
  }

  return payload.data ?? payload;
}

export const adminApi = createAdminApi(request);
