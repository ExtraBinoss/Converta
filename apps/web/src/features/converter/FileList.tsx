import { memo, useCallback, useMemo, useState, type FocusEvent } from "react";
import { VList } from "virtua";
import { useTranslation } from "react-i18next";
import { ScrollShadows } from "@/components/ScrollShadows";
import { FileRow } from "./FileRow";
import type { Entry } from "./store";
export const FileList = memo(function FileList({
  entries,
  busy,
}: {
  entries: Entry[];
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const pin = useCallback(
    (id: string, open: boolean) =>
      setOpenId((current) => (open ? id : current === id ? null : current)),
    [],
  );
  const focus = useCallback((event: FocusEvent) => {
    setFocusId(
      (event.target as HTMLElement).closest<HTMLElement>("[data-entry-id]")?.dataset.entryId ??
        null,
    );
  }, []);
  const blur = useCallback((event: FocusEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusId(null);
  }, []);
  const keepMounted = useMemo(
    () => [
      ...new Set(
        [openId, focusId]
          .map((id) => entries.findIndex((entry) => entry.id === id))
          .filter((index) => index >= 0),
      ),
    ],
    [entries, openId, focusId],
  );
  const total = entries.length;
  const renderRow = useCallback(
    (entry: Entry, index: number) => (
      <FileRow
        key={entry.id}
        entry={entry}
        busy={busy}
        index={index}
        total={total}
        onOpenChange={pin}
      />
    ),
    [busy, total, pin],
  );
  return (
    <ScrollShadows className="file-list-surface">
      <VList
        className="file-list"
        data-scroll-viewport=""
        data-total-count={total}
        role="list"
        aria-label={t("files")}
        tabIndex={0}
        data={entries}
        keepMounted={keepMounted}
        onFocusCapture={focus}
        onBlurCapture={blur}
      >
        {renderRow}
      </VList>
    </ScrollShadows>
  );
});
