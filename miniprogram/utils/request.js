function request(path, options = {}) {
  const app = getApp();
  const { method = "GET", data } = options;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${path}`,
      method,
      data,
      header: {
        "content-type": "application/json",
        "x-demo-user-id": app.globalData.demoUserId
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data.data ?? response.data);
        } else {
          console.error("[api] 请求失败", path, response.statusCode, response.data);
          reject({
            ...(response.data || { message: "请求失败" }),
            statusCode: response.statusCode
          });
        }
      },
      fail(error) {
        console.error("[api] 网络错误", path, error);
        reject(error);
      }
    });
  });
}

module.exports = {
  request
};
