import { defineConfig, devices } from "@playwright/test";

const chromePath = process.env.E2E_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      executablePath: chromePath
    }
  },
  webServer: [
    {
      command: "pnpm dev:api",
      url: "http://127.0.0.1:3000/health",
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "pnpm dev:pc",
      url: "http://127.0.0.1:5173/pc-admin/",
      reuseExistingServer: true,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: "pc-admin",
      testMatch: /pc-admin\.spec\.js/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:5173"
      }
    },
    {
      name: "miniprogram",
      testMatch: /miniprogram\.spec\.cjs/
    }
  ]
});
