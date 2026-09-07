// ============================================================
// 支付订单状态机（R5）—— 纯函数，零外部依赖，可单测
// 两通道（虚拟支付 / 微信支付）共用一套状态语义，以通道侧单号为准。
//   待支付 → 已支付 → 发货中 → 已发货（虚拟商品权益发放完成 / 到店服务已核销）
//   退款中、已退款；超时关单、支付失败
// ============================================================

export const ORDER_STATUS = {
  PENDING_PAYMENT: "pending_payment", // 待支付（已下单，未回调）
  PAID: "paid", // 已支付（通道已确认收讫）
  DELIVERING: "delivering", // 发货中（虚拟商品权益发放/到店服务确认中）
  DELIVERED: "delivered", // 已发货/已完成
  REFUNDING: "refunding", // 退款中
  REFUNDED: "refunded", // 已退款
  CLOSED: "closed", // 已关单（超时未付/主动取消）
  FAILED: "failed", // 支付失败
};

// 事件 → 允许的目标状态（白名单式，抑制非法跃迁）
const TRANSITIONS = {
  pending_payment: {
    pay_success: "paid",
    close: "closed",
    expire: "closed",
    fail: "failed",
  },
  paid: {
    deliver: "delivering",
    refund_request: "refunding",
    close: "closed", // 异常关单（极少）
  },
  delivering: {
    deliver_confirm: "delivered",
    refund_request: "refunding",
  },
  delivered: {
    refund_request: "refunding",
  },
  refunding: {
    refund_success: "refunded",
    refund_fail: "paid", // 退款失败回滚到已支付
  },
  refunded: {},
  closed: {},
  failed: {
    retry: "pending_payment", // 允许重新发起支付
  },
};

/**
 * 计算下一状态。
 * @param {string} current 当前状态
 * @param {string} event 事件名（pay_success/deliver/deliver_confirm/refund_request/refund_success/refund_fail/close/expire/fail/retry）
 * @returns {{ok:boolean, status?:string, error?:string}}
 */
export function nextOrderStatus(current, event) {
  if (!Object.values(ORDER_STATUS).includes(current)) {
    return { ok: false, error: `非法状态: ${current}` };
  }
  const allowed = TRANSITIONS[current];
  const next = allowed?.[event];
  if (!next) {
    return { ok: false, error: `状态 ${current} 不允许事件 ${event}` };
  }
  return { ok: true, status: next };
}

// 终态集合（不再发生变化）
export const TERMINAL_STATUSES = new Set(["refunded", "closed", "failed"]);

export function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}
