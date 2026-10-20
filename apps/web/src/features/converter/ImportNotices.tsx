import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { AnimatePresence, m } from "motion/react";
import { X } from "lucide-react";
import { IconButton } from "@/components/controls";
import { noticesAtom } from "./store";
export function ImportNotices() {
  const { t } = useTranslation();
  const [notices, setNotices] = useAtom(noticesAtom);
  return (
    <AnimatePresence initial={false}>
      {notices.map((notice) => (
        <m.div
          key={notice.id}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="import-notice"
          role="alert"
        >
          <span>
            {t("importError", {
              name: notice.name,
              reason: notice.code === "limit" ? t("limit") : t(`errors.${notice.code}`),
            })}
          </span>
          <IconButton
            label={t("close")}
            size="icon-sm"
            onClick={() => setNotices((values) => values.filter((value) => value.id !== notice.id))}
          >
            <X size={14} />
          </IconButton>
        </m.div>
      ))}
    </AnimatePresence>
  );
}
