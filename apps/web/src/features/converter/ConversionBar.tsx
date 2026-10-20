import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { ArrowRight, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/controls";
import { busyAtom, clearFiles, cancel, start, type Entry } from "./store";
import { DownloadButton } from "./DownloadButton";
export function ConversionBar({ entries }: { entries: Entry[] }) {
  const { t } = useTranslation();
  const busy = useAtomValue(busyAtom);
  const pending = entries.filter((entry) => entry.job.status !== "done").length;
  const done = entries.length - pending;
  return (
    <div className="conversion-bar">
      {pending > 0 && (
        <IconButton label={t("clear")} disabled={busy} onClick={clearFiles}>
          <Trash2 size={17} />
        </IconButton>
      )}
      <span className="conversion-count" aria-live="polite">
        {done > 0 ? t("converted", { done, total: entries.length }) : ""}
      </span>
      <div className={`conversion-actions ${pending === 0 ? "is-complete" : ""}`}>
        {pending === 0 && !busy && (
          <Button variant="secondary" size="lg" onClick={clearFiles}>
            {t("resetFiles")}
          </Button>
        )}
        {done > 0 && <DownloadButton secondary={pending > 0} />}
        {busy ? (
          <Button variant="outline" size="lg" onClick={cancel}>
            <Square size={13} />
            {t("cancel")}
          </Button>
        ) : (
          pending > 0 && (
            <Button
              size="lg"
              aria-label={t("convertCount", { count: pending })}
              onClick={() => {
                void start();
              }}
            >
              {t("convert")}
              <ArrowRight size={16} />
            </Button>
          )
        )}
      </div>
    </div>
  );
}
