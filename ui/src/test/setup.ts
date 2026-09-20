import "@testing-library/jest-dom/vitest";

// jsdom provides localStorage; ensure window.location is writable for api.ts
if (typeof window !== "undefined") {
  Object.defineProperty(window, "location", {
    value: { href: "" },
    writable: true,
  });
}
