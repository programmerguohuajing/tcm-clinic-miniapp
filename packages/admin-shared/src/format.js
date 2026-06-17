import { offStatuses, statusMap } from "./constants.js";

export const money = (value) => `¥${Number(value || 0).toFixed(2)}`;
export const dateText = (value) => (value ? String(value).slice(0, 10) : "");
export const timeText = (value) => (value ? String(value).slice(0, 5) : "");
export const statusLabel = (value) => statusMap[String(value)] || value || "-";
export const isOffStatus = (value) => offStatuses.includes(value);
export const jsonText = (value) => JSON.stringify(value || {}, null, 2);

export function splitKeywords(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const percentText = (value) => `${Math.round(Number(value || 0) * 100)}%`;

export function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone || "";
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

export function today(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}
