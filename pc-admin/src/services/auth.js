const TOKEN_KEY = "tcm_auth_token";
const USER_KEY = "tcm_auth_user";

const API_BASE = __API_URL__ || "";

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function setSession({ token, user }) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getCurrentUser() {
  try {
    return JSON.parse(window.localStorage.getItem(USER_KEY) || "{}");
  } catch (_error) {
    return {};
  }
}

export async function loginAdmin(credentials) {
  const response = await fetch(`${API_BASE}/api/auth/admin-login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(credentials)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || "登录失败");
  }

  setSession(payload.data ?? payload);
}
