import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          include: ["apps/admin/**/*.test.tsx"],
          exclude: ["**/node_modules/**"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
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
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
