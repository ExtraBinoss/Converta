import { it, expect, vi } from "vitest";
import { savedTheme, applyTheme } from "@/app/theme";
it("resolves system preferences and survives blocked browser storage", () => {
  localStorage.clear();
  expect(savedTheme()).toBe("system");
  localStorage.setItem("converta.theme", "dark");
  expect(savedTheme()).toBe("dark");
  localStorage.setItem("converta.theme", "light");
  expect(savedTheme()).toBe("light");
  localStorage.setItem("converta.theme", "bad");
  expect(savedTheme()).toBe("system");
  applyTheme("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  applyTheme("light");
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  applyTheme("system");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(savedTheme()).toBe("system");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(() => applyTheme("dark")).not.toThrow();
});
