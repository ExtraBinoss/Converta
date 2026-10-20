import { chromium } from "@playwright/test";
import { preview } from "vite";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = `${root}artwork/social/`;
await mkdir(`${directory}assets`, { recursive: true });
await mkdir(`${root}apps/web/public/social`, { recursive: true });
const site = await preview({
  preview: { host: "127.0.0.1", port: 5503, strictPort: true, open: false },
});
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let artwork: ReturnType<typeof createServer> | undefined;
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 650 },
    deviceScaleFactor: 1,
    locale: "en-US",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({ json: { stargazers_count: 0 } }),
  );
  await page.addInitScript(() => localStorage.setItem("converta.language", "en"));
  await page.goto("http://127.0.0.1:5503");
  const theme = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return `:root{${["--background", "--foreground", "--muted-foreground"].map((key) => `${key}:${s.getPropertyValue(key)}`).join(";")}}`;
  });
  await writeFile(`${directory}assets/theme.css`, theme);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#b7d9e7"/><stop offset="1" stop-color="#e8e6d6"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="#4a9ba5"/><stop offset="1" stop-color="#b9d9d1"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h960v640H0z"/><circle cx="690" cy="164" r="62" fill="#fbefce"/><path fill="#80978c" d="m0 340 190-166 150 150 170-101 180 182H0"/><path fill="#4d726c" d="m960 270-170-82-160 180H960"/><path fill="url(#water)" d="M0 350h960v290H0z"/><path fill="#e1d9bb" d="M0 486c210-56 290 104 480 69s299-91 480-64v149H0z"/><path fill="#f4edda" d="M0 506c210-56 290 104 480 69s299-91 480-64v24c-181-27-290 29-480 64S210 474 0 530z"/></svg>`;
  const png = await page.evaluate(async (source) => {
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = 640;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1]!;
    } finally {
      URL.revokeObjectURL(url);
    }
  }, svg);
  await page.locator('input[type="file"]').setInputFiles([
    { name: "Coast.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") },
    {
      name: "Escape.webm",
      mimeType: "video/webm",
      buffer: await readFile(`${root}tests/fixtures/sample.webm`),
    },
    {
      name: "Studio.wav",
      mimeType: "audio/wav",
      buffer: await readFile(`${root}tests/fixtures/tone.wav`),
    },
  ]);
  await page.getByRole("combobox", { name: "Format for Coast.png" }).click();
  await page.getByRole("option", { name: "WebP", exact: true }).click();
  await page.getByRole("button", { name: "Convert 3 files", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".download-button").length === 3,
    undefined,
    {
      timeout: 45000,
    },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  // Crop the genuine completed rows, without duplicating the logo or app footer.
  const bounds = await page.locator(".file-list-surface").boundingBox();
  if (!bounds) throw new Error("Missing conversion list");
  const rows = await page
    .locator(".file-row")
    .evaluateAll((elements) =>
      elements.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0),
    );
  await page.screenshot({
    path: `${directory}assets/conversion.png`,
    clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: Math.min(rows, bounds.height) },
    animations: "disabled",
  });
  const routes = new Map([
    ["/", { path: `${directory}index.html`, type: "text/html" }],
    ["/assets/conversion.png", { path: `${directory}assets/conversion.png`, type: "image/png" }],
    ["/assets/theme.css", { path: `${directory}assets/theme.css`, type: "text/css" }],
    [
      "/assets/wordmark.svg",
      { path: `${root}apps/web/public/converta-light.svg`, type: "image/svg+xml" },
    ],
    [
      "/assets/source-sans.woff2",
      {
        path: `${root}node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2`,
        type: "font/woff2",
      },
    ],
    [
      "/assets/space-grotesk.woff2",
      {
        path: `${root}node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2`,
        type: "font/woff2",
      },
    ],
  ]);
  artwork = createServer((req, res) => {
    const asset = routes.get(new URL(req.url ?? "/", "http://localhost").pathname);
    if (!asset) {
      res.writeHead(404).end();
      return;
    }
    void readFile(asset.path).then(
      (content) => {
        res.writeHead(200, { "Content-Type": asset.type });
        res.end(content);
      },
      () => {
        res.writeHead(500).end();
      },
    );
  });
  await new Promise<void>((resolve) => artwork!.listen(0, "127.0.0.1", resolve));
  const address = artwork.address();
  if (!address || typeof address === "string") throw new Error("Missing artwork port");
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  const output = `${root}apps/web/public/social/converta-en.png`;
  await page.screenshot({ path: output, animations: "disabled" });
  await copyFile(output, `${root}apps/web/public/social/converta.png`);
  console.log(`Social image: 1200 × 630 · ${Math.round((await stat(output)).size / 1024)} KiB`);
} finally {
  await browser.close();
  artwork?.close();
  await new Promise<void>((resolve) => site.httpServer.close(() => resolve()));
}
