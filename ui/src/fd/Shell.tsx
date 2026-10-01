import type { MouseEvent, ReactNode } from "react";
import { LANDMARKS, hashFor, type Landmark } from "./route";
import "./fd.css";

export interface ShellProps {
  current: Landmark;
  onNavigate: (l: Landmark) => void;
  boards: { id: string; title: string }[];
  children: ReactNode;
}

export function Shell({ current, onNavigate, boards, children }: ShellProps) {
  const handleLandmarkClick =
    (landmark: Landmark) => (event: MouseEvent<HTMLAnchorElement>) => {
      // Only a plain left click is intercepted; modified clicks keep
      // their native behaviour (new tab, download, and so on).
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      onNavigate(landmark);
    };

  return (
    <>
      <a className="fd-skip" href="#main">
        Skip to main content
      </a>
      <header className="fd-header">
        <span className="fd-header-brand">Worlds</span>
      </header>
      <nav className="fd-nav" aria-label="Main">
        <ul className="fd-nav-landmarks">
          {LANDMARKS.map((landmark) => (
            <li key={landmark.id}>
              <a
                href={hashFor(landmark.id)}
                aria-current={landmark.id === current ? "page" : undefined}
                onClick={handleLandmarkClick(landmark.id)}
              >
                {landmark.label}
              </a>
            </li>
          ))}
        </ul>
        <ul className="fd-nav-boards">
          {boards.map((board) => (
            <li key={board.id}>
              <a href={`#board/${board.id}`}>{board.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="fd-main" id="main" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
