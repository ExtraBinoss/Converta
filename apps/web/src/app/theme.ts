export type Theme = "light" | "dark" | "system";
export function savedTheme(): Theme {
  try {
    const value = localStorage.getItem("converta.theme");
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches),
  );
  try {
    localStorage.setItem("converta.theme", theme);
  } catch {
    /* Preferences are optional. */
  }
}
