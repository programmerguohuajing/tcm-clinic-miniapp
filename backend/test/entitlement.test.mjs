// Phase 3 套餐能力门控（R13）单测（纯函数）
import assert from "node:assert/strict";
import {
  resolveEntitlements, isMenuAllowed, hasCapability, filterNavByPlan, DEFAULT_PLANS,
} from "../src/services/entitlement.js";

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log("  ✓", name); }
  catch (e) { fail++; console.error("  ✗", name, "\n   ", e.message); }
}

console.log("套餐能力解析");
check("基础版菜单/能力集合正确", () => {
  const e = resolveEntitlements("basic");
  assert.equal(e.menus.has("dashboard"), true);
  assert.equal(e.menus.has("marketing"), false);
  assert.equal(e.capabilities.has("single_store"), true);
  assert.equal(e.capabilities.has("multi_store"), false);
});
check("专业版开放支付能力", () => {
  assert.equal(hasCapability("pro", "pay"), true);
  assert.equal(hasCapability("basic", "pay"), false);
});
check("旗舰版额外开放技师工作台", () => {
  assert.equal(isMenuAllowed("flagship", "technicianPortal"), true);
  assert.equal(isMenuAllowed("basic", "technicianPortal"), false);
});
check("未知套餐回退基础版", () => {
  assert.equal(resolveEntitlements("nope").planKey, "basic");
});
check("按套餐过滤导航（基础版看不到营销/内容）", () => {
  const nav = [
    { key: "dashboard", path: "/", label: "看板" },
    { key: "marketing", path: "/m", label: "营销" },
    { key: "content", path: "/c", label: "内容" },
    { key: "pageConfig", path: "/pc", label: "页面配置" },
  ];
  const basicNav = filterNavByPlan(nav, "basic");
  const keys = basicNav.map((n) => n.key);
  assert.ok(!keys.includes("marketing"), "基础版应隐藏营销");
  assert.ok(keys.includes("pageConfig"), "基础版保留页面配置");
  assert.equal(basicNav.length, 2);
});
check("自定义套餐定义可被解析", () => {
  const defs = { trial: { key: "trial", name: "试用", menus: ["dashboard"], capabilities: [] } };
  const e = resolveEntitlements("trial", defs);
  assert.equal(e.menus.has("dashboard"), true);
  assert.equal(e.menus.has("stores"), false);
});

console.log(`\n套餐门控单测：通过 ${pass} / 失败 ${fail}`);
if (fail) process.exitCode = 1;
