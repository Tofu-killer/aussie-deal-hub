import { beforeEach } from "vitest";

function applyDefaultAdminRuntimeApiEnv() {
  process.env.ADMIN_API_BASE_URL ??= "http://127.0.0.1:3001";
}

applyDefaultAdminRuntimeApiEnv();

beforeEach(() => {
  applyDefaultAdminRuntimeApiEnv();
});
