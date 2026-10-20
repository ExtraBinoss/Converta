import { memo, type CSSProperties } from "react";
import { MarqueeText } from "@/components/MarqueeText";
import { bytes } from "./format-size";
import { useTranslation } from "react-i18next";
import { Image, Film, AudioLines, Download, X, RotateCcw, Check } from "lucide-react";
import { m } from "motion/react";
import { outputFormats, getFormat } from "@converta/core";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { ProgressRing } from "./ProgressRing";
import { Progress } from "@/components/ui/progress";
import { IconButton } from "@/components/controls";
import { ConversionSettings } from "./Settings";
import { setFormat, removeFile, download, start, type Entry } from "./store";
function duration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export const FileRow = memo(function FileRow({
  entry,
  busy,
  index,
  total,
  onOpenChange,
}: {
  entry: Entry;
  busy: boolean;
  index: number;
  total: number;
  onOpenChange: (id: string, open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const Icon = entry.kind === "image" ? Image : entry.kind === "video" ? Film : AudioLines;
  const formats = outputFormats(entry.kind);
  const { status } = entry.job;
  return (
    <m.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className={`file-row ${status === "error" ? "file-error" : ""}`}
      data-status={status}
      data-entry-id={entry.id}
      role="listitem"
      aria-setsize={total}
      aria-posinset={index + 1}
    >
      <div className={`file-preview preview-${entry.kind}`}>
        <Icon size={22} aria-hidden="true" />
        {entry.preview && (
          <img
            src={entry.preview}
            alt={t("previewFor", { name: entry.file.name })}
            onLoad={(event) => {
              event.currentTarget.style.display = "";
            }}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        {entry.kind === "video" && entry.preview && (
          <span className="video-badge">
            <Film size={11} />
          </span>
        )}
      </div>
      <div className="file-info">
        <MarqueeText className="file-name">{entry.file.name}</MarqueeText>
        <div className="file-meta">
          <span>{bytes(entry.file.size, i18n.language)}</span>
          {entry.metadata?.width && (
            <>
              <span>·</span>
              <span>
                {entry.metadata.width} × {entry.metadata.height}
              </span>
            </>
          )}
          {entry.metadata?.duration != null && Number.isFinite(entry.metadata.duration) && (
            <>
              <span>·</span>
              <span>{duration(entry.metadata.duration)}</span>
            </>
          )}
          {status === "done" && (
            <m.span
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="result-size"
            >
              <Check size={12} />
              {bytes(entry.result!.size, i18n.language)}
            </m.span>
          )}
        </div>
        {status === "error" && (
          <p className="file-error-message" role="alert">
            {t(`errors.${entry.error ?? "unknown"}`)}
          </p>
        )}
        {(status === "done" || status === "converting" || (busy && status !== "error")) && (
          <div className={`file-progress ${status === "done" ? "is-done" : ""}`}>
            <Progress
              value={status === "done" ? 100 : entry.job.progress * 100}
              style={
                { "--file-progress": status === "done" ? 1 : entry.job.progress } as CSSProperties
              }
              aria-label={`${t(status === "done" ? "done" : status === "converting" ? "converting" : "waiting")} ${entry.file.name}`}
            />
            <span className="progress-percentage" aria-hidden="true">
              {status === "done" ? 100 : Math.round(entry.job.progress * 100)} %
            </span>
          </div>
        )}
      </div>
      <div className="file-controls">
        <Select
          value={entry.format}
          onOpenChange={(open) => onOpenChange(entry.id, open)}
          disabled={busy}
          onValueChange={(value) => {
            const format = formats.find((format) => format.id === value);
            if (format) setFormat(entry.id, format.id);
          }}
        >
          <SelectTrigger
            className="format-select"
            aria-label={t("outputFor", { name: entry.file.name })}
          >
            <SelectValue>{getFormat(entry.format).label}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false}>
            {[entry.kind, ...(entry.kind === "video" ? ["audio" as const] : [])].map((kind) => (
              <SelectGroup key={kind}>
                {entry.kind === "video" && <SelectLabel>{t(kind)}</SelectLabel>}
                {formats
                  .filter((format) => format.kind === kind)
                  .map((format) => (
                    <SelectItem key={format.id} value={format.id}>
                      {format.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <ConversionSettings entry={entry} onOpenChange={(open) => onOpenChange(entry.id, open)} />
        <span className="file-result-action">
          {status === "done" ? (
            <IconButton
              label={`${t("download")} ${entry.file.name}`}
              onClick={() => download(entry)}
              className="download-button"
            >
              <Download size={17} />
            </IconButton>
          ) : status === "error" ? (
            <IconButton
              label={`${t("retry")} ${entry.file.name}`}
              disabled={busy}
              onClick={() => {
                void start([entry.id]);
              }}
            >
              <RotateCcw size={16} />
            </IconButton>
          ) : status === "converting" || busy ? (
            <ProgressRing
              progress={entry.job.progress}
              name={entry.file.name}
              waiting={status !== "converting"}
            />
          ) : null}
        </span>
      </div>
      <IconButton
        label={t("remove", { name: entry.file.name })}
        onClick={() => removeFile(entry.id)}
        disabled={busy}
        className="remove-file"
      >
        <X size={16} />
      </IconButton>
    </m.div>
  );
});
