const { isDev } = require("./utils/env");

App({
  onLaunch() {
    if (!isDev()) {
      this.globalData.apiBaseUrl = this.globalData.prodApiBaseUrl;
    }
  },
  globalData: {
    apiBaseUrl: "http://127.0.0.1:3000/api",
    prodApiBaseUrl: "https://api.example.com/api",
    demoUserId: 2,
    storeId: null
  }
});
