// Phase 1.5a 支付路由 + 订单状态机单测（零 DB 依赖）
import assert from "node:assert/strict";
import { selectPaymentChannel, subjectAllowsChannel, buildOutTradeNo, CHANNELS } from "../src/services/payment-router.js";
import { nextOrderStatus, ORDER_STATUS, isTerminal } from "../src/services/payment-order-state.js";

let pass = 0;
function check(name, fn) {
  try { fn(); pass++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; }
}

console.log("R2 支付路由规则");
check("个人 + 虚拟商品 → 虚拟支付", () => {
  const d = selectPaymentChannel({ subjectType: "personal", goodsType: "virtual" });
  assert.equal(d.channel, "virtual_pay");
  assert.equal(d.blocked, false);
});
check("个人 + 到店服务 → 拦截并引导升级主体", () => {
  const d = selectPaymentChannel({ subjectType: "personal", goodsType: "real_service" });
  assert.equal(d.blocked, true);
  assert.equal(d.channel, null);
  assert.match(d.reason, /个体工商户|企业/);
  assert.ok(d.upgradeHint);
});
check("个体户 + 任意商品 → 微信支付（默认）", () => {
  const d = selectPaymentChannel({ subjectType: "individual_business", goodsType: "real_service" });
  assert.equal(d.channel, "wechat_pay");
  assert.equal(d.blocked, false);
  const d2 = selectPaymentChannel({ subjectType: "individual_business", goodsType: "virtual" });
  assert.equal(d2.channel, "wechat_pay");
});
check("企业 + 到店服务 → 微信支付", () => {
  const d = selectPaymentChannel({ subjectType: "enterprise", goodsType: "real_service" });
  assert.equal(d.channel, "wechat_pay");
});
check("个体户偏好虚拟支付 + 虚拟商品 → 允许虚拟支付", () => {
  const d = selectPaymentChannel({ subjectType: "individual_business", goodsType: "virtual", preferChannel: "virtual_pay" });
  assert.equal(d.channel, "virtual_pay");
});
check("未知主体类型 → 拦截", () => {
  const d = selectPaymentChannel({ subjectType: "unknown", goodsType: "virtual" });
  assert.equal(d.blocked, true);
});
check("个人主体不允许微信支付通道", () => {
  assert.equal(subjectAllowsChannel("personal", "wechat_pay"), false);
  assert.equal(subjectAllowsChannel("personal", "virtual_pay"), true);
  assert.equal(subjectAllowsChannel("individual_business", "wechat_pay"), true);
});

console.log("R1 订单号生成（8-32 位、可注入）");
check("默认生成长度合法且唯一", () => {
  const a = buildOutTradeNo();
  const b = buildOutTradeNo();
  assert.ok(a.length >= 8 && a.length <= 32);
  assert.notEqual(a, b);
});
check("注入 rng/time 可复现", () => {
  const a = buildOutTradeNo({ prefix: "PAY", time: 1700000000000, rng: () => "abc12345" });
  const b = buildOutTradeNo({ prefix: "PAY", time: 1700000000000, rng: () => "abc12345" });
  assert.equal(a, b);
  assert.ok(a.startsWith("PAY"));
});

console.log("R5 订单状态机");
check("待支付 → 已支付（pay_success）", () => {
  assert.deepEqual(nextOrderStatus(ORDER_STATUS.PENDING_PAYMENT, "pay_success"), { ok: true, status: "paid" });
});
check("已支付 → 发货中 → 已发货", () => {
  assert.deepEqual(nextOrderStatus("paid", "deliver"), { ok: true, status: "delivering" });
  assert.deepEqual(nextOrderStatus("delivering", "deliver_confirm"), { ok: true, status: "delivered" });
});
check("已支付 → 退款中 → 已退款", () => {
  assert.deepEqual(nextOrderStatus("paid", "refund_request"), { ok: true, status: "refunding" });
  assert.deepEqual(nextOrderStatus("refunding", "refund_success"), { ok: true, status: "refunded" });
});
check("退款失败回滚到已支付", () => {
  assert.deepEqual(nextOrderStatus("refunding", "refund_fail"), { ok: true, status: "paid" });
});
check("非法跃迁被拒绝（待支付不能直接退款）", () => {
  const r = nextOrderStatus(ORDER_STATUS.PENDING_PAYMENT, "refund_request");
  assert.equal(r.ok, false);
});
check("终态不再变化", () => {
  assert.equal(isTerminal("refunded"), true);
  assert.equal(isTerminal("closed"), true);
  assert.equal(isTerminal("paid"), false);
});

console.log(`\n支付单测：通过 ${pass} 项`);
if (process.exitCode) console.log("存在失败项");
