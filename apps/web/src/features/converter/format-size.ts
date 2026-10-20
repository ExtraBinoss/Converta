const formatters = new Map<string, Intl.NumberFormat>();
function formatter(language: string, type: "megabyte" | "kilobyte" | "percent"): Intl.NumberFormat {
  const key = `${language}:${type}`;
  let value = formatters.get(key);
  if (!value) {
    value = new Intl.NumberFormat(
      language,
      type === "percent"
        ? { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }
        : { style: "unit", unit: type, maximumFractionDigits: 1 },
    );
    formatters.set(key, value);
  }
  return value;
}
export function bytes(value: number, language: string): string {
  const large = value >= 1_000_000;
  return formatter(language, large ? "megabyte" : "kilobyte").format(
    value / (large ? 1_000_000 : 1_000),
  );
}
export function percentage(value: number, language: string): string {
  return formatter(language, "percent").format(value);
}
