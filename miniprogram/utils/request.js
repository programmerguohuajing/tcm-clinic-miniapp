const { clearToken, ensureToken } = require("./auth");
const { isDev } = require("./env");

const MAX_RETRIES = 1;

function request(path, options = {}) {
  const app = getApp();
  const { method = "GET", data } = options;
  const retryCount = options.__retryCount || 0;

  return ensureToken().then((token) => new Promise((resolve, reject) => {
    const header = {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    };
    if (isDev()) {
      header["x-demo-user-id"] = String(app.globalData.demoUserId);
    }

    wx.request({
      url: `${app.globalData.apiBaseUrl}${path}`,
      method,
      data,
      header,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data.data ?? response.data);
        } else if (response.statusCode === 401 && retryCount < MAX_RETRIES) {
          clearToken();
          request(path, { ...options, __retryCount: retryCount + 1 }).then(resolve).catch(reject);
        } else {
          const payload = response.data || {};
          const message = payload.error?.message || payload.message || "请求失败";
          console.error("[api] 请求失败", path, response.statusCode, payload);
          reject({ message, statusCode: response.statusCode });
        }
      },
      fail(error) {
        console.error("[api] 网络错误", path, error);
        reject({ message: error.errMsg || "网络错误", statusCode: 0 });
      }
    });
  }));
}

module.exports = {
  request
};
