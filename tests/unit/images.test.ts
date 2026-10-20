import { beforeEach, describe, it, expect, vi } from "vitest";
import { DEFAULT_SETTINGS, type FormatId } from "@converta/core";
import { convertImage } from "@/adapters/images";
const fake = vi.hoisted(() => ({
  bitmap: { width: 2, height: 2, close: vi.fn() },
  context: {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255]),
      width: 2,
      height: 2,
    })),
  },
  native: vi.fn(),
  contextMissing: false,
  canvasMime: "",
  avifEncode: vi.fn(),
  avifDecode: vi.fn(),
  ifd: vi.fn(),
}));
vi.mock("utif", () => ({
  default: {
    decode: fake.ifd,
    decodeImage: vi.fn(),
    toRGBA8: () => new Uint8Array(16),
    encodeImage: () => new ArrayBuffer(16),
  },
}));
vi.mock("@jsquash/avif/codec/enc/avif_enc.js", () => ({
  default: vi.fn(async () => ({ encode: fake.avifEncode })),
}));
vi.mock("@jsquash/avif/decode.js", () => ({ default: fake.avifDecode, init: vi.fn() }));
beforeEach(() => {
  fake.bitmap.width = 2;
  fake.bitmap.height = 2;
  fake.bitmap.close.mockClear();
  fake.contextMissing = false;
  fake.canvasMime = "";
  fake.native.mockReset().mockResolvedValue(fake.bitmap);
  fake.avifEncode.mockReturnValue(new Uint8Array([1, 2, 3]));
  fake.avifDecode.mockResolvedValue({ data: new Uint8ClampedArray(16), width: 2, height: 2 });
  fake.ifd.mockReturnValue([{ width: 2, height: 2 }]);
  vi.stubGlobal("createImageBitmap", fake.native);
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return fake.contextMissing ? null : fake.context;
      }
      async convertToBlob(options: { type: string }) {
        return new Blob(["encoded"], { type: fake.canvasMime || options.type });
      }
    },
  );
  vi.stubGlobal(
    "ImageData",
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
});
describe("image encoding adapter", () => {
  it.each(["png", "jpg", "webp", "avif", "bmp", "ico", "tiff", "gif"] as FormatId[])(
    "encodes %s and closes decoded pixel resources",
    async (format) => {
      const progress = vi.fn();
      const result = await convertImage(
        new File(["png"], "a.png"),
        format,
        DEFAULT_SETTINGS,
        progress,
      );
      expect(result.size).toBeGreaterThan(0);
      expect(progress).toHaveBeenCalledWith(0.45);
      expect(fake.bitmap.close).toHaveBeenCalledOnce();
    },
  );
  it("bounds ICO dimensions and refuses huge images", async () => {
    fake.bitmap.width = 512;
    fake.bitmap.height = 512;
    const ico = await convertImage(
      new File(["png"], "a.png"),
      "ico",
      { ...DEFAULT_SETTINGS, maxEdge: 128 },
      vi.fn(),
    );
    expect(new Uint8Array(await ico.arrayBuffer())[6]).toBe(128);
    fake.bitmap.width = 10000;
    fake.bitmap.height = 10000;
    await expect(
      convertImage(new File(["png"], "a.png"), "png", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("tooLarge");
    expect(fake.bitmap.close).toHaveBeenCalledTimes(2);
  });
  it("rejects missing encoders and prevents a silently mislabeled PNG", async () => {
    fake.canvasMime = "image/png";
    await expect(
      convertImage(new File(["png"], "a.png"), "webp", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("encode");
    fake.contextMissing = true;
    await expect(
      convertImage(new File(["png"], "a.png"), "png", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("encode");
    fake.contextMissing = false;
    fake.avifEncode.mockReturnValue(null);
    await expect(
      convertImage(new File(["png"], "a.png"), "avif", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("encode");
  });
  it("decodes TIFF and AVIF with local fallbacks", async () => {
    fake.native.mockRejectedValueOnce(new Error("native"));
    expect(
      (await convertImage(new File(["tiff"], "a.tif"), "png", DEFAULT_SETTINGS, vi.fn())).type,
    ).toBe("image/png");
    fake.native.mockRejectedValueOnce(new Error("native"));
    await convertImage(new File(["avif"], "a.avif"), "png", DEFAULT_SETTINGS, vi.fn());
    fake.native.mockRejectedValueOnce(new Error("native"));
    fake.avifDecode.mockResolvedValue(null);
    await expect(
      convertImage(new File(["avif"], "a.avif"), "png", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("decode");
  });
  it("handles malformed TIFFs and unsupported input", async () => {
    fake.native.mockRejectedValueOnce(new Error("native"));
    fake.ifd.mockReturnValue([]);
    await expect(
      convertImage(new File(["bad"], "a.tiff"), "png", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("decode");
    fake.native.mockRejectedValueOnce(new Error("native"));
    fake.ifd.mockReturnValue([{ width: 10000, height: 10000 }]);
    await expect(
      convertImage(new File(["bad"], "a.tiff"), "png", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("tooLarge");
    fake.native.mockRejectedValueOnce(new Error("native"));
    await expect(
      convertImage(new File(["bad"], "a.png"), "png", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("decode");
  });
});
