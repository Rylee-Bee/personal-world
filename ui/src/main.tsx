import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FdApp } from "./fd/FdApp";
import { PrefsProvider } from "./fd/prefs";
import { QueryProvider } from "./app/QueryProvider";
// CSS order is load-bearing: Tailwind first (preflight may be overridden),
// then generated tokens, then world.css so base styles win last.
import "./index.css";
import "./generated/tokens.css";
import "./styles/world.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <PrefsProvider>
        <FdApp />
      </PrefsProvider>
    </QueryProvider>
  </StrictMode>,
);
