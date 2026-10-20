import { test, expect } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test.describe.configure({ mode: "serial" });
let server: ViteDevServer;
let cache: string;
test.beforeAll(async () => {
  cache = await mkdtemp(join(tmpdir(), "converta-vite-"));
  server = await createServer({
    configFile: fileURLToPath(new URL("../../vite.config.ts", import.meta.url)),
    cacheDir: cache,
    server: { port: 5502, strictPort: true, host: "127.0.0.1", open: false },
  });
  await server.listen();
});
test.afterAll(async () => {
  await server?.close();
  if (cache) await rm(cache, { recursive: true, force: true });
});
test("la première conversion ne recharge pas la page avec un cache Vite vide", async ({ page }) => {
  const navigations: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5502");
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  await page.evaluate(() => {
    Object.assign(window, { convertaFirstRun: "intact" });
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL("../fixtures/sample.webm", import.meta.url)));
  await page.getByRole("button", { name: "Convertir 1 fichier", exact: true }).click();
  await expect(page.locator(".download-button")).toHaveCount(1, { timeout: 45000 });
  await expect(page.getByRole("img", { name: "Aperçu de sample.webm" })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "convertaFirstRun"))).toBe("intact");
  expect(navigations).toEqual([]);
  expect(errors).toEqual([]);
});
