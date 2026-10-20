// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  FORMATS,
  extension,
  detectKind,
  getFormat,
  outputFormats,
  defaultFormat,
  outputName,
  uniqueNames,
  dimensions,
  INITIAL_JOB,
  transition,
  ConversionError,
} from "@converta/core";
import { encodeBmp, encodeIco } from "../../packages/core/src/bitmap";
describe("conversion contracts", () => {
  it("identifies formats regardless of missing browser MIME", () => {
    expect(extension("PHOTO.JPEG")).toBe("jpeg");
    expect(extension("noext")).toBe("");
    for (const name of ["a.png", "a.heic", "a.svg", "a.tif"])
      expect(detectKind(name, "")).toBe("image");
    for (const name of ["a.webm", "a.mkv", "a.avi"]) expect(detectKind(name, "")).toBe("video");
    for (const name of ["a.flac", "a.aiff", "a.wav"]) expect(detectKind(name, "")).toBe("audio");
    for (const kind of ["image", "video", "audio"] as const)
      expect(detectKind("file", `${kind}/unknown`)).toBe(kind);
    expect(detectKind("a.pdf", "application/pdf")).toBeNull();
    expect(defaultFormat("image")).toBe("png");
    expect(defaultFormat("video")).toBe("mp4");
    expect(defaultFormat("audio")).toBe("mp3");
    expect(outputFormats("video").some((format) => format.id === "mp3")).toBe(true);
    expect(outputFormats("audio").every((format) => format.kind === "audio")).toBe(true);
    for (const format of FORMATS) expect(getFormat(format.id)).toBe(format);
  });
  it("preserves names and avoids collisions in ZIP archives", () => {
    expect(outputName("été.photo.png", "jpg")).toBe("été.photo.jpg");
    expect(outputName(".png", "jpg")).toBe("fichier.jpg");
    expect(outputName("image", "webp")).toBe("image.webp");
    expect(
      uniqueNames(["A.png", "a.png", "a (2).png", "README", "README", ".dot", ".dot"]),
    ).toEqual(["A.png", "a (2).png", "a (2) (2).png", "README", "README (2)", ".dot", ".dot (2)"]);
  });
  it("resizes proportionally without upscaling", () => {
    expect(dimensions(400, 200, 100)).toEqual({ width: 100, height: 50 });
    expect(dimensions(100, 200, 0)).toEqual({ width: 100, height: 200 });
    expect(dimensions(2, 1, 100)).toEqual({ width: 2, height: 1 });
    expect(dimensions(1, 9999, 1)).toEqual({ width: 1, height: 1 });
    for (const input of [
      [0, 2, 1],
      [2, -1, 1],
      [2, 1, -1],
      [Infinity, 1, 1],
      [1, NaN, 1],
    ])
      expect(() => dimensions(...(input as [number, number, number]))).toThrow();
    expect(new ConversionError("decode").code).toBe("decode");
  });
  it("ignores stale messages and keeps finalization distinct from progress", () => {
    const active = transition(INITIAL_JOB, { type: "start", runId: "a" });
    expect(transition(active, { type: "start", runId: "b" })).toBe(active);
    expect(transition(active, { type: "reset" })).toBe(active);
    expect(transition(active, { type: "done", runId: "b" })).toBe(active);
    expect(transition(INITIAL_JOB, { type: "done", runId: "a" })).toBe(INITIAL_JOB);
    const half = transition(active, { type: "progress", runId: "a", progress: 0.5 });
    expect(transition(half, { type: "progress", runId: "a", progress: 0.1 }).progress).toBe(0.5);
    expect(transition(half, { type: "progress", runId: "a", progress: NaN })).toBe(half);
    expect(transition(active, { type: "progress", runId: "a", progress: -1 }).progress).toBe(0);
    expect(transition(active, { type: "progress", runId: "a", progress: 1 }).progress).toBe(0.99);
    expect(transition(half, { type: "done", runId: "a" })).toMatchObject({
      status: "done",
      progress: 1,
    });
    expect(transition(half, { type: "error", runId: "a" })).toMatchObject({
      status: "error",
      progress: 0.5,
    });
    expect(transition(half, { type: "cancel", runId: "a" })).toMatchObject({ status: "canceled" });
    expect(transition(half, { type: "done", runId: "a" })).not.toBe(half);
    expect(transition(INITIAL_JOB, { type: "reset" })).toBe(INITIAL_JOB);
  });
  it("writes real padded BMP pixels in bottom-up order", () => {
    const bmp = encodeBmp(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 0]), 1, 2);
    const view = new DataView(bmp.buffer);
    expect(Array.from(bmp.subarray(0, 2))).toEqual([66, 77]);
    expect(view.getUint32(2, true)).toBe(62);
    expect(view.getUint32(18, true)).toBe(1);
    expect(view.getUint32(22, true)).toBe(2);
    expect(Array.from(bmp.subarray(54))).toEqual([255, 255, 255, 0, 0, 0, 255, 0]);
    expect(() => encodeBmp(new Uint8ClampedArray(0), 1, 1)).toThrow();
    expect(() => encodeBmp(new Uint8ClampedArray(0), 0, 1)).toThrow();
    expect(() => encodeBmp(new Uint8ClampedArray(0), 1, -1)).toThrow();
    expect(() => encodeBmp(new Uint8ClampedArray(0), 1.5, 1)).toThrow();
  });
  it("wraps PNGs in a valid ICO directory", () => {
    const ico = encodeIco(new Uint8Array([1, 2, 3]), 256, 128);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(2, true)).toBe(1);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(128);
    expect(view.getUint32(14, true)).toBe(3);
    expect(view.getUint32(18, true)).toBe(22);
    expect(Array.from(ico.subarray(22))).toEqual([1, 2, 3]);
    expect(encodeIco(new Uint8Array(), 128, 256)[7]).toBe(0);
    for (const [w, h] of [
      [0, 2],
      [2, 0],
      [257, 1],
      [1, 257],
      [1.5, 1],
    ])
      expect(() => encodeIco(new Uint8Array(), w!, h!)).toThrow();
  });
});
