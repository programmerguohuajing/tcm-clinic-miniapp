const fs = require("node:fs");
const path = require("node:path");
const { expect, test } = require("@playwright/test");

const rootDir = path.resolve(".");
const miniprogramDir = path.join(rootDir, "miniprogram");
const apiBaseUrl = "http://127.0.0.1:3000/api";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setByPath(target, rawPath, value) {
  const parts = rawPath.replace(/\[(\d+)\]/g, ".$1").split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (cursor[part] === undefined) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function event(dataset = {}, detail = {}) {
  return { currentTarget: { dataset }, detail };
}

async function waitFor(assertion, timeout = 5000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeout) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError;
}

function createWxHarness() {
  const storage = {};
  const calls = {
    navigateTo: [],
    switchTab: [],
    navigateBack: [],
    showToast: [],
    showModal: []
  };

  return {
    calls,
    wx: {
      getStorageSync: (key) => storage[key] || "",
      setStorageSync: (key, value) => {
        storage[key] = value;
      },
      removeStorageSync: (key) => {
        delete storage[key];
      },
      login: ({ success }) => success({ code: "playwright-demo-code" }),
      request: async ({ url, method = "GET", data, header = {}, success, fail }) => {
        try {
          const response = await fetch(url, {
            method,
            headers: {
              "content-type": "application/json",
              ...header
            },
            body: data ? JSON.stringify(data) : undefined
          });
          const payload = await response.json().catch(() => ({}));
          success({ statusCode: response.status, data: payload });
        } catch (error) {
          fail?.(error);
        }
      },
      showToast: (options) => calls.showToast.push(options),
      showModal: (options) => {
        calls.showModal.push(options);
        options.success?.({ confirm: true });
      },
      navigateTo: (options) => calls.navigateTo.push(options),
      switchTab: (options) => calls.switchTab.push(options),
      navigateBack: (options = {}) => calls.navigateBack.push(options)
    }
  };
}

function loadPage(pageName) {
  const harness = createWxHarness();
  const app = {
    globalData: {
      apiBaseUrl,
      demoUserId: 1,
      storeId: null
    }
  };
  let definition;

  global.wx = harness.wx;
  global.getApp = () => app;
  global.Page = (config) => {
    definition = config;
  };

  const pageFile = path.join(miniprogramDir, "pages", pageName, `${pageName}.js`);
  delete require.cache[require.resolve(pageFile)];
  require(pageFile);

  const instance = {
    ...definition,
    data: clone(definition.data || {}),
    setData(patch, callback) {
      for (const [key, value] of Object.entries(patch)) {
        setByPath(this.data, key, value);
      }
      callback?.();
    }
  };

  return { app, calls: harness.calls, page: instance };
}

