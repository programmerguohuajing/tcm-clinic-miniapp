const { getToken, setToken } = require("../../utils/auth");

Page({
  data: {
    loading: false,
    error: "",
    loginCode: ""
  },

  onLoad() {
    if (getToken()) {
      wx.switchTab({ url: "/pages/home/home" });
      return;
    }

    // Silently get WeChat login code for the wechat-login endpoint
    wx.login({
      success: ({ code }) => {
        this.setData({ loginCode: code || "" });
      },
      fail: () => {
        this.setData({ loginCode: "" });
      }
    });
  },

  onGetPhoneNumber(event) {
    if (event.detail.errMsg !== "getPhoneNumber:ok") {
      wx.showToast({ title: "需要授权手机号才能继续", icon: "none" });
      return;
    }

    const phoneCode = event.detail.code;
    if (!phoneCode) {
      wx.showToast({ title: "获取授权码失败，请重试", icon: "none" });
      return;
    }

    const loginCode = this.data.loginCode;
    if (!loginCode) {
      wx.showToast({ title: "登录环境初始化失败，请重试", icon: "none" });
      return;
    }

    this.setData({ loading: true, error: "" });

    this.doAuth(loginCode, phoneCode);
  },

  async doAuth(loginCode, phoneCode) {
    try {
      // Step 1: Silent WeChat login → get JWT
      const loginResult = await this.callApi("/auth/wechat-login", {
        method: "POST",
        data: { code: loginCode }
      });

      if (loginResult && loginResult.token) {
        setToken(loginResult.token);
      }

      // Step 2: Bind phone number via getPhoneNumber code
      const bindResult = await this.callApi("/auth/bind-phone", {
        method: "POST",
        data: { code: phoneCode }
      });

      if (bindResult && bindResult.token) {
        setToken(bindResult.token);
      }

      wx.showToast({ title: "登录成功", icon: "success" });

      setTimeout(() => {
        wx.switchTab({ url: "/pages/home/home" });
      }, 800);
    } catch (err) {
      console.error("[login] auth failed:", err);
      this.setData({ error: err.message || "授权失败，请重试" });
    } finally {
      this.setData({ loading: false });
    }
  },

  callApi(path, options = {}) {
    const app = getApp();
    const token = getToken();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}${path}`,
        method: options.method || "GET",
        data: options.data,
        header: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        success(response) {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(response.data.data ?? response.data);
          } else {
            const payload = response.data || {};
            const message = payload.error?.message || payload.message || "请求失败";
            reject({ message, statusCode: response.statusCode });
          }
        },
        fail(error) {
          reject({ message: error.errMsg || "网络错误", statusCode: 0 });
        }
      });
    });
  }
});
