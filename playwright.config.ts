import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: 2,
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:5501",
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/firefox-smoke.spec.ts",
      use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--no-sandbox"] } },
    },
    {
      name: "firefox",
      testMatch: ["**/firefox-smoke.spec.ts", "**/virtualized-scroll.spec.ts"],
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: {
    command: "bun run preview",
    url: "http://127.0.0.1:5501",
    reuseExistingServer: !process.env.CI,
  },
  reporter: [["list"]],
});
