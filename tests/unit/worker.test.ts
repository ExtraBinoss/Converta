import { it, expect, vi } from "vitest";
import { DEFAULT_SETTINGS, ConversionError } from "@converta/core";
import type { ConvertRequest } from "@/adapters/protocol";
import { convertImage } from "@/adapters/images";
import { convertMedia } from "@/adapters/media";
vi.mock("@/adapters/images", () => ({
  convertImage: vi.fn(async (_file, _format, _settings, progress) => {
    progress(0.5);
    return new Blob(["encoded"]);
  }),
}));
vi.mock("@/adapters/media", () => ({ convertMedia: vi.fn(async () => new Blob(["media"])) }));
it("dispatches the versioned protocol and reports all failures", async () => {
  const scope = {
    onmessage: null as null | ((event: { data: ConvertRequest }) => Promise<void>),
    postMessage: vi.fn(),
  };
  vi.stubGlobal("self", scope);
  await import("@/adapters/conversion.worker");
  const data: ConvertRequest = {
    version: 1,
    id: "a",
    file: new File(["a"], "a.png"),
    kind: "image",
    format: "png",
    settings: DEFAULT_SETTINGS,
  };
  await scope.onmessage!({ data });
  expect(scope.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ id: "a", type: "done" }),
  );
  expect(scope.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: "progress", progress: 0.5 }),
  );
  await scope.onmessage!({ data: { ...data, kind: "video", format: "mp4" } });
  expect(convertMedia).toHaveBeenCalled();
  vi.mocked(convertImage).mockRejectedValueOnce(new ConversionError("encode"));
  await scope.onmessage!({ data });
  expect(scope.postMessage).toHaveBeenLastCalledWith({
    version: 1,
    id: "a",
    type: "error",
    code: "encode",
  });
  vi.mocked(convertImage).mockRejectedValueOnce(new Error("internal"));
  await scope.onmessage!({ data });
  expect(scope.postMessage).toHaveBeenLastCalledWith({
    version: 1,
    id: "a",
    type: "error",
    code: "decode",
  });
});
