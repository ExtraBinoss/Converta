import {
  ConversionError,
  dimensions,
  extension,
  getFormat,
  encodeBmp,
  encodeIco,
  type FormatId,
  type Settings,
} from "@converta/core";

export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const ext = extension(file.name);
    if (ext === "tif" || ext === "tiff") {
      const { default: UTIF } = await import("utif");
      const buffer = await file.arrayBuffer();
      const page = UTIF.decode(buffer)[0];
      if (!page) throw new ConversionError("decode");
      UTIF.decodeImage(buffer, page);
      if (page.width * page.height > 80_000_000) throw new ConversionError("tooLarge");
      return createImageBitmap(
        new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(page)), page.width, page.height),
      );
    }
    if (ext === "avif") {
      const { default: decodeAvif, init } = await import("@jsquash/avif/decode.js");
      const { default: wasmUrl } = await import("@jsquash/avif/codec/dec/avif_dec.wasm?url");
      await init({ locateFile: () => wasmUrl });
      const image = await decodeAvif(await file.arrayBuffer());
      if (!image) throw new ConversionError("decode");
      return createImageBitmap(image);
    }
    throw new ConversionError("decode");
  }
}
export async function convertImage(
  file: File,
  format: FormatId,
  settings: Settings,
  progress: (value: number) => void,
): Promise<Blob> {
  const bitmap = await decodeImage(file);
  progress(0.2);
  try {
    if (bitmap.width * bitmap.height > 80_000_000) throw new ConversionError("tooLarge");
    const { width, height } = dimensions(
      bitmap.width,
      bitmap.height,
      format === "ico" ? Math.min(settings.maxEdge || 256, 256) : settings.maxEdge,
    );
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new ConversionError("encode");
    if (format === "jpg" || format === "bmp") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    progress(0.45);
    if (format === "avif") {
      const { default: factory } = await import("@jsquash/avif/codec/enc/avif_enc.js");
      const { defaultOptions } = await import("@jsquash/avif/meta.js");
      const { default: wasmUrl } = await import("@jsquash/avif/codec/enc/avif_enc.wasm?url");
      const encoder = await factory({ locateFile: () => wasmUrl, noInitialRun: true });
      const result = encoder.encode(
        new Uint8Array(context.getImageData(0, 0, width, height).data),
        width,
        height,
        { ...defaultOptions, quality: settings.quality, speed: 6 },
      );
      if (!result) throw new ConversionError("encode");
      return new Blob([new Uint8Array(result)], { type: "image/avif" });
    }
    if (format === "bmp")
      return new Blob([encodeBmp(context.getImageData(0, 0, width, height).data, width, height)], {
        type: "image/bmp",
      });
    if (format === "tiff") {
      const { default: UTIF } = await import("utif");
      return new Blob(
        [
          UTIF.encodeImage(
            new Uint8Array(context.getImageData(0, 0, width, height).data),
            width,
            height,
          ),
        ],
        { type: "image/tiff" },
      );
    }
    if (format === "gif") {
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      const data = context.getImageData(0, 0, width, height).data;
      const palette = quantize(data, 256, { format: "rgba4444", oneBitAlpha: true });
      const transparentIndex = palette.findIndex((color) => color[3] === 0);
      const gif = GIFEncoder();
      gif.writeFrame(applyPalette(data, palette, "rgba4444"), width, height, {
        palette,
        transparent: transparentIndex >= 0,
        transparentIndex: Math.max(0, transparentIndex),
      });
      gif.finish();
      return new Blob([gif.bytes()], { type: "image/gif" });
    }
    if (format === "ico") {
      const png = await canvas.convertToBlob({ type: "image/png" });
      return new Blob([encodeIco(new Uint8Array(await png.arrayBuffer()), width, height)], {
        type: "image/x-icon",
      });
    }
    const mime = getFormat(format).mime;
    const blob = await canvas.convertToBlob({ type: mime, quality: settings.quality / 100 });
    if (blob.type !== mime) throw new ConversionError("encode");
    return blob;
  } finally {
    bitmap.close();
  }
}
