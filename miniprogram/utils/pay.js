// 支付客户端封装（1.5b 虚拟支付 / 1.5c 微信支付 / R7 iOS IAP）
// 流程：后端 /payments/orders 下单 → 拿到 payParams → 调 wx 拉起支付 → 支付成功回调后端 /notify
const { request } = require("./request");
const { isDev } = require("./env");

// 发起支付：根据后端下发的 channel 选择拉起方式
// order: { outTradeNo, channel, payParams, needRealPay }
function launchPayment(order) {
  if (!order || !order.outTradeNo) return Promise.reject({ message: "订单无效" });
  // mock 联调模式：无真实 payParams，直接模拟成功
  if (!order.needRealPay || !order.payParams || order.payParams.mock) {
    if (isDev()) {
      return mockPaySuccess(order.outTradeNo);
    }
    return Promise.reject({ message: "当前为联调占位订单，未配置真实支付凭证" });
  }
  if (order.channel === "virtual_pay") {
    return requestVirtualPayment(order.payParams).then(() => notifyPaid(order.outTradeNo, "pay_success"));
  }
  return requestWechatPayment(order.payParams).then(() => notifyPaid(order.outTradeNo, "pay_success"));
}

// 虚拟支付拉起（1.5b）：payData 由后端下发，signature 由后端用 app_key 签发
function requestVirtualPayment(payData) {
  return new Promise((resolve, reject) => {
    wx.requestVirtualPayment({
      ...payData,
      success: () => resolve({ ok: true }),
      fail: (err) => reject({ message: err.errMsg || "虚拟支付失败", code: err.errCode }),
    });
  });
}

// 微信支付拉起（1.5c）：JSAPI 二次签名参数
function requestWechatPayment(payParams) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: String(payParams.timeStamp),
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType || "MD5",
      paySign: payParams.paySign,
      success: () => resolve({ ok: true }),
      fail: (err) => reject({ message: err.errMsg || "微信支付失败", code: err.errCode }),
    });
  });
}

// 支付成功回写后端（R5 状态机推进 + R6 发货兜底可由后端在 /notify 后处理）
function notifyPaid(outTradeNo, event = "pay_success") {
  return request(`/payments/orders/${outTradeNo}/notify`, {
    method: "POST",
    data: { event },
  }).catch((e) => {
    console.warn("[pay] notify 失败，建议查单兜底", e.message);
    return null;
  });
}

// 开发者模式模拟支付成功（不触真网）
function mockPaySuccess(outTradeNo) {
  return request(`/payments/orders/${outTradeNo}/notify`, { method: "POST", data: { event: "pay_success" } })
    .catch(() => null)
    .then(() => ({ ok: true, mock: true }));
}

// 下单：goodsRef { kind, name, id? }；返回 order（含 payParams / channel）
function createOrder({ tenantSlug, tenantId, storeId, goodsType, goodsRef, amount, preferChannel, platform }) {
  const body = {
    tenantId,
    goodsType,
    goodsRef,
    amount,
    preferChannel,
    platform: platform || "wechat",
  };
  if (storeId) body.storeId = storeId;
  return request("/payments/orders", { method: "POST", data: body });
}

module.exports = {
  launchPayment,
  requestVirtualPayment,
  requestWechatPayment,
  createOrder,
  notifyPaid,
  mockPaySuccess,
};
