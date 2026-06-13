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
