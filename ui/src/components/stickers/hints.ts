/**
 * Book Girl's softer clues for Worlds' riddles (one a day, only when asked;
 * never for a secret). A riddle without its own clue gets a gentle pointer
 * to its page.
 */
export const RIDDLE_HINTS: Record<string, string> = {
  pocket: "Try the Share button on your phone, the one you use to send a link to someone.",
  "changed-mind": "After you answer a room’s card, look for a way to take it back.",
  "outside-door": "A notification or a link can open a room for you, without the Bridge.",
  "one-more-door": "Look closely at the Bridge map once you’ve found a dozen stickers.",
  "cover-to-cover": "Open any book in the Library and keep going until there’s nothing left to read.",
  "two-voices": "When you meet a word in one app, see if another app knows it too.",
  "second-draft": "In your journal, an entry can be corrected without losing the first one.",
  "time-traveller": "A corrected journal entry keeps its history. Have a look at it.",
  "quiet-hours": "Notifications have a time when they stay silent. Settings is a good place to look.",
  "in-the-dark": "Some screens are gentler with the lights down.",
  "ask-a-room": "Inside a room’s drawer, there’s a way to ask about it in Chat.",
};

export function hintFor(id: string, section?: string): string {
  return RIDDLE_HINTS[id] ?? `It’s on the ${section ?? "same"} page. Try the things there you haven’t tried yet.`;
}

const DAY = "pw-sticker-hint-day";
export function hintUsedToday(now = new Date()): boolean {
  try {
    return window.localStorage.getItem(DAY) === now.toDateString();
  } catch {
    return false;
  }
}
export function markHintUsed(now = new Date()): void {
  try {
    window.localStorage.setItem(DAY, now.toDateString());
  } catch {
    /* storage blocked: the hint may be offered again */
  }
}
