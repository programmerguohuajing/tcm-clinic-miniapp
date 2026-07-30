import { createAdminApi } from "./admin-api.js";

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const MAX_RETRIES = 2;
const TOKEN_KEY = "tcm_auth_token";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAdmin(path, options) {
  const isDev = import.meta.env.DEV;
  const token = !isDev && typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : "";
  return fetch(`${__API_URL__}/api${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(isDev ? { "x-demo-user-id": "2" } : {})
    },
    body: options.data ? JSON.stringify(options.data) : undefined
  });
}

export async function request(path, options = {}) {
  const method = options.method || "GET";
  let lastResponse = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    lastResponse = await fetchAdmin(path, { ...options, method });

    if (method === "GET" && RETRYABLE_STATUS.has(lastResponse.status) && attempt < MAX_RETRIES) {
      await delay(120 * (attempt + 1));
      continue;
    }
    break;
  }

  const payload = await lastResponse.json().catch(() => ({}));
  if (!lastResponse.ok) {
    const message = payload.error?.message || payload.message || "请求失败";
    throw new Error(message);
  }

  return payload.data ?? payload;
}

export const adminApi = createAdminApi(request);