test.describe("小程序核心功能冒烟", () => {
  test("页面资源完整，WXML 事件都能找到页面方法", () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(miniprogramDir, "app.json"), "utf8"));
    const problems = [];
    const eventRe = /\b(?:bind|catch)(?:tap|change|input|submit|confirm|blur|focus)\s*=\s*"([^"]+)"/g;

    for (const pagePath of appJson.pages) {
      for (const ext of ["js", "wxml", "wxss"]) {
        const file = path.join(miniprogramDir, `${pagePath}.${ext}`);
        if (!fs.existsSync(file)) problems.push(`缺少页面文件：${file}`);
      }

      const wxmlFile = path.join(miniprogramDir, `${pagePath}.wxml`);
      const jsFile = path.join(miniprogramDir, `${pagePath}.js`);
      const wxml = fs.readFileSync(wxmlFile, "utf8");
      const js = fs.readFileSync(jsFile, "utf8");
      const methods = new Set([...js.matchAll(/^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)].map((match) => match[1]));
      for (const match of wxml.matchAll(eventRe)) {
        if (!methods.has(match[1])) problems.push(`${pagePath}: ${match[1]} 未在 JS 中定义`);
      }
    }

    for (const item of appJson.tabBar.list) {
      for (const icon of [item.iconPath, item.selectedIconPath]) {
        const file = path.join(miniprogramDir, icon);
        if (!fs.existsSync(file)) problems.push(`缺少 tabBar 图标：${file}`);
      }
    }

    expect(problems).toEqual([]);
  });

  test("首页、预约、个人中心有数据且主要按钮可跳转", async () => {
    const home = loadPage("home");
    home.page.onLoad.call(home.page);
    await waitFor(() => expect(home.page.data.store?.name).toBeTruthy());
    expect(home.page.data.store?.name).toBeTruthy();
    expect(home.page.data.activities.length).toBeGreaterThan(0);
    expect(home.page.data.articles.length).toBeGreaterThan(0);
    home.page.goBooking.call(home.page);
    expect(home.calls.switchTab.at(-1).url).toBe("/pages/booking/booking");

    const booking = loadPage("booking");
    booking.page.onLoad.call(booking.page);
    await waitFor(() => expect(booking.page.data.slots.length).toBeGreaterThan(0));
    expect(booking.page.data.services.length).toBeGreaterThan(0);
    expect(booking.page.data.practitioners.length).toBeGreaterThan(0);
    expect(booking.page.data.slots.length).toBeGreaterThan(0);
    const availableSlot = booking.page.data.slots.find((slot) => slot.available);
    expect(availableSlot).toBeTruthy();
    booking.page.selectSlot.call(booking.page, event({ item: availableSlot }));
    await booking.page.submit.call(booking.page);
    expect(booking.calls.navigateTo.at(-1).url).toContain("/pages/appointment-confirm/appointment-confirm?orderNo=");

    const profile = loadPage("profile");
    profile.page.onShow.call(profile.page);
    await waitFor(() => expect(profile.page.data.summary.user.nickname).not.toBe("体验用户"));
    expect(profile.page.data.summary.user.nickname).toBeTruthy();
    expect(profile.page.data.appointments.length).toBeGreaterThan(0);
    expect(profile.page.data.familyMembers.length).toBeGreaterThan(0);
    profile.page.goAdmin.call(profile.page);
    profile.page.goTechnician.call(profile.page);
    expect(profile.calls.navigateTo.map((item) => item.url)).toEqual([
      "/pages/admin/admin",
      "/pages/technician/technician"
    ]);
  });

  test("健康档案保存、删除都有反馈", async () => {
    const { calls, page } = loadPage("health");
    page.onShow.call(page);
    await waitFor(() => expect(page.data.records.length).toBeGreaterThan(0));
    expect(page.data.records.length).toBeGreaterThan(0);

    await page.submit.call(page);
    expect(calls.showToast.at(-1).title).toBe("请填写体质结论");

    page.onInput.call(page, event({ field: "constitution" }, { value: "测试体质" }));
    page.onInput.call(page, event({ field: "symptomsText" }, { value: "乏力，怕冷" }));
    page.onInput.call(page, event({ field: "pulseNote" }, { value: "测试脉象" }));
    await page.submit.call(page);
    expect(calls.showToast.at(-1).title).toMatch(/已保存/);
    expect(page.data.form.constitution).toBe("");

    const target = page.data.records[0];
    page.deleteRecord.call(page, event({ id: target.id }));
    expect(calls.showModal.at(-1).title).toBe("删除档案");
  });

  test("内嵌管理端各模块能切换，弹窗与订单操作可用", async () => {
    const { calls, page } = loadPage("admin");
    page.onShow.call(page);
    await waitFor(() => expect(page.data.dashboard.cardList?.length).toBeGreaterThan(0));
    expect(page.data.dashboard.cardList.length).toBeGreaterThan(0);
    expect(page.data.loading).toBe(false);

    for (const item of page.data.navItems) {
      await page.switchModule.call(page, event({ key: item.key }));
      expect(page.data.activeKey).toBe(item.key);
      expect(page.data.loading).toBe(false);
      if (item.key !== "dashboard") expect(Array.isArray(page.data.displayRows)).toBe(true);
    }

    await page.switchModule.call(page, event({ key: "stores" }));
    page.openCreateEditor.call(page);
    expect(page.data.editor.visible).toBe(true);
    expect(page.data.editor.title).toBe("新增门店");
    page.closeEditor.call(page);
    expect(page.data.editor.visible).toBe(false);

    await page.switchModule.call(page, event({ key: "orders" }));
    const order = page.data.displayRows[0];
    expect(order?.id).toBeTruthy();
    await page.updateOrder.call(page, event({ id: order.id, status: "confirmed" }));
    expect(calls.showToast.at(-1).title).toBe("订单状态已更新");
  });

  test("技师端工作台、排班、提成页面可加载和跳转", async () => {
    const technician = loadPage("technician");
    technician.page.onShow.call(technician.page);
    await waitFor(() => expect(technician.page.data.summary.profile.name).not.toBe("技师"));
    expect(technician.page.data.summary.profile.name).toBeTruthy();
    expect(Array.isArray(technician.page.data.appointments)).toBe(true);
    technician.page.goSchedules.call(technician.page);
    technician.page.goCommissions.call(technician.page);
    expect(technician.calls.navigateTo.map((item) => item.url)).toEqual([
      "/pages/technician-schedules/technician-schedules",
      "/pages/technician-commissions/technician-commissions"
    ]);

    const schedules = loadPage("technician-schedules");
    schedules.page.onShow.call(schedules.page);
    await waitFor(() => expect(schedules.page.data.schedules.length).toBeGreaterThan(0));
    expect(schedules.page.data.schedules.length).toBeGreaterThan(0);
    await schedules.page.saveSchedule.call(schedules.page);
    expect(schedules.calls.showToast.at(-1).title).toBe("排班已保存");

    const commissions = loadPage("technician-commissions");
    commissions.page.onShow.call(commissions.page);
    await waitFor(() => expect(commissions.page.data.rows.length).toBeGreaterThan(0));
    expect(commissions.page.data.rows.length).toBeGreaterThan(0);
    expect(Number(commissions.page.data.summary.commissionAmount)).toBeGreaterThanOrEqual(0);
  });
});
