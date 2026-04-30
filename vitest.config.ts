import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          include: ["apps/admin/**/*.test.tsx"],
          exclude: ["**/node_modules/**"],
          environment: "jsdom",
        },
      },
      {
        test: {
          include: [
            "packages/**/*.test.ts",
            "packages/**/*.test.tsx",
            "apps/**/*.test.ts",
            "apps/**/*.test.tsx",
          ],
          exclude: ["apps/admin/**/*.test.tsx", "**/node_modules/**"],
          environment: "node",
        },
      },
    ],
  },
});
