import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
async function complete(page: Page) {
  await page.goto("/");
  const buffer = await readFile(
    fileURLToPath(new URL("../fixtures/transparent.png", import.meta.url)),
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles(["a.png", "b.png"].map((name) => ({ name, mimeType: "image/png", buffer })));
  await page.getByRole("button", { name: "Convertir 2 fichiers", exact: true }).click();
  await expect(page.locator(".download-button")).toHaveCount(2);
}
test("ordinateur : ZIP par défaut et choix de fichiers séparés", async ({ page }) => {
  await complete(page);
  await page.getByRole("button", { name: "Options de téléchargement", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Archive ZIP", exact: true })).toBeChecked();
  expect(
    await page
      .locator(".download-mode-popover")
      .evaluate((el) => getComputedStyle(el).backdropFilter),
  ).toContain("blur(20px)");
  await page.keyboard.press("Escape");
  const ready = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tout télécharger", exact: true }).click();
  const archive = await ready;
  expect(archive.suggestedFilename()).toBe("converta.zip");
  expect(
    Object.keys(unzipSync(new Uint8Array(await readFile((await archive.path())!)))).sort(),
  ).toEqual(["a.png", "b.png"]);
  await page.getByRole("button", { name: "Options de téléchargement", exact: true }).click();
  await page.getByRole("radio", { name: "Fichiers séparés", exact: true }).check();
  const files: string[] = [];
  page.on("download", (file) => files.push(file.suggestedFilename()));
  await page.getByRole("button", { name: "Tout télécharger", exact: true }).click();
  await expect.poll(() => files.sort()).toEqual(["a.png", "b.png"]);
});
test("mobile : fichiers séparés par défaut, ZIP sélectionnable, aucun débordement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await complete(page);
  await page.getByRole("button", { name: "Options de téléchargement", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Fichiers séparés", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  const files: string[] = [];
  page.on("download", (file) => files.push(file.suggestedFilename()));
  await page.getByRole("button", { name: "Tout télécharger", exact: true }).click();
  await expect.poll(() => files.sort()).toEqual(["a.png", "b.png"]);
  await page.getByRole("button", { name: "Options de téléchargement", exact: true }).click();
  await page.getByRole("radio", { name: "Archive ZIP", exact: true }).check();
  const ready = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tout télécharger", exact: true }).click();
  expect((await ready).suggestedFilename()).toBe("converta.zip");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await page.locator(".download-label").evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});

test("les données de démonstration restent désactivées en production", async ({ page }) => {
  await page.goto("/?dev=1");
  await expect(page.locator(".dev-panel")).toHaveCount(0);
  await expect(page.locator(".dropzone")).toBeVisible();
});
