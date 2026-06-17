function isDev() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.envVersion !== "release";
  } catch (_e) {
    return true;
  }
}

const DEMO_USER_ID = 2;

module.exports = { isDev, DEMO_USER_ID };
