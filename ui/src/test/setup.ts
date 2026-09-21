import "@testing-library/jest-dom/vitest";

// jsdom provides localStorage; ensure window.location is writable for
// api.ts. Give it a real origin: openapi-fetch builds Request("/api/…")
// relative to location, and an empty href would throw "Failed to parse
// URL" in every fetch-level test. The 401-redirect tests assert on href.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "location", {
    value: { href: "http://station.test/" },
    writable: true,
  });
}
