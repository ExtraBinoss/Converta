import { useId, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Files, ChevronDown, LoaderCircle } from "lucide-react";
import { MarqueeText } from "@/components/MarqueeText";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { downloadAll, type DownloadMode } from "./store";
const mobileQuery = "(max-width: 600px), (hover: none) and (pointer: coarse)";
function subscribeMobile(notify: () => void) {
  const query = matchMedia(mobileQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
function isMobile() {
  return matchMedia(mobileQuery).matches;
}
export function DownloadButton({ secondary = false }: { secondary?: boolean }) {
  const { t } = useTranslation();
  const mobile = useSyncExternalStore(subscribeMobile, isMobile);
  const [chosenMode, setMode] = useState<DownloadMode | null>(null);
  const mode = chosenMode ?? (mobile ? "individual" : "zip");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const description = useId();
  const variant = secondary ? "outline" : "default";
  async function save() {
    setSaving(true);
    setError(false);
    try {
      await downloadAll(mode);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="download-control">
      <ButtonGroup
        className={`download-split ${secondary ? "is-secondary" : ""}`}
        aria-label={t("downloadAll")}
      >
        <Button
          variant={variant}
          size="lg"
          className="download-main"
          disabled={saving}
          aria-label={t("downloadAll")}
          aria-describedby={description}
          onClick={() => {
            void save();
          }}
        >
          {saving ? <LoaderCircle className="spinner" /> : mode === "zip" ? <Archive /> : <Files />}
          <MarqueeText as="span" className="download-label">
            {saving ? t(mode === "zip" ? "zip" : "saving") : t("downloadAll")}
          </MarqueeText>
        </Button>
        <ButtonGroupSeparator className="download-divider" />
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      variant={variant}
                      size="lg"
                      className="download-options-trigger"
                      disabled={saving}
                      aria-label={t("downloadOptions")}
                    />
                  }
                />
              }
            >
              <ChevronDown size={15} />
            </TooltipTrigger>
            <TooltipContent>{t("downloadOptions")}</TooltipContent>
          </Tooltip>
          <PopoverContent side="top" align="end" sideOffset={8} className="download-mode-popover">
            <PopoverTitle className="sr-only">{t("downloadOptions")}</PopoverTitle>
            <RadioGroup
              value={mode}
              aria-label={t("downloadOptions")}
              className="download-mode-options"
              onValueChange={(value) => {
                if (value === "individual" || value === "zip") {
                  setMode(value);
                  setOpen(false);
                }
              }}
            >
              {(
                [
                  { value: "individual", label: t("separateFiles"), Icon: Files },
                  { value: "zip", label: t("zipArchive"), Icon: Archive },
                ] as const
              ).map(({ value, label, Icon }) => (
                <label key={value} className="download-mode-option">
                  <Icon size={16} />
                  <span>{label}</span>
                  <RadioGroupItem value={value} aria-label={label} />
                </label>
              ))}
            </RadioGroup>
          </PopoverContent>
        </Popover>
      </ButtonGroup>
      <span id={description} className="sr-only">
        {t(mode === "zip" ? "zipArchive" : "separateFiles")}
      </span>
      {error && (
        <p role="alert" className="download-error">
          {t("errors.download")}
        </p>
      )}
    </div>
  );
}
