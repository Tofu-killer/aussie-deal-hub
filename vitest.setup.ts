import { beforeEach } from "vitest";

function applyDefaultRuntimeApiEnv() {
  process.env.API_BASE_URL ??= "http://127.0.0.1:3001";
  process.env.ADMIN_API_BASE_URL ??= "http://127.0.0.1:3001";
}

applyDefaultRuntimeApiEnv();

beforeEach(() => {
  applyDefaultRuntimeApiEnv();
});
