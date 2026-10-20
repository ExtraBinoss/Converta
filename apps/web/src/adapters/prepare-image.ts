import { ConversionError, extension } from "@converta/core";

export async function prepareImage(file: File): Promise<File> {
  const ext = extension(file.name);
  if (ext === "heic" || ext === "heif") {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({ blob: file, toType: "image/png" });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob) throw new ConversionError("decode");
    return new File([blob], "decoded.png", { type: "image/png" });
  }
  if (ext !== "svg" && file.type !== "image/svg+xml") return file;
  const text = await file.text();
  const xml = new DOMParser().parseFromString(text, "image/svg+xml");
  if (
    xml.querySelector("parsererror, script, foreignObject") ||
    xml.documentElement.localName !== "svg"
  )
    throw new ConversionError("svg");
  for (const node of xml.querySelectorAll("*")) {
    for (const attribute of node.attributes) {
      if (
        /^on/i.test(attribute.name) ||
        ((attribute.localName === "href" || attribute.name === "src") &&
          !attribute.value.startsWith("#")) ||
        /url\(\s*["']?\s*(?!#)[^)]/i.test(attribute.value)
      )
        throw new ConversionError("svg");
    }
  }
  if (
    /(@import|url\(\s*["']?\s*(?!#))|<!ENTITY/i.test(xml.querySelector("style")?.textContent ?? "")
  )
    throw new ConversionError("svg");
  const root = xml.documentElement;
  const viewBox = root
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = parseFloat(root.getAttribute("width") ?? "") || viewBox?.[2] || 1024;
  const height = parseFloat(root.getAttribute("height") ?? "") || viewBox?.[3] || 1024;
  if (!Number.isFinite(width * height) || width < 1 || height < 1 || width * height > 80_000_000)
    throw new ConversionError("tooLarge");
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(xml)], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new ConversionError("encode");
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new ConversionError("encode"))),
        "image/png",
      ),
    );
    return new File([blob], "decoded.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
