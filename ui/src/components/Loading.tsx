/**
 * A calm sign that something is working (owner's walk-through,
 * 2026-09-27: a plain line for 4–5 seconds looked stuck). The words are
 * the status (read by screen readers); the placeholder cards beside them
 * are decoration. They pulse softly only where motion is allowed; with
 * reduced motion they hold still.
 */
export function Loading({ words, cards = 4, minWidth = 180 }: { words: string; cards?: number; minWidth?: number }) {
  return (
    <div className="flex flex-col gap-[var(--pw-spacing-md)]">
      <p role="status" className="flex items-center gap-[var(--pw-spacing-sm)] text-[length:var(--pw-typography-size_small)] text-[var(--pw-text-secondary)]">
        <span aria-hidden="true" className="pw-loading-dot" />
        {words}
      </p>
      <ul aria-hidden="true" className="grid gap-[var(--pw-spacing-md)]" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}>
        {Array.from({ length: cards }, (_, i) => (
          <li key={i} className="pw-skeleton" style={{ animationDelay: `${i * 120}ms` }}>
            <span className="pw-skeleton-line w-3/4" />
            <span className="pw-skeleton-line w-1/2" />
            <span className="pw-skeleton-line w-2/3" />
          </li>
        ))}
      </ul>
    </div>
  );
}
