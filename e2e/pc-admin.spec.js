import { expect, test } from "@playwright/test";
import { expectLoaded, watchPageErrors } from "./helpers.js";

const navLabels = [
  "经营看板",
  "多门店",
  "服务项目",
  "技师管理",
  "技师排班",
  "技师工作台",
  "预约订单",
  "提成结算",
  "首页配置",
  "内容营销",
  "会员权限",
  "评价管理",
  "操作日志"
];

test.describe("PC 管理端核心交互", () => {
  test("菜单和顶部标签点击后都能切换页面", async ({ page }) => {
    const errors = watchPageErrors(page);

    await page.goto("/pc-admin/");
    await expect(page.locator(".breadcrumb strong")).toHaveText("经营看板");
    await expectLoaded(page);

    for (const label of navLabels) {
      await page.locator(".sidebar .nav-item").filter({ hasText: label }).click();
      await expect(page.locator(".breadcrumb strong")).toHaveText(label);
      await expect(page.locator(".page-tab.active")).toContainText(label);
      await expectLoaded(page);
    }

    for (const label of navLabels.slice().reverse()) {
      await page.locator(".tabbar .page-tab").filter({ hasText: label }).first().click();
      await expect(page.locator(".breadcrumb strong")).toHaveText(label);
      await expectLoaded(page);
    }

    errors.expectNoErrors();
  });

  test("顶部页面标签可以关闭并自动切换到相邻页面", async ({ page }) => {
    const errors = watchPageErrors(page);

    await page.goto("/pc-admin/");
    await expect(page.locator(".breadcrumb strong")).toHaveText("经营看板");

    for (const label of ["服务项目", "技师管理", "技师排班"]) {
      await page.locator(".sidebar .nav-item").filter({ hasText: label }).click();
      await expect(page.locator(".breadcrumb strong")).toHaveText(label);
      await expect(page.locator(".tabbar .page-tab").filter({ hasText: label })).toBeVisible();
    }

    await expect(page.getByLabel("关闭 经营看板")).toHaveCount(0);

    await page.getByLabel("关闭 技师排班").click();
    await expect(page.locator(".tabbar .page-tab").filter({ hasText: "技师排班" })).toHaveCount(0);
    await expect(page.locator(".breadcrumb strong")).toHaveText("技师管理");

    await page.getByLabel("关闭 服务项目").click();
    await expect(page.locator(".tabbar .page-tab").filter({ hasText: "服务项目" })).toHaveCount(0);
    await expect(page.locator(".breadcrumb strong")).toHaveText("技师管理");

    await expectLoaded(page);
    errors.expectNoErrors();
  });

  test("门店筛选使用 Element Plus 组件并能展开", async ({ page }) => {
    const errors = watchPageErrors(page);

    await page.goto("/pc-admin/");
    await expect(page.locator(".toolbar select")).toHaveCount(0);
    await expect(page.locator(".toolbar .el-select")).toBeVisible();

    await page.locator(".toolbar .el-select").click();
    await expect(page.locator(".el-select-dropdown:visible")).toBeVisible();

    errors.expectNoErrors();
  });

  test("新增和编辑弹窗能打开、关闭且不被列表遮挡", async ({ page }) => {
    const errors = watchPageErrors(page);

    await page.goto("/pc-admin/stores");
    await expect(page.getByRole("heading", { name: "门店列表" })).toBeVisible();

    await page.getByRole("button", { name: "新增门店" }).click();
    const dialog = page.locator(".el-overlay .tcm-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("新增门店")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "保存" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "取消" })).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "编辑" }).first().click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("编辑门店")).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();

    errors.expectNoErrors();
  });

  test("预约订单确认和核销按钮点击后有可观察反馈", async ({ page }) => {
    const errors = watchPageErrors(page);

    await page.goto("/pc-admin/orders");
    await expect(page.getByRole("heading", { name: "预约订单", level: 2 })).toBeVisible();
    await expect(page.locator(".el-table__row").first()).toBeVisible();

    const firstConfirm = page.getByRole("button", { name: "确认" }).first();
    await firstConfirm.click();
    await expect(page.getByText("订单状态已更新")).toBeVisible();

    const firstComplete = page.getByRole("button", { name: "核销" }).first();
    await firstComplete.click();
    await expect(page.getByText("订单状态已更新")).toBeVisible();

    errors.expectNoErrors();
  });

  test("技师工作台展示摘要、排班和提成", async ({ page }) => {
    const errors = watchPageErrors(page);

    await page.goto("/pc-admin/technician-portal");
    await expect(page.locator(".breadcrumb strong")).toHaveText("技师工作台");
    await expect(page.getByText("TECHNICIAN PORTAL")).toBeVisible();
    await expect(page.getByRole("heading", { name: "近期预约", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的排班", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的提成", level: 2 })).toBeVisible();
    await expect(page.getByRole("button", { name: "新增排班" })).toBeVisible();

    errors.expectNoErrors();
  });
});
