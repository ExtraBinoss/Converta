import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
const fixtures = fileURLToPath(new URL("../fixtures/", import.meta.url));
test("les popovers conservent leur blur en production", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(`${fixtures}sample.webm`);
  await page.getByRole("button", { name: "Réglages pour sample.webm", exact: true }).click();
  const panel = page.locator('[data-slot="popover-content"]');
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((element) => getComputedStyle(element).backdropFilter)).toContain(
    "blur(20px)",
  );
  // Put a contrasting file preview under the actual popup; compare the same surface.
  await page.evaluate(() => {
    const panel = document.querySelector('[data-slot="popover-content"]')!.getBoundingClientRect();
    const underlay = document.createElement("div");
    underlay.style.cssText = `position:fixed;left:${panel.x}px;top:${panel.y}px;width:${panel.width}px;height:${panel.height}px;background:repeating-linear-gradient(45deg,#2563eb 0 7px,#ffd36b 7px 14px);z-index:40;pointer-events:none`;
    document.body.append(underlay);
  });
  const filtered = await panel.screenshot({ animations: "disabled" });
  await panel.evaluate((element) => {
    (element as HTMLElement).style.setProperty("-webkit-backdrop-filter", "none");
    (element as HTMLElement).style.setProperty("backdrop-filter", "none");
  });
  const unfiltered = await panel.screenshot({ animations: "disabled" });
  expect(filtered.equals(unfiltered)).toBe(false);
});
test("interface claire, thème sombre et mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Converta", exact: true })).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/converta-light.png", fullPage: true });
  await page.getByRole("button", { name: "Sombre", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "artifacts/converta-dark.png", fullPage: true });
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "artifacts/converta-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("combobox", { name: "Langue" }).click();
  await page.getByRole("option", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Converta", exact: true })).toBeVisible();
});
for (const format of ["PNG", "JPG", "WebP", "AVIF", "GIF", "BMP", "ICO", "TIFF"]) {
  test(`image réelle vers ${format}`, async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(`${fixtures}transparent.png`);
    if (format !== "PNG") {
      await page.getByRole("combobox", { name: "Format pour transparent.png" }).click();
      await page.getByRole("option", { name: format, exact: true }).click();
    }
    await page.getByRole("button", { name: "Convertir 1 fichier", exact: true }).click();
    await expect(page.locator(".download-button")).toHaveCount(1, { timeout: 45000 });
    const download = page.waitForEvent("download");
    await page.locator(".download-button").click();
    const file = await download;
    const path = await file.path();
    expect(path).toBeTruthy();
    const result = await readFile(path!);
    expect(result.length).toBeGreaterThan(20);
    if (format === "AVIF") expect(result.subarray(4, 12).toString()).toContain("ftypavif");
    if (format === "TIFF") {
      expect(result.subarray(0, 4)).toEqual(Buffer.from([77, 77, 0, 42]));
      expect(result.subarray(1000, 1004)).toEqual(Buffer.from([37, 99, 235, 255]));
    }
    if (format === "PNG" || format === "WebP") {
      const pixels = await page.evaluate(async (data) => {
        const blob = new Blob([new Uint8Array(data)]);
        const image = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        return {
          width: image.width,
          height: image.height,
          left: Array.from(context.getImageData(1, 1, 1, 1).data),
          right: Array.from(context.getImageData(50, 1, 1, 1).data),
        };
      }, Array.from(result));
      expect(pixels.width).toBe(64);
      expect(pixels.height).toBe(32);
      expect(pixels.left[3]).toBe(255);
      expect(pixels.right[3]).toBe(0);
    }
    if (format === "JPG") {
      const info = JSON.parse(
        execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", path!], {
          encoding: "utf8",
        }),
      );
      expect(info.streams[0].width).toBe(64);
    }
  });
}
test("WebM vers MP4 conserve la vidéo et le son", async ({ page }) => {
  const outside: string[] = [];
  const engineRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/engines/")) engineRequests.push(request.url());
    const publicCounter =
      request.url() === "https://api.github.com/repos/ExtraBinoss/Converta" &&
      request.method() === "GET" &&
      request.postData() === null;
    if (
      !request.url().startsWith("http://127.0.0.1:5501") &&
      !request.url().startsWith("blob:") &&
      !publicCounter
    )
      outside.push(request.url());
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(`${fixtures}sample.webm`);
  await page.getByRole("button", { name: "Convertir 1 fichier", exact: true }).click();
  await expect(page.locator(".download-button")).toHaveCount(1, { timeout: 90000 });
  const download = page.waitForEvent("download");
  await page.locator(".download-button").click();
  const path = await (await download).path();
  const info = JSON.parse(
    execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", path!], {
      encoding: "utf8",
    }),
  );
  expect(info.streams.some((stream: { codec_name: string }) => stream.codec_name === "h264")).toBe(
    true,
  );
  expect(info.streams.some((stream: { codec_type: string }) => stream.codec_type === "audio")).toBe(
    true,
  );
  expect(outside).toEqual([]);
  expect(engineRequests).toEqual([]);
});
test("WAV vers MP3, erreurs et lot ZIP", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles([`${fixtures}tone.wav`, `${fixtures}transparent.png`]);
  await page.getByRole("button", { name: "Convertir 2 fichiers", exact: true }).click();
  await expect(page.locator(".download-button")).toHaveCount(2, { timeout: 45000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tout télécharger", exact: true }).click();
  const result = await download;
  expect(result.suggestedFilename()).toBe("converta.zip");
  const { unzipSync } = await import("fflate");
  const files = unzipSync(new Uint8Array(await readFile((await result.path())!)));
  expect(Object.keys(files).sort()).toEqual(["tone.mp3", "transparent.png"]);
  await page.getByRole("button", { name: "Nouvelle conversion", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid image"),
  });
  await page.getByRole("button", { name: "Convertir 1 fichier", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("illisible");
});

async function downloadResult(page: Page) {
  await page.getByRole("button", { name: "Convertir 1 fichier", exact: true }).click();
  await expect(page.locator(".download-button")).toHaveCount(1, { timeout: 90000 });
  const download = page.waitForEvent("download");
  await page.locator(".download-button").click();
  return (await (await download).path())!;
}
test("AVI vers MP4 utilise réellement le secours WASM local", async ({ page }) => {
  const engines: string[] = [];
  const network: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/engines/")) engines.push(request.url());
    const publicCounter =
      request.url() === "https://api.github.com/repos/ExtraBinoss/Converta" &&
      request.method() === "GET" &&
      request.postData() === null;
    if (
      !request.url().startsWith("http://127.0.0.1:5501") &&
      !request.url().startsWith("blob:") &&
      !publicCounter
    )
      network.push(request.url());
  });
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(`${fixtures}legacy.avi`);
  const path = await downloadResult(page);
  const info = JSON.parse(
    execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", path], {
      encoding: "utf8",
    }),
  );
  expect(info.streams.some((stream: { codec_name: string }) => stream.codec_name === "h264")).toBe(
    true,
  );
  expect(
    [0, 1].every((part) => engines.some((url) => url.endsWith(`ffmpeg-core.wasm.${part}`))),
  ).toBe(true);
  expect(network).toEqual([]);
});
test("compression vidéo : résolution, cadence et retrait du son", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(`${fixtures}sample.webm`);
  await page.getByRole("button", { name: /^Réglages pour / }).click();
  await page.getByRole("textbox", { name: "Qualité vidéo" }).fill("40");
  await page.getByRole("textbox", { name: "Qualité vidéo" }).press("Enter");
  await page.getByRole("combobox", { name: "Images par seconde" }).click();
  await page.getByRole("option", { name: "24 i/s", exact: true }).click();
  await page.getByRole("switch", { name: "Retirer le son" }).click();
  await page.keyboard.press("Escape");
  const path = await downloadResult(page);
  const info = JSON.parse(
    execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", path], {
      encoding: "utf8",
    }),
  );
  expect(info.streams).toHaveLength(1);
  expect(info.streams[0].codec_name).toBe("h264");
  expect(info.streams[0].r_frame_rate).toBe("24/1");
  await page.getByRole("button", { name: /^Réglages pour / }).click();
  await page.getByRole("button", { name: "Réinitialiser", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Convertir 1 fichier", exact: true }),
  ).toBeVisible();
});
for (const format of ["FLAC", "M4A", "OGG"]) {
  test(`WAV vers ${format} en mono`, async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(`${fixtures}tone.wav`);
    await page.getByRole("combobox", { name: "Format pour tone.wav" }).click();
    await page.getByRole("option", { name: format, exact: true }).click();
    await page.getByRole("button", { name: /^Réglages pour / }).click();
    await page.getByRole("switch", { name: "Audio mono" }).click();
    await page.keyboard.press("Escape");
    const path = await downloadResult(page);
    const info = JSON.parse(
      execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", path], {
        encoding: "utf8",
      }),
    );
    expect(info.streams[0].channels).toBe(1);
    expect(info.streams[0].codec_type).toBe("audio");
  });
}
for (const extension of ["tiff", "svg"]) {
  test(`entrée ${extension} vers PNG avec transparence`, async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(`${fixtures}source.${extension}`);
    const path = await downloadResult(page);
    const result = await readFile(path);
    const image = await page.evaluate(async (data) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return {
        width: bitmap.width,
        height: bitmap.height,
        left: Array.from(context.getImageData(10, 10, 1, 1).data),
        right: Array.from(context.getImageData(50, 10, 1, 1).data),
      };
    }, Array.from(result));
    expect(image).toEqual({ width: 64, height: 32, left: [37, 99, 235, 255], right: [0, 0, 0, 0] });
  });
}
