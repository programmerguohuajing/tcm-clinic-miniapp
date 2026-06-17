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

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY);
}

module.exports = {
  clearToken,
  ensureToken,
  getToken
};
