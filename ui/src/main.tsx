import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { QueryProvider } from "./app/QueryProvider";
import { registerServiceWorker } from "./data/push-client";
// CSS order is load-bearing: Tailwind first (preflight may be overridden),
// then generated tokens, then world.css so base styles win last.
import "./index.css";
import "./generated/tokens.css";
import "./styles/world.css";

// The push service worker: registered on load, https or localhost only
// (browsers refuse a worker over plain http elsewhere, and push-client
// checks that). It shows notifications and nothing else — the Settings
// screen is where a device turns itself on.
void registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
