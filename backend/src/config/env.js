export const JWT_SECRET = (env) => {
  const secret = env.JWT_SECRET;
  if (secret) return secret;
  throw new Error("生产环境缺少 JWT_SECRET — 请运行: wrangler secret put JWT_SECRET");
};

export const WECHAT_APP_ID = (env) => env.WECHAT_APP_ID || "";
export const WECHAT_APP_SECRET = (env) => env.WECHAT_APP_SECRET || "";
export const ADMIN_LOGIN_PHONE = (env) => env.ADMIN_LOGIN_PHONE || "";
export const ADMIN_LOGIN_PASSWORD = (env) => env.ADMIN_LOGIN_PASSWORD || "";
export const JWT_EXPIRES_IN = (env) => env.JWT_EXPIRES_IN || "7d";

export const isProduction = () => true;

export const DEMO_USER = Object.freeze({
  id: 1,
  nickname: "体验用户",
  phone: "13800000000",
  points: 0,
  member_level: "青竹会员",
  admin_role: "member",
  can_manage: false,
  can_technician: false,
  technician_id: null
});

export function maskPhone(phone) {
  if (!phone || String(phone).length < 7) return phone || "";
  const s = String(phone);
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

export function corsAllowlist(env) {
  const raw = env.CORS_ORIGIN;
  if (!raw || raw === "*") return ["*"];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
