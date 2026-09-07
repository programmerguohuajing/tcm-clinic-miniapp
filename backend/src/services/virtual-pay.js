// ============================================================
// 微信虚拟支付（个人主体，R3）客户端 —— 纯函数：拉起参数构造 + 回调验签
// 说明：真实下单需调用微信虚拟支付后台接口（依赖 OfferID / AppID / 现网 AppKey，且道具已在 MP 发布）。
//       本模块实现「可离线单测」的 payData 结构构造与 xp 回调验签（HMAC-SHA256 over 排序参数+body）。
//       真实网络调用在 credentials 就位后于 payments.js 接入。
// ============================================================
import crypto from "node:crypto";

// 构造 wx.requestVirtualPayment 的 payData（不含客户端无法算的 signature 字段，由服务端按 session_key 签发）
// 字段对齐微信虚拟支付文档：offerId / appId / buyQuantity / outTradeNo / productId / ...
export function buildVirtualPayData({
  offerId, appId, buyQuantity = 1, outTradeNo, productId, productName, currencyType = "CNY",
  goodsPrice, env, attach,
}) {
  return {
    offerId,
    appId,
    buyQuantity,
    outTradeNo,
    productId: productId ?? outTradeNo,
    productName: productName ?? "",
    currencyType,
    goodsPrice: goodsPrice ?? 0,
    env: env ?? 0, // 0 正式环境 / 1 沙箱
    attach: attach ?? "",
  };
}

// 虚拟支付回调签名（xpay）：对排序后的通知参数 + body 做 HMAC-SHA256（使用 MP 后台配置的 app_key）
function canonicalString(params, body = "") {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== undefined && params[k] !== null)
    .sort();
  const kv = keys.map((k) => `${k}=${params[k]}`).join("&");
  return kv + (body ? `&body=${body}` : "");
}

export function signNotify(params, appKey, body = "") {
  return crypto
    .createHmac("sha256", appKey)
    .update(canonicalString(params, body), "utf8")
    .digest("hex")
    .toUpperCase();
}

export function verifyNotify(params, signature, appKey, body = "") {
  return signNotify(params, appKey, body) === String(signature).toUpperCase();
}

// ── 真实网络调用（1.5b）：仅凭证就位时发起，否则回退 { mock:true } ──

// 下单请求签名（xpay create_order 用 app_key 对排序参数 HMAC-SHA256）
export function signCreateOrder(params, appKey) {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== undefined && params[k] !== null)
    .sort();
  const raw = keys.map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHmac("sha256", appKey).update(raw, "utf8").digest("hex").toUpperCase();
}

// 虚拟支付后台下单（xpay create_order）—— 返回微信侧 wx_order_id
export async function createVirtualOrder(params, opts = {}) {
  if (!params.offerId || !params.appId || !params.appKey || !params.accessToken) return { mock: true };
  const fetchImpl = opts.fetch || globalThis.fetch;
  if (!fetchImpl) return { mock: true };

  const body = {
    offer_id: params.offerId,
    appid: params.appId,
    out_trade_no: params.outTradeNo,
    productid: params.productId || params.outTradeNo,
    product_name: params.productName || "",
    buy_quantity: params.buyQuantity || 1,
    env: params.env ?? 0,
  };
  if (params.goodsPrice) body.goods_price = params.goodsPrice;
  const signature = signCreateOrder(body, params.appKey);
  const url = `https://api.weixin.qq.com/xpay/orders/create?offer_id=${encodeURIComponent(params.offerId)}&appid=${encodeURIComponent(params.appId)}&access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, signature }),
  });
  const data = await res.json();
  if (data.errcode) throw new Error(`xpay create_order 失败: ${data.errcode} ${data.errmsg}`);
  return { mock: false, wxOrderId: data.wx_order_id, raw: data };
}

// 查单兜底（xpay query_order）
export async function queryVirtualOrder(params, opts = {}) {
  if (!params.offerId || !params.appId || !params.accessToken) return { mock: true };
  const fetchImpl = opts.fetch || globalThis.fetch;
  if (!fetchImpl) return { mock: true };
  const url = `https://api.weixin.qq.com/xpay/orders/query?offer_id=${encodeURIComponent(params.offerId)}&appid=${encodeURIComponent(params.appId)}&access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ out_trade_no: params.outTradeNo }),
  });
  const data = await res.json();
  if (data.errcode) throw new Error(`xpay query_order 失败: ${data.errcode} ${data.errmsg}`);
  return { mock: false, status: data.order?.status, wxOrderId: data.order?.wx_order_id };
}

// 主动退款（Android，xpay refund_order）
export async function refundVirtualOrder(params, opts = {}) {
  if (!params.offerId || !params.appId || !params.appKey || !params.accessToken) return { mock: true };
  const fetchImpl = opts.fetch || globalThis.fetch;
  if (!fetchImpl) return { mock: true };
  const body = {
    offer_id: params.offerId,
    appid: params.appId,
    out_trade_no: params.outTradeNo,
    out_refund_no: params.outRefundNo,
    refund_reason: params.reason || "",
    env: params.env ?? 0,
  };
  const signature = signCreateOrder(body, params.appKey);
  const url = `https://api.weixin.qq.com/xpay/orders/refund?offer_id=${encodeURIComponent(params.offerId)}&appid=${encodeURIComponent(params.appId)}&access_token=${encodeURIComponent(params.accessToken)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, signature }),
  });
  const data = await res.json();
  if (data.errcode) throw new Error(`xpay refund_order 失败: ${data.errcode} ${data.errmsg}`);
  return { mock: false, refundId: data.refund_id };
}
