export const GITHUB_REPOSITORY = "https://github.com/ExtraBinoss/Converta";
const key = "converta.github-stars";
const lifetime = 10 * 60 * 1000;
export async function githubStars(signal: AbortSignal): Promise<number | null> {
  let cached: number | null = null;
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (
      value &&
      typeof value === "object" &&
      "count" in value &&
      "time" in value &&
      Number.isSafeInteger(value.count) &&
      Number(value.count) >= 0 &&
      typeof value.time === "number"
    ) {
      cached = Number(value.count);
      if (Date.now() - value.time < lifetime && value.time <= Date.now()) return cached;
    }
  } catch {
    /* Storage is optional. */
  }
  try {
    const response = await fetch("https://api.github.com/repos/ExtraBinoss/Converta", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return cached;
    const value: unknown = await response.json();
    if (
      !value ||
      typeof value !== "object" ||
      !("stargazers_count" in value) ||
      !Number.isSafeInteger(value.stargazers_count) ||
      Number(value.stargazers_count) < 0
    )
      return cached;
    const count = Number(value.stargazers_count);
    try {
      sessionStorage.setItem(key, JSON.stringify({ count, time: Date.now() }));
    } catch {
      /* Storage is optional. */
    }
    return count;
  } catch {
    return cached;
  }
}
