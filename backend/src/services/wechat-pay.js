// ============================================================
// 微信支付 JSAPI（R4）客户端
// 纯函数签名 / 拉起参数构造（可离线单测）+ 真实「统一下单 / 退款」网络调用（凭证就位才发起，否则回退 mock）。
// 说明：JSAPI v2 统一下单是 XML + MD5 签名；回调/退款结果通知用 HMAC-SHA256 验签（verifyNotifySignature）。
// ============================================================
import crypto from "node:crypto";

// JSAPI v2 MD5 签名：参数按 key 升序拼接 &key=KEY 后 MD5 大写
export function signMd5(params, apiKey) {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== undefined && params[k] !== null)
    .sort();
  const raw = sorted.map((k) => `${k}=${params[k]}`).join("&") + `&key=${apiKey}`;
  return crypto.createHash("md5").update(raw, "utf8").digest("hex").toUpperCase();
}

function randomNonce() {
  return crypto.randomBytes(8).toString("hex");
}

// 从微信返回的 XML 中抽取某个标签文本（兼容 <tag>val</tag> 与 <tag><![CDATA[val]]></tag>）
export function xmlGetTag(xml, tag) {
  if (!xml) return null;
  const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([^<\\]]*)(\\]\\]>)?</${tag}>`));
  return m ? m[1] : null;
}

// 构造统一下单 XML（APIv2），trade_type=JSAPI，含 MD5 签名
export function buildUnifiedOrderXml({
  appId, mchId, apiKey, outTradeNo, description, amount, openid, notifyUrl, nonceStr,
}) {
  const params = {
    appid: appId,
    mch_id: mchId,
    nonce_str: nonceStr || randomNonce(),
    body: description,
    out_trade_no: outTradeNo,
    total_fee: Math.round(amount * 100), // 分
    spbill_create_ip: "127.0.0.1",
    notify_url: notifyUrl,
    trade_type: "JSAPI",
    openid,
  };
  const sign = signMd5(params, apiKey);
  const body = Object.entries(params)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join("");
  return `<xml>${body}<sign>${sign}</sign></xml>`;
}

// 统一下单请求体构造（纯函数，供真实调用拼 payload）
export function buildUnifiedOrderPayload({
  appId, mchId, outTradeNo, description, amount, openid, notifyUrl, nonceStr,
}) {
  return {
    appid: appId,
    mchid: mchId,
    description,
    out_trade_no: outTradeNo,
    notify_url: notifyUrl,
    amount: { total: Math.round(amount * 100), currency: "CNY" }, // 分
    payer: { openid },
    ...(nonceStr ? { nonce_str: nonceStr } : {}),
  };
}

// 前端 wx.requestPayment 拉起参数（JSAPI v2 二次签名）
// 输入 prepayId 来自统一下单返回的 prepay_id；timeStamp/nonceStr 可注入便于单测
export function buildJSApiPayParams({ appId, prepayId, apiKey, timeStamp, nonceStr }) {
  const ts = timeStamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = nonceStr ?? crypto.randomBytes(8).toString("hex");
  const pkg = `prepay_id=${prepayId}`;
  const paySign = signMd5(
    { appId, timeStamp: ts, nonceStr: nonce, package: pkg, signType: "MD5" },
    apiKey
  );
  return { appId, timeStamp: ts, nonceStr: nonce, package: pkg, signType: "MD5", paySign };
}

// 校验回调签名（APIv2 HMAC-SHA256 over 通知体，使用 apiKey）
export function verifyNotifySignature(payload, signature, apiKey) {
  const computed = crypto
    .createHmac("sha256", apiKey)
    .update(payload, "utf8")
    .digest("hex")
    .toUpperCase();
  return computed === String(signature).toUpperCase();
}

// ── 真实网络调用（1.5c）：仅在凭证就位时发起，否则回退 { mock:true } ──
// opts.fetch 可注入（测试/CF 运行时）；默认 globalThis.fetch（Node 18+ 全局可用）

// 微信支付统一下单（JSAPI v2）—— 返回前端拉起参数 payParams（含二次签名）
export async function unifiedOrder(params, opts = {}) {
  if (!params.appId || !params.mchId || !params.apiKey) return { mock: true };
  const fetchImpl = opts.fetch || globalThis.fetch;
  if (!fetchImpl) return { mock: true };

  const xml = buildUnifiedOrderXml(params);
  const res = await fetchImpl("https://api.mch.weixin.qq.com/pay/unifiedorder", {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: xml,
  });
  const text = await res.text();
  const returnCode = xmlGetTag(text, "return_code");
  const resultCode = xmlGetTag(text, "result_code");
  if (returnCode !== "SUCCESS" || resultCode !== "SUCCESS") {
    throw new Error(`unifiedorder 失败: ${xmlGetTag(text, "return_msg") || returnCode}`);
  }
  const prepayId = xmlGetTag(text, "prepay_id");
  if (!prepayId) throw new Error("unifiedorder 未返回 prepay_id");
  const payParams = buildJSApiPayParams({ appId: params.appId, prepayId, apiKey: params.apiKey });
  return { mock: false, prepayId, payParams };
}

// 微信支付退款（APIv2，需商户证书；生产环境应配置 p12/mchid 双向认证，此处给出请求构造骨架）
export async function refundOrder(params, opts = {}) {
  if (!params.appId || !params.mchId || !params.apiKey) return { mock: true };
  const fetchImpl = opts.fetch || globalThis.fetch;
  if (!fetchImpl) return { mock: true };

  const nonce = randomNonce();
  const req = {
    appid: params.appId,
    mch_id: params.mchId,
    nonce_str: nonce,
    out_trade_no: params.outTradeNo,
    out_refund_no: params.outRefundNo,
    total_fee: Math.round(params.total * 100),
    refund_fee: Math.round(params.refund * 100),
    refund_desc: params.reason || "",
  };
  const sign = signMd5(req, params.apiKey);
  const xml = `<xml>${Object.entries(req).map(([k, v]) => `<${k}>${v}</${k}>`).join("")}<sign>${sign}</sign></xml>`;
  const res = await fetchImpl("https://api.mch.weixin.qq.com/secapi/pay/refund", {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: xml,
    // 真实环境需携带商户证书：cert / key；CF Workers 不适合直连证书，建议经后端代理或微信支付 v3。
  });
  const text = await res.text();
  if (xmlGetTag(text, "return_code") !== "SUCCESS" || xmlGetTag(text, "result_code") !== "SUCCESS") {
    throw new Error(`refund 失败: ${xmlGetTag(text, "return_msg")}`);
  }
  return { mock: false, refundId: xmlGetTag(text, "refund_id") };
}
