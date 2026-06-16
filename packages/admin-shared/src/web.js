import { createAdminApi } from "./admin-api.js";

const DEMO_USER_ID = 1;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const TOKEN_KEY = "tcm_auth_token";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAdmin(path, options) {
  const token = !import.meta.env.DEV && typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : "";
  return fetch(`/api${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(import.meta.env.DEV ? { "x-demo-user-id": DEMO_USER_ID } : {})
    },
    body: options.data ? JSON.stringify(options.data) : undefined
  });
}

export async function request(path, options = {}) {
  const method = options.method || "GET";
  let response = await fetchAdmin(path, { ...options, method });

  if (method === "GET" && RETRYABLE_STATUS.has(response.status)) {
    await delay(120);
    response = await fetchAdmin(path, { ...options, method });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "请求失败");
  }

  return payload.data ?? payload;
}

export const adminApi = createAdminApi(request);
