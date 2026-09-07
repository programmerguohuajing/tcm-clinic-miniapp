// Phase 1.5b/c 支付网关地基单测（纯函数，零网络依赖）
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { signMd5, buildJSApiPayParams, verifyNotifySignature } from "../src/services/wechat-pay.js";
import { buildVirtualPayData, signNotify, verifyNotify } from "../src/services/virtual-pay.js";

let pass = 0;
function check(name, fn) {
  try { fn(); pass++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; }
}

console.log("微信支付 JSAPI v2 签名");
check("signMd5 确定性 + 大小写", () => {
  const key = "k9K3pQ7xW2mZ1aB8";
  const a = signMd5({ appId: "wx123", nonceStr: "abc", package: "prepay_id=px", signType: "MD5", timeStamp: "1700000000" }, key);
  const b = signMd5({ timeStamp: "1700000000", signType: "MD5", package: "prepay_id=px", nonceStr: "abc", appId: "wx123" }, key);
  assert.equal(a, b); // 排序无关
  assert.equal(a, a.toUpperCase());
  assert.match(a, /^[0-9A-F]{32}$/); // MD5 十六进制
});
check("buildJSApiPayParams 字段完整且可注入复现", () => {
  const p = buildJSApiPayParams({ appId: "wx123", prepayId: "prepay_xyz", apiKey: "k9K3pQ7xW2mZ1aB8", timeStamp: "1700000000", nonceStr: "nonce1" });
  assert.equal(p.appId, "wx123");
  assert.equal(p.package, "prepay_id=prepay_xyz");
  assert.equal(p.signType, "MD5");
  assert.equal(p.timeStamp, "1700000000");
  assert.equal(p.nonceStr, "nonce1");
  assert.match(p.paySign, /^[0-9A-F]{32}$/);
});
check("verifyNotifySignature 验签通过/失败", () => {
  const key = "apiKey456";
  const body = JSON.stringify({ out_trade_no: "PAY1", transaction_id: "T1" });
  const sig = crypto.createHmac("sha256", key).update(body, "utf8").digest("hex").toUpperCase();
  assert.equal(verifyNotifySignature(body, sig, key), true);
  assert.equal(verifyNotifySignature(body, "deadbeef", key), false);
});

console.log("虚拟支付 payData + 回调验签");
check("buildVirtualPayData 结构对齐文档", () => {
  const d = buildVirtualPayData({ offerId: "O1", appId: "wx2", outTradeNo: "PAY2", productName: "月度会员", buyQuantity: 1, goodsPrice: 9900 });
  assert.equal(d.offerId, "O1");
  assert.equal(d.appId, "wx2");
  assert.equal(d.outTradeNo, "PAY2");
  assert.equal(d.productId, "PAY2");
  assert.equal(d.buyQuantity, 1);
  assert.equal(d.currencyType, "CNY");
});
check("signNotify/verifyNotify 验签一致", () => {
  const appKey = "vpAppKey789";
  const params = { out_trade_no: "PAY2", wx_order_id: "W1", openid: "oX" };
  const sig = signNotify(params, appKey);
  assert.equal(verifyNotify(params, sig, appKey), true);
  assert.equal(verifyNotify(params, "bad", appKey), false);
  // 排序无关
  const sig2 = signNotify({ openid: "oX", wx_order_id: "W1", out_trade_no: "PAY2" }, appKey);
  assert.equal(sig2, sig);
});

console.log(`\n支付网关单测：通过 ${pass} 项`);
if (process.exitCode) console.log("存在失败项");
