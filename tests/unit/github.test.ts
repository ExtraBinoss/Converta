import { beforeEach, it, expect, vi } from "vitest";
import { githubStars } from "@/adapters/github";
const signal = () => new AbortController().signal;
beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ stargazers_count: 1234 }) })),
  );
});
it("fetches the public counter without credentials and caches it", async () => {
  expect(await githubStars(signal())).toBe(1234);
  expect(await githubStars(signal())).toBe(1234);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
});
it("keeps an expired counter when GitHub is unreachable and ignores invalid data", async () => {
  sessionStorage.setItem("converta.github-stars", JSON.stringify({ count: 5, time: 0 }));
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
  expect(await githubStars(signal())).toBe(5);
  sessionStorage.clear();
  vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
  expect(await githubStars(signal())).toBeNull();
  for (const stargazers_count of [-1, 1.2, "9", null]) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stargazers_count }),
    } as Response);
    expect(await githubStars(signal())).toBeNull();
  }
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => null } as Response);
  expect(await githubStars(signal())).toBeNull();
});
it("works with corrupt or unavailable storage and caches a genuine zero", async () => {
  sessionStorage.setItem("converta.github-stars", "invalid");
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ stargazers_count: 0 }),
  } as Response);
  expect(await githubStars(signal())).toBe(0);
  sessionStorage.setItem(
    "converta.github-stars",
    JSON.stringify({ count: "oops", time: Date.now() }),
  );
  expect(await githubStars(signal())).toBe(1234);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(await githubStars(signal())).toBe(1234);
});
