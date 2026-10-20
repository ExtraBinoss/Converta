import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
const fixture = fileURLToPath(new URL("../fixtures/transparent.png", import.meta.url));
test("Firefox : panneaux floutés, thème et vue étroite", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Converta", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plinka", exact: true })).toHaveAttribute(
    "href",
    "https://plinka.eu",
  );
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.getByRole("button", { name: "Réglages pour transparent.png" }).click();
  const panel = page.locator('[data-slot="popover-content"]');
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((element) => getComputedStyle(element).backdropFilter)).toContain(
    "blur(20px)",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Sombre", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Réglages pour transparent.png", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Réglages", exact: true })).toBeVisible();
});
test("Firefox : conversion image dans un worker", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.getByRole("combobox", { name: "Format pour transparent.png" }).click();
  await page.getByRole("option", { name: "WebP", exact: true }).click();
  await page.getByRole("button", { name: "Convertir 1 fichier", exact: true }).click();
  await expect(page.locator(".download-button")).toHaveCount(1);
});
