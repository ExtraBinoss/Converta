import { test, expect } from "@playwright/test";
test("GitHub : vrai compteur public révélé au survol et au focus", async ({ page }) => {
  await page.route("https://api.github.com/repos/ExtraBinoss/Converta", (route) =>
    route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: { stargazers_count: 1234 },
    }),
  );
  await page.goto("/");
  const link = page.getByRole("link", { name: "GitHub · 1234 étoiles", exact: true });
  await expect(link).toHaveAttribute("href", "https://github.com/ExtraBinoss/Converta");
  const count = link.locator(".github-count");
  await expect(count).toHaveCSS("opacity", "0");
  await link.hover();
  await expect(count).toHaveCSS("opacity", "1");
  await expect(count).toContainText(/1,2\s*k/);
  await page.mouse.move(0, 0);
  await expect(count).toHaveCSS("opacity", "0");
  await link.focus();
  await expect(count).toHaveCSS("opacity", "1");
});
test("les métadonnées initiales et la carte PNG sont prêtes au partage", async ({
  page,
  request,
}) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).toContain('property="og:image"');
  expect(html).toContain("https://converta.plinka.eu/social/converta.png");
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  const image = await request.get("/social/converta.png");
  expect(image.ok()).toBe(true);
  const bytes = await image.body();
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
  await page.goto("/?dev=1");
  await expect(page.locator(".dropzone")).toBeVisible();
  await expect(page.locator(".file-row, .dev-panel")).toHaveCount(0);
});
