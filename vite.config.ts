import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "apps/web",
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      "mediabunny",
      "@mediabunny/aac-encoder",
      "@mediabunny/mp3-encoder",
      "@mediabunny/flac-encoder",
      "@ffmpeg/ffmpeg",
      "heic2any",
      "utif",
      "gifenc",
      "fflate",
      "@jsquash/avif/codec/enc/avif_enc.js",
      "@jsquash/avif/meta.js",
      "@jsquash/avif/decode.js",
    ],
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) } },
  build: { outDir: "../../dist", emptyOutDir: true },
  server: {
    port: 5500,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    port: 5501,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
