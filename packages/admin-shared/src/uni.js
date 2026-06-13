import { createAdminApi } from "./admin-api.js";

const DEMO_USER_ID = 1;

function apiBase() {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://127.0.0.1:3000/api";
  }
  return "/api";
}

export function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${apiBase()}${path}`,
      method: options.method || "GET",
      data: options.data,
      header: {
        "content-type": "application/json",
        "x-demo-user-id": DEMO_USER_ID
      },
      success: (res) => {
        const payload = res.data || {};
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(payload.message || "请求失败"));
          return;
        }
        if (!payload || typeof payload !== "object") {
          reject(new Error("接口响应格式异常"));
          return;
        }
        resolve(payload.data ?? payload);
      },
      fail: () => reject(new Error("网络连接失败"))
    });
  });
}

export const adminApi = createAdminApi(request);
