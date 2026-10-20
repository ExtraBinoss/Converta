import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
const fixtures = fileURLToPath(new URL("../fixtures/", import.meta.url));
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
  { width: 320, height: 740 },
]) {
  test(`fenêtre ${viewport.width} : dépôt, contrôles et défilement`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Langue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clair", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Audio", exact: true })).toHaveCount(0);
    const drop = await page.locator(".dropzone").boundingBox();
    expect(drop!.height).toBeGreaterThan(viewport.height * 0.6);
    await expect(page.locator(".keyboard-hint"))[
      viewport.width > 600 ? "toBeVisible" : "toBeHidden"
    ]();
    const fits = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      );
    expect(await fits()).toBe(true);
    await page
      .locator('input[type="file"]')
      .setInputFiles([`${fixtures}sample.webm`, `${fixtures}transparent.png`]);
    await expect(page.getByRole("img", { name: "Aperçu de sample.webm" })).toBeVisible();
    expect(
      await page
        .getByRole("img", { name: "Aperçu de sample.webm" })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    expect(await fits()).toBe(true);
    await page.getByRole("button", { name: "Réglages pour sample.webm" }).click();
    const panel = page.locator('[data-slot="popover-content"]');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(await panel.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe("thin");
    await page.keyboard.press("Escape");
    await page
      .locator('input[type="file"]')
      .setInputFiles(Array.from({ length: 20 }, () => `${fixtures}transparent.png`));
    expect(await fits()).toBe(true);
    expect(
      await page.locator(".file-list").evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
  });
}
test("chaque fichier garde ses propres réglages et son résultat", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles([`${fixtures}source.svg`, `${fixtures}transparent.png`]);
  await page.getByRole("button", { name: "Convertir 2 fichiers", exact: true }).click();
  await expect(page.locator(".download-button")).toHaveCount(2);
  await page.getByRole("button", { name: "Réglages pour source.svg" }).click();
  await page.getByRole("combobox", { name: "Côté le plus long" }).click();
  await page.getByRole("option", { name: "256 px" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Télécharger transparent.png", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Télécharger source.svg", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Convertir 1 fichier", exact: true }),
  ).toBeVisible();
});

test("une erreur conserve son explication et laisse convertir les autres fichiers", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "broken.png", mimeType: "image/png", buffer: Buffer.from("invalid image") },
    {
      name: "photo.png",
      mimeType: "image/png",
      buffer: await (await import("node:fs/promises")).readFile(`${fixtures}transparent.png`),
    },
  ]);
  await page.getByRole("button", { name: "Convertir 2 fichiers", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("illisible");
  await expect(
    page.getByRole("button", { name: "Télécharger photo.png", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Réessayer broken.png", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tout télécharger", exact: true })).toBeVisible();
});

test("chaque ligne a sa progression et la fin propose les deux actions", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles([`${fixtures}sample.webm`, `${fixtures}transparent.png`]);
  // Keep the real encoder waiting while inspecting both progress states.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/conversion.worker-*.js", async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Convertir 2 fichiers", exact: true }).click();
  try {
    await expect(page.getByRole("progressbar", { name: "Conversion… sample.webm" })).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "En attente transparent.png" }),
    ).toHaveAttribute("aria-valuenow", "0");
    await page.locator(".progress-ring").first().click();
    await expect(page.getByRole("tooltip")).toHaveText("0 %");
  } finally {
    release();
  }
  await expect(page.locator(".download-button")).toHaveCount(2);
  await expect(page.getByRole("progressbar", { name: "Terminé sample.webm" })).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  const again = page.getByRole("button", { name: "Nouvelle conversion", exact: true });
  await expect(again).toBeVisible();
  await expect(page.getByRole("button", { name: "Tout télécharger", exact: true })).toBeVisible();
  await again.click();
  await expect(page.locator(".dropzone")).toBeVisible();
});
