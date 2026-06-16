import { expect } from "@playwright/test";

export function watchPageErrors(page) {
  const errors = [];

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  page.on("console", (message) => {
    const text = message.text();
    if (message.type() !== "error") return;
    if (text.includes("favicon.ico")) return;
    errors.push(text);
  });

  return {
    expectNoErrors() {
      expect(errors, errors.join("\n")).toEqual([]);
    }
  };
}

export async function expectLoaded(page) {
  await expect(page.getByText("正在调取经营脉络...")).toHaveCount(0);
  await expect(page.getByText("加载失败")).toHaveCount(0);
}
