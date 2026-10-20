declare module "gifenc" {
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    colors: number,
    options?: { format?: string; oneBitAlpha?: boolean },
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options: { palette: number[][]; transparent?: boolean; transparentIndex?: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  };
}
