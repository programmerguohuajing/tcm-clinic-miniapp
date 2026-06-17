export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (isProduction()) {
    throw Object.assign(new Error("生产环境缺少 JWT_SECRET"), { statusCode: 500 });
  }
  console.warn("[env] DEV: using fallback JWT secret — never use in production");
  return "dev-only-jwt-secret";
}

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
