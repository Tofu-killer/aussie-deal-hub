import { beforeEach } from "vitest";

function applyDefaultWebRuntimeApiEnv() {
  process.env.API_BASE_URL ??= "http://127.0.0.1:3001";
}

applyDefaultWebRuntimeApiEnv();

beforeEach(() => {
  applyDefaultWebRuntimeApiEnv();
});
