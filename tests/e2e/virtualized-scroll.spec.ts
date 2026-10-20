import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const fixture = fileURLToPath(new URL("../fixtures/transparent.png", import.meta.url));
const longName = `Photographie_${"nom très long avec espaces été 東京_".repeat(12)}.png`;
async function queue(page: Page, count = 40) {
  const buffer = await readFile(fixture);
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(
    Array.from({ length: count }, (_, index) => ({
      name: index === 0 ? longName : `photo-${String(index + 1).padStart(2, "0")}.png`,
      mimeType: "image/png",
      buffer,
    })),
  );
  await expect(page.locator(".file-list")).toHaveAttribute("data-total-count", String(count));
  await expect(page.locator('.file-row[aria-posinset="1"]')).toBeVisible();
  await expect(page.locator('.file-row[aria-posinset="1"] .file-preview img')).toHaveJSProperty(
    "complete",
    true,
  );
}
async function end(page: Page, count: number) {
  // Variable-height items are measured as they enter the viewport.
  await expect(async () => {
    await page.locator(".file-list").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.locator(`.file-row[aria-posinset="${count}"]`)).toBeVisible({
      timeout: 1000,
    });
    await expect(page.locator(".file-list-surface")).toHaveAttribute(
      "data-scroll-bottom",
      "false",
      { timeout: 1000 },
    );
  }).toPass({ timeout: 10000 });
}
for (const width of [320, 1280]) {
  test(`VList ${width}px : fondus de surface, bords exacts et DOM borné`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await queue(page);
    const surface = page.locator(".file-list-surface");
    await expect(surface).toHaveAttribute("data-scroll-top", "false");
    await expect(surface).toHaveAttribute("data-scroll-bottom", "true");
    expect(await page.locator(".file-row").count()).toBeLessThan(20);
    await expect
      .poll(() => page.locator(".file-name").first().getAttribute("data-overflow"))
      .toBe("true");
    const fade = surface.locator(":scope > .scroll-shadow-bottom");
    expect(await fade.evaluate((el) => getComputedStyle(el).backdropFilter)).toContain("blur(5px)");
    expect(await fade.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    const fadeBounds = await fade.boundingBox();
    const listBounds = await surface.boundingBox();
    // Only 24px cover content; the remaining 12px blend into the action bar's spacing.
    expect(fadeBounds!.height).toBe(36);
    expect(fadeBounds!.y + fadeBounds!.height - listBounds!.y - listBounds!.height).toBe(12);
    const light = await fade.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(light).toMatch(/0\.98|251/);
    await page.locator(".file-list").evaluate((el) => {
      el.scrollTop = 280;
    });
    await expect(surface).toHaveAttribute("data-scroll-top", "true");
    await expect(surface.locator(":scope > .scroll-shadow-top")).toHaveCSS("opacity", "1");
    const bounds = await surface.evaluate((el) => ({
      outer: el.getBoundingClientRect().toJSON(),
      top: el.querySelector(":scope > .scroll-shadow-top")!.getBoundingClientRect().toJSON(),
    }));
    expect(bounds.top.left).toBe(bounds.outer.left);
    expect(bounds.top.width).toBe(bounds.outer.width);
    await page.getByRole("button", { name: "Sombre", exact: true }).click();
    expect(await fade.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(light);
    await end(page, 40);
    expect(await page.locator(".file-row").count()).toBeLessThan(20);
    expect(
      await page.evaluate(() => ({
        x: document.documentElement.scrollWidth <= innerWidth,
        y: document.documentElement.scrollHeight <= innerHeight,
      })),
    ).toEqual({ x: true, y: true });
    // Last item remains actionable, and removal updates the virtualizer's total and edges.
    await page.getByRole("button", { name: "Retirer photo-40.png", exact: true }).click();
    await expect(page.locator(".file-list")).toHaveAttribute("data-total-count", "39");
    await end(page, 39);
  });
}
test("marquee : survol GPU, arrêt immédiat, focus, texte court et réduction des animations", async ({
  page,
}) => {
  await queue(page, 2);
  const name = page.locator(".file-name").first();
  const text = name.locator(".marquee-text");
  await expect(name).toHaveAttribute("data-overflow", "true");
  await expect(page.locator(".file-list-surface")).toHaveAttribute("data-scroll-bottom", "false");
  await name.hover();
  await expect(name).toHaveAttribute("data-marquee-active", "true");
  await expect
    .poll(() => text.evaluate((el) => getComputedStyle(el).transform))
    .not.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  expect(await text.evaluate((el) => el.getAnimations().length)).toBe(1);
  await page.mouse.move(0, 0);
  await expect(name).not.toHaveAttribute("data-marquee-active");
  await expect(text).toHaveCSS("transform", "none");
  await expect.poll(() => text.evaluate((el) => el.getAnimations().length)).toBe(0);
  await name.focus();
  await expect(name).toHaveAttribute("data-marquee-active", "true");
  await page.keyboard.press("Tab");
  await expect(text).toHaveCSS("transform", "none");
  const short = page.locator(".file-name").nth(1);
  await short.hover();
  await expect(short).toHaveAttribute("data-overflow", "false");
  await expect(short).not.toHaveAttribute("data-marquee-active");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await name.hover();
  await expect(name).not.toHaveAttribute("data-marquee-active");
  await expect(text).toHaveCSS("transform", "none");
});
test("les réglages et le focus restent attachés à leur fichier hors écran", async ({ page }) => {
  await queue(page);
  const first = page.locator('.file-row[aria-posinset="1"]');
  await first.getByRole("button", { name: `Réglages pour ${longName}`, exact: true }).click();
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
  await end(page, 40);
  await expect(first).toBeAttached();
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".file-list").focus();
  await expect(first).toHaveCount(0);
  await page.locator(".file-list").evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(first).toBeVisible();
});
test("les listes de formats ont leur propre scroll et leurs fondus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL("../fixtures/sample.webm", import.meta.url)));
  await page.getByRole("combobox", { name: "Format pour sample.webm" }).click();
  const list = page.locator('[data-slot="select-list"]');
  await expect(list).toBeVisible();
  const surface = page.locator(".popup-scroll-surface").last();
  await expect(surface).toHaveAttribute("data-scroll-bottom", "true");
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(surface).toHaveAttribute("data-scroll-top", "true");
  await expect(surface).toHaveAttribute("data-scroll-bottom", "false");
  await page.getByRole("option", { name: "FLAC", exact: true }).click();
  await expect(
    page
      .getByRole("combobox", { name: "Format pour sample.webm" })
      .locator('[data-slot="select-value"]'),
  ).toHaveText("FLAC");
});
