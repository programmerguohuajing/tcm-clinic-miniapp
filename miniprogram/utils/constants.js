const STATUS_TEXT = {
  pending: "待确认",
  confirmed: "已确认",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款"
};

const PAYMENT_STATUS_TEXT = {
  unpaid: "待支付",
  paid: "已支付"
};

const MESSAGE_TYPE_TEXT = {
  appointment_confirmed: "预约确认",
  appointment_cancelled: "预约取消",
  payment_success: "支付成功",
  review_reply: "评价回复"
};

module.exports = {
  STATUS_TEXT,
  PAYMENT_STATUS_TEXT,
  MESSAGE_TYPE_TEXT
};
