import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
const minimum = { lines: 85, statements: 85, functions: 85, branches: 85 };
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    setupFiles: ["tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "apps/web/src/components/ui/**"],
      reporter: ["text", "html", "lcov"],
      thresholds: { ...minimum, "packages/core/src/**": minimum },
    },
  },
});
