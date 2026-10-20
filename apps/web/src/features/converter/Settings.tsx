import { MarqueeText } from "@/components/MarqueeText";
import { useState, useEffect, useId } from "react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, Sun, Moon, Monitor, RotateCcw } from "lucide-react";
import { DEFAULT_SETTINGS, getFormat, type Settings } from "@converta/core";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { IconButton, Choice } from "@/components/controls";
import { savedTheme, applyTheme, type Theme } from "@/app/theme";
import { busyAtom, setSettings, type Entry } from "./store";

function QualityControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="setting">
      <div className="setting-label">
        <label htmlFor={id}>{label}</label>
        <div className="quality-value">
          <Input
            id={id}
            aria-label={label}
            inputMode="numeric"
            value={draft ?? String(value)}
            onFocus={() => setDraft(String(value))}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              const parsed = Number(draft);
              if (draft?.trim() && Number.isFinite(parsed))
                onChange(Math.max(10, Math.min(100, Math.round(parsed))));
              setDraft(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <span className="muted">%</span>
        </div>
      </div>
      <Slider
        aria-label={label}
        min={10}
        max={100}
        step={1}
        value={[value]}
        onValueChange={(value) => onChange(Array.isArray(value) ? value[0]! : value)}
      />
      <div className="quality-scale">
        <span>{t("smaller")}</span>
        <span>{t("better")}</span>
      </div>
    </div>
  );
}
export function ConversionSettings({
  entry,
  onOpenChange,
}: {
  entry: Entry;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const busy = useAtomValue(busyAtom);
  const { settings } = entry;
  const kind = getFormat(entry.format).kind;
  const muteId = useId();
  const monoId = useId();
  const changed = JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS);
  const update = (patch: Partial<Settings>) => setSettings(entry.id, { ...settings, ...patch });
  const sizes = [
    { value: "0", label: t("original") },
    ...[3840, 2560, 1920, 1280, 800, 512, 256].map((value) => ({
      value: String(value),
      label: `${value} px`,
    })),
  ];
  return (
    <Popover onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="settings-trigger"
                  disabled={busy}
                  aria-label={t("settingsFor", { name: entry.file.name })}
                />
              }
            />
          }
        >
          <SlidersHorizontal size={17} />
          {changed && <span className="settings-dot" />}
        </TooltipTrigger>
        <TooltipContent>{t("settings")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="settings-popover">
        <div className="popover-heading">
          <PopoverTitle>{t("settings")}</PopoverTitle>
          <IconButton
            label={t("reset")}
            size="icon-sm"
            onClick={() => setSettings(entry.id, { ...DEFAULT_SETTINGS })}
          >
            <RotateCcw size={14} />
          </IconButton>
        </div>
        <MarqueeText className="settings-filename">{entry.file.name}</MarqueeText>
        {kind === "image" && (
          <>
            {["jpg", "webp", "avif"].includes(entry.format) && (
              <QualityControl
                label={t("quality")}
                value={settings.quality}
                onChange={(quality) => update({ quality })}
              />
            )}
            <div className="setting">
              <span className="setting-title">{t("maxEdge")}</span>
              <Choice
                value={String(settings.maxEdge)}
                label={t("maxEdge")}
                onChange={(value) => update({ maxEdge: Number(value) })}
                options={sizes}
                className="size-select"
              />
            </div>
          </>
        )}
        {kind === "video" && (
          <>
            <QualityControl
              label={t("videoQuality")}
              value={settings.videoQuality}
              onChange={(videoQuality) => update({ videoQuality })}
            />
            <div className="setting">
              <span className="setting-title">{t("maxEdge")}</span>
              <Choice
                value={String(settings.videoMaxEdge)}
                label={t("maxEdge")}
                onChange={(value) => update({ videoMaxEdge: Number(value) })}
                options={sizes}
                className="size-select"
              />
            </div>
            <div className="setting">
              <span className="setting-title">{t("frameRate")}</span>
              <Choice
                value={String(settings.frameRate)}
                label={t("frameRate")}
                onChange={(value) => update({ frameRate: Number(value) })}
                options={[
                  { value: "0", label: t("original") },
                  ...[24, 25, 30, 60].map((value) => ({
                    value: String(value),
                    label: `${value} ${t("fps")}`,
                  })),
                ]}
                className="size-select"
              />
            </div>
            <div className="setting-inline">
              <label htmlFor={muteId}>{t("mute")}</label>
              <Switch
                id={muteId}
                checked={settings.mute}
                onCheckedChange={(mute) => update({ mute })}
              />
            </div>
          </>
        )}
        {kind === "audio" && (
          <>
            {!["wav", "flac"].includes(entry.format) && (
              <div className="setting">
                <span className="setting-title">{t("audioBitrate")}</span>
                <Choice
                  value={String(settings.audioBitrate)}
                  label={t("audioBitrate")}
                  onChange={(value) => update({ audioBitrate: Number(value) })}
                  options={[64, 96, 128, 192, 256, 320].map((value) => ({
                    value: String(value),
                    label: `${value} kb/s`,
                  }))}
                  className="size-select"
                />
              </div>
            )}
            <div className="setting-inline">
              <label htmlFor={monoId}>{t("mono")}</label>
              <Switch
                id={monoId}
                checked={settings.mono}
                onCheckedChange={(mono) => update({ mono })}
              />
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
export function Preferences() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(savedTheme);
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(theme);
    sync();
    system.addEventListener("change", sync);
    return () => system.removeEventListener("change", sync);
  }, [theme]);
  return (
    <div className="preferences-controls">
      <Choice
        label={t("language")}
        value={i18n.language}
        displayValue={i18n.language.toUpperCase()}
        options={[
          { value: "fr", label: "Français" },
          { value: "en", label: "English" },
        ]}
        onChange={(language) => {
          void i18n.changeLanguage(language);
        }}
        className="language-select"
      />
      <ToggleGroup
        value={[theme]}
        aria-label={t("theme")}
        className="theme-options"
        onValueChange={(values) => {
          const value = values[0];
          if (value === "light" || value === "dark" || value === "system") setTheme(value);
        }}
      >
        {(
          [
            { value: "light", label: t("light"), Icon: Sun },
            { value: "dark", label: t("dark"), Icon: Moon },
            { value: "system", label: t("system"), Icon: Monitor },
          ] as const
        ).map(({ value, label, Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger render={<ToggleGroupItem value={value} aria-label={label} />}>
              <Icon size={15} />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </div>
  );
}
