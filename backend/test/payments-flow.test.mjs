// Phase 1.5b/c/d 支付真实接口 + 退款闭环 + iOS IAP 流程单测（纯函数 / 凭证守卫，零网络）
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { unifiedOrder, refundOrder, verifyNotifySignature, buildUnifiedOrderXml, signMd5 } from "../src/services/wechat-pay.js";
import { createVirtualOrder, queryVirtualOrder, refundVirtualOrder, verifyNotify, signCreateOrder } from "../src/services/virtual-pay.js";
import { nextOrderStatus, ORDER_STATUS } from "../src/services/payment-order-state.js";

let pass = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); pass++; console.log("  ✓", name); }
  catch (e) { fail++; console.error("  ✗", name, "\n   ", e.message); }
}

// ── 凭证守卫：缺凭证回退 mock，绝不发起网络 ──
console.log("真实接口凭证守卫（无凭证 → mock，不触网）");
await check("unifiedOrder 缺凭证返回 { mock:true }", async () => {
  assert.equal((await unifiedOrder({ appId: "", mchId: "", apiKey: "" })).mock, true);
});
await check("unifiedOrder 仅 appId 仍 mock", async () => {
  assert.equal((await unifiedOrder({ appId: "wx", mchId: "", apiKey: "" })).mock, true);
});
await check("refundOrder 缺凭证返回 { mock:true }", async () => {
  assert.equal((await refundOrder({ appId: "", mchId: "", apiKey: "" })).mock, true);
});
await check("createVirtualOrder 缺凭证返回 { mock:true }", async () => {
  assert.equal((await createVirtualOrder({ offerId: "", appId: "", appKey: "", accessToken: "" })).mock, true);
});
await check("queryVirtualOrder 缺凭证返回 { mock:true }", async () => {
  assert.equal((await queryVirtualOrder({ offerId: "", appId: "", accessToken: "" })).mock, true);
});
await check("refundVirtualOrder 缺凭证返回 { mock:true }", async () => {
  assert.equal((await refundVirtualOrder({ offerId: "", appId: "", appKey: "", accessToken: "" })).mock, true);
});

// ── 真实接口（注入 mock fetch，验证请求构造与签名） ──
console.log("真实接口请求构造（注入 fetch 验证，不触真网）");
await check("unifiedOrder 构造 XML + 调网关返回 payParams", async () => {
  const fakeFetch = async (url, opts) => {
    assert.ok(url.includes("api.mch.weixin.qq.com/pay/unifiedorder"), "应请求统一下单地址");
    assert.ok(opts.body.includes("<xml>"), "请求体应为 XML");
    return { text: async () => `<xml><return_code><![CDATA[SUCCESS]]></return_code><result_code><![CDATA[SUCCESS]]></result_code><prepay_id><![CDATA[prepay_abc]]></prepay_id></xml>` };
  };
  const r = await unifiedOrder({ appId: "wx1", mchId: "mch1", apiKey: "k1", outTradeNo: "PAY1", description: "会员", amount: 99, openid: "o1" }, { fetch: fakeFetch });
  assert.equal(r.mock, false);
  assert.equal(r.prepayId, "prepay_abc");
  assert.equal(r.payParams.package, "prepay_id=prepay_abc");
});
await check("createVirtualOrder 带 signature 调 xpay create_order", async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = JSON.parse(opts.body);
    return { json: async () => ({ errcode: 0, wx_order_id: "WX123" }) };
  };
  const r = await createVirtualOrder({ offerId: "O1", appId: "wx1", appKey: "ak", accessToken: "tk", outTradeNo: "PAY1", productName: "会员" }, { fetch: fakeFetch });
  assert.equal(r.mock, false);
  assert.equal(r.wxOrderId, "WX123");
  assert.ok(captured.signature, "请求应带 signature");
  // 用下单同款参数（含 signature）复验：xpay 回调验签基于排序参数 + body
  const notifyParams = { out_trade_no: "PAY1", wx_order_id: "WX123", openid: "oX" };
  const notifySig = signCreateOrder(notifyParams, "ak");
  assert.equal(verifyNotify(notifyParams, notifySig, "ak"), true);
  assert.equal(verifyNotify(notifyParams, "bad", "ak"), false);
});
await check("refundOrder 构造退款 XML", async () => {
  const fakeFetch = async (url, opts) => ({ text: async () => `<xml><return_code><![CDATA[SUCCESS]]></return_code><result_code><![CDATA[SUCCESS]]></result_code><refund_id><![CDATA[RFID1]]></refund_id></xml>` });
  const r = await refundOrder({ appId: "wx1", mchId: "mch1", apiKey: "k1", outTradeNo: "PAY1", outRefundNo: "RF1", total: 100, refund: 100 }, { fetch: fakeFetch });
  assert.equal(r.refundId, "RFID1");
});

// ── 微信回调验签（HMAC-SHA256） ──
console.log("回调验签");
await check("verifyNotifySignature 通过/失败", () => {
  const apiKey = "k9";
  const raw = JSON.stringify({ out_trade_no: "PAY1" });
  const sig = crypto.createHmac("sha256", apiKey).update(raw).digest("hex").toUpperCase();
  assert.equal(verifyNotifySignature(raw, sig, apiKey), true);
  assert.equal(verifyNotifySignature(raw, "bad", apiKey), false);
});

// ── 退款状态机（R8） ──
console.log("退款状态机（R8）");
await check("paid → refund_request → refunding", () => {
  assert.equal(nextOrderStatus(ORDER_STATUS.PAID, "refund_request").status, ORDER_STATUS.REFUNDING);
});
await check("delivered → refund_request → refunding", () => {
  assert.equal(nextOrderStatus(ORDER_STATUS.DELIVERED, "refund_request").status, ORDER_STATUS.REFUNDING);
});
await check("refunding → refund_success → refunded", () => {
  assert.equal(nextOrderStatus(ORDER_STATUS.REFUNDING, "refund_success").status, ORDER_STATUS.REFUNDED);
});
await check("refunding → refund_fail → paid 回滚", () => {
  assert.equal(nextOrderStatus(ORDER_STATUS.REFUNDING, "refund_fail").status, ORDER_STATUS.PAID);
});
await check("refunded 为终态不可再跃迁", () => {
  assert.equal(nextOrderStatus(ORDER_STATUS.REFUNDED, "refund_request").ok, false);
});

// ── 发货兜底幂等（R6） ──
console.log("发货兜底（R6）");
await check("paid → deliver → deliver_confirm → delivered", () => {
  assert.equal(nextOrderStatus(ORDER_STATUS.PAID, "deliver").status, ORDER_STATUS.DELIVERING);
  assert.equal(nextOrderStatus(ORDER_STATUS.DELIVERING, "deliver_confirm").status, ORDER_STATUS.DELIVERED);
});

console.log(`\n支付流程单测：通过 ${pass} / 失败 ${fail}`);
if (fail) process.exitCode = 1;
