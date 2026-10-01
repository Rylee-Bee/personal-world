import type { Board, Size } from "./types";

/**
 * Edit Home overlay: the owner's order, visibility and sizes on top of the served board. Pure data; the
 * server board is never mutated. (Persisting to the board config arrives with the board write API.)
 */
export interface Edits {
  /** Card ids in the owner's order. Cards not listed keep board order after the listed ones. */
  order: string[];
  /** Per-card visibility override: false = hidden by the owner, true = shown although the board hides it. */
  visible: Record<string, boolean>;
  sizes: Record<string, Size>;
}
export const NO_EDITS: Edits = { order: [], visible: {}, sizes: {} };

export const isEdited = (e: Edits) => e.order.length > 0 || Object.keys(e.visible).length > 0 || Object.keys(e.sizes).length > 0;

/** The board as the owner arranged it: ordered, with visibility and sizes applied. */
export function applyEdits(board: Board, e: Edits): Board {
  const rank = new Map(e.order.map((id, i) => [id, i]));
  const items = board.items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (rank.get(a.item.card) ?? Infinity) - (rank.get(b.item.card) ?? Infinity) || a.i - b.i)
    .map(({ item }) => ({
      ...item,
      hidden: e.visible[item.card] === undefined ? item.hidden : !e.visible[item.card],
      size: e.sizes[item.card] ?? item.size,
    }));
  return { ...board, items };
}

/** Move a card one place earlier (-1) or later (+1) among `siblings` (the cards of its section, in order). */
export function move(board: Board, e: Edits, card: string, dir: -1 | 1, siblings: string[]): Edits {
  const at = siblings.indexOf(card);
  const other = siblings[at + dir];
  if (at < 0 || other === undefined) return e;
  const full = applyEdits(board, e).items.map((i) => i.card);
  const a = full.indexOf(card);
  const b = full.indexOf(other);
  [full[a], full[b]] = [full[b], full[a]];
  return { ...e, order: full };
}

export const setVisible = (e: Edits, card: string, visible: boolean): Edits => ({ ...e, visible: { ...e.visible, [card]: visible } });
export const setSize = (e: Edits, card: string, size: Size): Edits => ({ ...e, sizes: { ...e.sizes, [card]: size } });

const KEY = "worlds.home.edits.v1";
export function loadEdits(): Edits {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return NO_EDITS;
    const p = JSON.parse(raw) as Partial<Edits>;
    return { order: Array.isArray(p.order) ? p.order.filter((x) => typeof x === "string") : [], visible: p.visible ?? {}, sizes: p.sizes ?? {} };
  } catch {
    return NO_EDITS;
  }
}
export function saveEdits(e: Edits): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(e));
  } catch {
    /* storage unavailable: the arrangement lasts until reload */
  }
}
