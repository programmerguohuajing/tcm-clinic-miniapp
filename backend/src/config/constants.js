export const VALID_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: ["completed"],
  cancelled: ["refunded"],
  refunded: []
};
