import type { FormatId, MediaKind, Settings } from "@converta/core";
export type ConvertRequest = {
  version: 1;
  id: string;
  file: File;
  kind: MediaKind;
  format: FormatId;
  settings: Settings;
};
export type ConvertResponse = { version: 1; id: string } & (
  | { type: "progress"; progress: number }
  | { type: "done"; blob: Blob; width?: number; height?: number }
  | { type: "error"; code: string }
);
