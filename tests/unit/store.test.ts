import { beforeEach, describe, it, expect, vi } from "vitest";
import { getDefaultStore } from "jotai";
import { DEFAULT_SETTINGS, ConversionError } from "@converta/core";
import {
  entriesAtom,
  noticesAtom,
  busyAtom,
  addFiles,
  removeFile,
  clearFiles,
  setFormat,
  setSettings,
  start,
  cancel,
  download,
  downloadAll,
} from "@/features/converter/store";
import { convert } from "@/adapters/convert";
vi.mock("@/adapters/convert", () => ({ convert: vi.fn() }));
vi.mock("@/adapters/inspection", () => ({ inspectFile: vi.fn(async () => null) }));
const store = getDefaultStore();
const revoke = vi.fn();
const file = (name = "a.png") => new File(["content"], name, { type: "" });
beforeEach(() => {
  store.set(busyAtom, false);
  clearFiles();
  store.set(noticesAtom, []);
  vi.mocked(convert).mockReset();
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: revoke }),
  );
});
describe("queue controller", () => {
  it("rejects invalid imports and bounds the queue", () => {
    addFiles([file("file.pdf"), new File([], "empty.png")]);
    expect(store.get(entriesAtom)).toHaveLength(0);
    expect(store.get(noticesAtom).map((value) => value.code)).toEqual(["unsupported", "empty"]);
    const large = file();
    Object.defineProperty(large, "size", { value: 1_000_000_001 });
    addFiles([large]);
    expect(store.get(noticesAtom)[0]?.code).toBe("tooLarge");
    const largeImage = file();
    Object.defineProperty(largeImage, "size", { value: 100_000_001 });
    addFiles([largeImage]);
    expect(store.get(noticesAtom)[0]?.code).toBe("tooLarge");
    addFiles(Array.from({ length: 41 }, () => file()));
    expect(store.get(entriesAtom)).toHaveLength(40);
    expect(store.get(noticesAtom)[0]?.code).toBe("limit");
  });
  it("releases previews, respects busy guards and updates formats", () => {
    addFiles([file(), file("a.svg"), file("a.mp4"), file("a.mp3")]);
    const [image, svg] = store.get(entriesAtom);
    expect(svg?.preview).toBeNull();
    setFormat(image!.id, "jpg");
    expect(store.get(entriesAtom)[0]?.format).toBe("jpg");
    setSettings(image!.id, { ...DEFAULT_SETTINGS, quality: 30 });
    expect(store.get(entriesAtom)[0]?.settings.quality).toBe(30);
    store.set(busyAtom, true);
    removeFile(image!.id);
    clearFiles();
    setFormat(image!.id, "webp");
    setSettings(image!.id, DEFAULT_SETTINGS);
    expect(store.get(entriesAtom)).toHaveLength(4);
    expect(store.get(entriesAtom)[0]?.format).toBe("jpg");
    store.set(busyAtom, false);
    removeFile(image!.id);
    expect(revoke).toHaveBeenCalled();
    expect(store.get(entriesAtom)).toHaveLength(3);
    clearFiles();
    expect(store.get(entriesAtom)).toHaveLength(0);
  });
  it("converts sequentially, ignores repeated starts and finalizes only after encoding", async () => {
    addFiles([file(), file("b.wav")]);
    let release!: (blob: Blob) => void;
    vi.mocked(convert)
      .mockImplementationOnce(async (_request, _signal, onProgress, onEngine) => {
        onProgress(0.5);
        onProgress(0.6);
        onProgress(0.99);
        onEngine("compatibility");
        return new Promise((resolve) => {
          release = resolve;
        });
      })
      .mockResolvedValueOnce(new Blob(["second"]));
    const running = start();
    await start();
    expect(convert).toHaveBeenCalledTimes(1);
    expect(store.get(busyAtom)).toBe(true);
    expect(store.get(entriesAtom)[0]?.job.progress).toBe(0.99);
    expect(store.get(entriesAtom)[0]?.engine).toBe("compatibility");
    release(new Blob(["first"]));
    await running;
    expect(convert).toHaveBeenCalledTimes(2);
    expect(store.get(entriesAtom).every((entry) => entry.job.status === "done")).toBe(true);
    expect(store.get(busyAtom)).toBe(false);
    await start();
    expect(convert).toHaveBeenCalledTimes(2);
  });
  it("contains errors per file and supports selected retries", async () => {
    addFiles([file(), file("b.png")]);
    vi.mocked(convert)
      .mockRejectedValueOnce(new ConversionError("decode"))
      .mockRejectedValueOnce(new Error("unknown"));
    await start();
    expect(store.get(entriesAtom).map((entry) => entry.error)).toEqual(["decode", "unknown"]);
    const id = store.get(entriesAtom)[0]!.id;
    vi.mocked(convert).mockResolvedValue(new Blob(["ok"]));
    await start([id]);
    expect(store.get(entriesAtom).map((entry) => entry.job.status)).toEqual(["done", "error"]);
  });
  it("cancels the active worker and leaves waiting files ready", async () => {
    addFiles([file(), file("b.png")]);
    vi.mocked(convert).mockImplementation(
      (_request, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const running = start();
    cancel();
    await running;
    expect(store.get(entriesAtom).map((entry) => entry.job.status)).toEqual(["canceled", "ready"]);
    expect(store.get(busyAtom)).toBe(false);
    cancel();
  });
  it("downloads only completed results and creates ZIPs without duplicate paths", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    addFiles([file(), file()]);
    download(store.get(entriesAtom)[0]!);
    expect(click).not.toHaveBeenCalled();
    await downloadAll();
    vi.mocked(convert).mockResolvedValue(new Blob(["png"]));
    await start([store.get(entriesAtom)[0]!.id]);
    download(store.get(entriesAtom)[0]!);
    await downloadAll();
    expect(click).toHaveBeenCalledTimes(2);
  });
});
