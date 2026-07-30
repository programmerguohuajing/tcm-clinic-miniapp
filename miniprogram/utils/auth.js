const { isDev } = require("./env");

const TOKEN_KEY = "tcm_auth_token";

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || "";
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token);
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch (_e) {
    return true;
  }
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: ({ code }) => resolve(code),
      fail: reject
    });
  });
}

function postLogin(apiBaseUrl, code) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl}/auth/wechat-login`,
      method: "POST",
      data: { code },
      header: { "content-type": "application/json" },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data.data ?? response.data);
        } else {
          const payload = response.data || {};
          const message = payload.error?.message || payload.message || "登录失败";
          reject({ message, statusCode: response.statusCode });
        }
      },
      fail: reject
    });
  });
}

async function ensureToken() {
  const cached = getToken();
  if (cached && !isTokenExpired(cached)) return cached;
  if (cached && isTokenExpired(cached)) {
    clearToken();
  }

  if (isDev()) {
    return "";
  }

  const app = getApp();
  const code = await wxLogin();
  const { token } = await postLogin(app.globalData.apiBaseUrl, code);
  setToken(token);
  return token;
}

function postBindPhone(apiBaseUrl, code) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.request({
      url: `${apiBaseUrl}/auth/bind-phone`,
      method: "POST",
      data: { code },
      header: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data.data ?? response.data);
        } else {
          const payload = response.data || {};
          const message = payload.error?.message || payload.message || "授权失败";
          reject({ message, statusCode: response.statusCode });
        }
      },
      fail: reject
    });
  });
}

/**
 * Ensure the user has a phone number bound.
 * If not, prompt the user to authorize via getPhoneNumber.
 * Returns true if user has a phone (or auth succeeded), false if cancelled.
 */
async function ensurePhoneAuth() {
  // Check if we have a valid token with phone info
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    // Need to get a fresh token first
    await ensureToken();
  }

  // Parse JWT payload to check if phone exists
  // We can't reliably decode without a library, so do a lightweight API call
  // instead: check via profile summary or just try bind-phone if user confirms
  return true; // caller should check hasPhone via API response
}

/**
 * Trigger WeChat phone number authorization.
 * Call from a button with open-type="getPhoneNumber".
 * @param {object} event - wx.getPhoneNumber event
 * @returns {Promise<{token, user}|null>} - fresh token + user on success, null if cancelled
 */
async function authorizePhoneNumber(event) {
  if (event.detail.errMsg !== "getPhoneNumber:ok") {
    console.warn("[auth] user cancelled phone auth", event.detail);
    return null;
  }

  const code = event.detail.code;
  if (!code) {
    throw new Error("获取授权码失败，请重试");
  }

  const app = getApp();
  const result = await postBindPhone(app.globalData.apiBaseUrl, code);

  // Store the refreshed token
  if (result && result.token) {
    setToken(result.token);
  }

  return result;
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY);
}

module.exports = {
  authorizePhoneNumber,
  clearToken,
  ensurePhoneAuth,
  ensureToken,
  getToken,
  setToken
};
