import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker/index.js";

test("Worker initializes API routes", async () => {
  const response = await worker.fetch(new Request("https://example.com/api"), {
    DATABASE_URL: "postgresql://user:pass@example.com/database",
    JWT_SECRET: "test-secret",
    CORS_ORIGIN: "*"
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, "请先登录");
});
