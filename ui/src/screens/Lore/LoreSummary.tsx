/**
 * One line and one button to "Your lore", for Memory and Settings: how
 * much is confirmed, how much is waiting, and the way in.
 */
import { useLore } from "../../data/hooks";
import { WorldButton } from "../../components/WorldButton";

export function LoreSummary({ onOpen }: { onOpen: () => void }) {
  const lore = useLore();
  const items = lore.data?.data?.items ?? [];
  const waiting = items.filter((i) => i.state === "suggested" && !i.gone).length;
  const confirmed = items.filter((i) => i.state === "confirmed" && !i.gone).length;
  const words = lore.isPending
    ? "Reading your lore…"
    : lore.isError
      ? "Your lore couldn’t be read just now."
      : items.length === 0
        ? "Your lore: nothing brought in yet."
        : `Your lore: ${confirmed} confirmed · ${waiting} waiting for you`;
  return (
    <div className="flex flex-wrap items-center gap-[var(--pw-spacing-md)] rounded-[var(--pw-radius-md)] border border-[var(--pw-border-subtle)] bg-[var(--pw-surface-panel)] p-[var(--pw-spacing-md)]">
      <p className="min-w-[12rem] flex-1 text-[length:var(--pw-typography-size_body)] text-[var(--pw-text-primary)]">
        {waiting > 0 ? <span aria-hidden="true" className="mr-[var(--pw-spacing-sm)] inline-block h-2 w-2 rounded-full bg-[var(--pw-accent-warm)] align-middle" /> : null}
        {words}
      </p>
      <WorldButton variant={waiting > 0 ? "primary" : "secondary"} onPress={onOpen}>
        Open your lore
      </WorldButton>
    </div>
  );
}
