import { runReadinessSmoke } from "../packages/config/src/readinessSmoke.ts";

const targets = [
  {
    name: "api-health",
    url: process.env.API_HEALTH_URL ?? "http://127.0.0.1:3001/v1/health",
    expectedStatus: 200,
  },
  {
    name: "api-ready",
    url: process.env.API_READY_URL ?? "http://127.0.0.1:3001/v1/ready",
    expectedStatus: 200,
  },
  {
    name: "web-health",
    url: process.env.WEB_HEALTH_URL ?? "http://127.0.0.1:3000/health",
    expectedStatus: 200,
  },
  {
    name: "web-ready",
    url: process.env.WEB_READY_URL ?? "http://127.0.0.1:3000/ready",
    expectedStatus: 200,
  },
  {
    name: "admin-health",
    url: process.env.ADMIN_HEALTH_URL ?? "http://127.0.0.1:3002/health",
    expectedStatus: 200,
  },
  {
    name: "admin-ready",
    url: process.env.ADMIN_READY_URL ?? "http://127.0.0.1:3002/ready",
    expectedStatus: 200,
  },
];

async function main() {
  await runReadinessSmoke(targets);
}

main().catch((error) => {
  console.error("Readiness smoke failed:", error);
  process.exitCode = 1;
});
