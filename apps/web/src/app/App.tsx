import { AppFooter, Wordmark } from "./Chrome";
import { ImportNotices } from "@/features/converter/ImportNotices";
import { ConversionBar } from "@/features/converter/ConversionBar";
import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { AnimatePresence, m } from "motion/react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/controls";
import { FileList } from "@/features/converter/FileList";
import { ScrollShadows } from "@/components/ScrollShadows";
import { entriesAtom, busyAtom, addFiles } from "@/features/converter/store";
import { GitHubLink } from "@/components/GitHubLink";

export function App() {
  const { t } = useTranslation();
  const entries = useAtomValue(entriesAtom);
  const busy = useAtomValue(busyAtom);
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const choose = () => input.current?.click();
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "o") {
        event.preventDefault();
        input.current?.click();
      }
    };
    const paste = (event: ClipboardEvent) => {
      if (event.clipboardData?.files.length) addFiles(Array.from(event.clipboardData.files));
    };
    window.addEventListener("keydown", key);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("paste", paste);
    };
  }, []);
  return (
    <div
      className={`app ${dragging ? "is-dragging" : ""}`}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <main className={`workspace ${entries.length ? "has-files" : ""}`}>
        <div className="workspace-brand">
          <h1 className="sr-only">Converta</h1>
          <Wordmark />
          <GitHubLink />
        </div>
        {entries.length > 0 && (
          <div className="workspace-toolbar">
            <span>{t("fileCount", { count: entries.length })}</span>
            <IconButton label={t("add")} onClick={choose} className="add-button">
              <Plus size={19} />
            </IconButton>
          </div>
        )}
        <input
          className="sr-only"
          aria-label={t("choose")}
          type="file"
          multiple
          ref={input}
          accept="image/*,video/*,audio/*,.heic,.heif,.tif,.tiff,.mkv,.ts,.mts,.avi,.flac,.m4a,.aiff"
          onChange={(event) => {
            if (event.target.files) addFiles(Array.from(event.target.files));
            event.target.value = "";
          }}
        />
        <ScrollShadows className="notices-surface">
          <div className="notices" data-scroll-viewport="">
            <ImportNotices />
          </div>
        </ScrollShadows>
        {entries.length > 0 ? (
          <section className="file-workspace" aria-label={t("files")}>
            <FileList entries={entries} busy={busy} />
            <ConversionBar entries={entries} />
          </section>
        ) : (
          <section className="dropzone" aria-label={t("drop")}>
            <Upload size={30} strokeWidth={1.3} className="drop-icon" aria-hidden="true" />
            <h2>{t("drop")}</h2>
            <p>{t("intro")}</p>
            <Button onClick={choose} size="lg">
              <Plus size={16} />
              {t("choose")}
            </Button>
            <span className="keyboard-hint">
              <kbd>{/Mac/.test(navigator.platform) ? "⌘" : "Ctrl"}</kbd>
              <span>+</span>
              <kbd>O</kbd>
            </span>
          </section>
        )}
      </main>
      <AppFooter />
      <AnimatePresence>
        {dragging && (
          <m.div
            className="drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Upload size={36} />
            <h2>{t("dropNow")}</h2>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
