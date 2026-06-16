const TOKEN_KEY = "tcm_auth_token";

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || "";
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token);
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
          reject(response.data || { message: "登录失败" });
        }
      },
      fail: reject
    });
  });
}

async function ensureToken() {
  const cached = getToken();
  if (cached) return cached;

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
