import { describe, it, expect, vi } from "vitest";
import { prepareImage } from "@/adapters/prepare-image";
vi.mock("heic2any", () => ({
  default: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
}));
describe("image import boundary", () => {
  it("keeps native images and decodes HEIC locally", async () => {
    const png = new File(["png"], "a.png");
    expect(await prepareImage(png)).toBe(png);
    expect((await prepareImage(new File(["heic"], "a.heic"))).type).toBe("image/png");
    const { default: heic } = await import("heic2any");
    vi.mocked(heic).mockResolvedValueOnce([new Blob(["png"])]);
    expect((await prepareImage(new File(["heif"], "a.heif"))).name).toBe("decoded.png");
    vi.mocked(heic).mockResolvedValueOnce([]);
    await expect(prepareImage(new File(["heif"], "a.heif"))).rejects.toThrow("decode");
  });
  it.each([
    "<invalid/>",
    '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="evil()"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://external/image.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="url(https://external/image.png)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "https://external/style.css"</style></svg>',
  ])("rejects active or external SVG content %s", async (svg) => {
    await expect(prepareImage(new File([svg], "a.svg"))).rejects.toThrow("svg");
  });
  it("bounds SVG dimensions before decoding", async () => {
    await expect(
      prepareImage(
        new File(
          ['<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"/>'],
          "a.svg",
        ),
      ),
    ).rejects.toThrow("tooLarge");
  });
  it("rasterizes a self-contained SVG and releases its temporary URL", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
      callback(new Blob(["png"])),
    );
    expect(
      (
        await prepareImage(
          new File(
            [
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><defs><mask id="x"/></defs><path fill="red" mask="url(#x)"/></svg>',
            ],
            "a.svg",
          ),
        )
      ).name,
    ).toBe("decoded.png");
    expect(revoke).toHaveBeenCalledWith("blob:image");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(
      prepareImage(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "a.svg")),
    ).rejects.toThrow("encode");
  });
});
