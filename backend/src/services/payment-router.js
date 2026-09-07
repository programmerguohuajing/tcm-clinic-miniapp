// ============================================================
// 支付通道路由（R2）—— 纯函数，零外部依赖，可单测
// 规则基线：微信官方《虚拟支付：个人》文档 + PRD 1.5
//   个人主体：仅 virtual 商品可走虚拟支付；real_service 拦截并引导升级主体
//   个体户/企业：任意商品走微信支付（也可选虚拟支付，但首期默认微信支付到店、虚拟支付线上）
// ============================================================

export const SUBJECT_TYPES = ["personal", "individual_business", "enterprise"];
export const GOODS_TYPES = ["virtual", "real_service"];
export const CHANNELS = ["virtual_pay", "wechat_pay"];

// 主体类型默认允许的收款能力（用于校验与提示）
const SUBJECT_CAPABILITY = {
  personal: { channels: ["virtual_pay"], goods: ["virtual"] },
  individual_business: { channels: ["wechat_pay", "virtual_pay"], goods: ["virtual", "real_service"] },
  enterprise: { channels: ["wechat_pay", "virtual_pay"], goods: ["virtual", "real_service"] },
};

/**
 * 按 (subject_type, goods_type) 选择支付通道。
 * @param {{subjectType:string, goodsType:string, preferChannel?:string}} input
 * @returns {{channel:string|null, blocked:boolean, reason?:string, upgradeHint?:string, allowVirtual?:boolean, allowWechat?:boolean}}
 */
export function selectPaymentChannel({ subjectType, goodsType, preferChannel }) {
  if (!SUBJECT_TYPES.includes(subjectType)) {
    return { channel: null, blocked: true, reason: `未知主体类型: ${subjectType}` };
  }
  if (!GOODS_TYPES.includes(goodsType)) {
    return { channel: null, blocked: true, reason: `未知商品类型: ${goodsType}` };
  }

  const cap = SUBJECT_CAPABILITY[subjectType];

  // 个人主体售卖到店服务 → 拦截 + 引导升级（PRD 非目标#2：不打擦边球）
  if (subjectType === "personal" && goodsType === "real_service") {
    return {
      channel: null,
      blocked: true,
      reason: "个人主体小程序不支持售卖到店服务（预约/团课），需升级为个体工商户或企业主体并开通微信支付",
      upgradeHint: "请前往微信公众平台升级主体类型，并在「微信支付」完成商户号绑定后，再到店服务类商品收款",
      allowVirtual: true,
      allowWechat: false,
    };
  }

  // 个人主体 + 虚拟商品 → 虚拟支付（唯一合规通道）
  if (subjectType === "personal" && goodsType === "virtual") {
    return { channel: "virtual_pay", blocked: false, allowVirtual: true, allowWechat: false };
  }

  // 个体户/企业：默认微信支付；若商户显式偏好虚拟支付且商品为虚拟，则允许虚拟支付
  if (preferChannel === "virtual_pay" && goodsType === "virtual") {
    return { channel: "virtual_pay", blocked: false, allowVirtual: true, allowWechat: true };
  }

  // 其余（到店服务，或任何默认场景）→ 微信支付
  return { channel: "wechat_pay", blocked: false, allowVirtual: cap.channels.includes("virtual_pay"), allowWechat: true };
}

/**
 * 主体是否允许配置某通道（管理端开关校验用）
 */
export function subjectAllowsChannel(subjectType, channel) {
  const cap = SUBJECT_CAPABILITY[subjectType];
  return !!cap && cap.channels.includes(channel);
}

// 生成我方订单号（8-32 位，全局唯一）。允许注入 rng/time 便于单测。
export function buildOutTradeNo({ prefix = "PAY", time, rng } = {}) {
  const t = time ?? Date.now();
  const r = rng ? rng() : Math.random().toString(36).slice(2, 10);
  const stamp = String(t).slice(-10);
  const no = `${prefix}${stamp}${r}`;
  return no.length > 32 ? no.slice(0, 32) : no;
}
