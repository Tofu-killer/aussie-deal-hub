import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          include: ["apps/admin/**/*.test.tsx"],
          exclude: ["**/node_modules/**"],
          environment: "jsdom",
          setupFiles: ["./vitest.admin.setup.ts"],
        },
      },
      {
        test: {
          include: ["apps/admin/**/*.test.ts"],
          exclude: ["**/node_modules/**"],
          environment: "node",
          setupFiles: ["./vitest.admin.setup.ts"],
        },
      },
      {
        test: {
          include: [
            "apps/web/src/components/**/*.test.ts",
            "apps/web/src/components/**/*.test.tsx",
            "apps/web/src/lib/serverApi.test.ts",
          ],
          exclude: ["**/node_modules/**"],
          environment: "node",
          setupFiles: ["./vitest.web.setup.ts"],
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
          exclude: [
            "apps/admin/**/*.test.ts",
            "apps/admin/**/*.test.tsx",
            "apps/web/src/components/**/*.test.ts",
            "apps/web/src/components/**/*.test.tsx",
            "apps/web/src/lib/serverApi.test.ts",
            "**/node_modules/**",
          ],
          environment: "node",
        },
      },
    ],
  },
});
