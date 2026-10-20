export function encodeBmp(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array<ArrayBuffer> {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    rgba.length !== width * height * 4
  )
    throw new Error("dimensions");
  const stride = Math.ceil((width * 3) / 4) * 4;
  const bytes = new Uint8Array(54 + stride * height);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x4d42, true);
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, stride * height, true);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      const target = 54 + (height - 1 - y) * stride + x * 3;
      const alpha = rgba[source + 3]! / 255;
      bytes[target] = Math.round(rgba[source + 2]! * alpha + 255 * (1 - alpha));
      bytes[target + 1] = Math.round(rgba[source + 1]! * alpha + 255 * (1 - alpha));
      bytes[target + 2] = Math.round(rgba[source]! * alpha + 255 * (1 - alpha));
    }
  return bytes;
}
export function encodeIco(png: Uint8Array, width: number, height: number): Uint8Array<ArrayBuffer> {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 256 ||
    height > 256
  )
    throw new Error("dimensions");
  const bytes = new Uint8Array(22 + png.length);
  const view = new DataView(bytes.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  bytes[6] = width === 256 ? 0 : width;
  bytes[7] = height === 256 ? 0 : height;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, png.length, true);
  view.setUint32(18, 22, true);
  bytes.set(png, 22);
  return bytes;
}
