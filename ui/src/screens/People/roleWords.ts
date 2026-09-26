/**
 * Roles said as what a person can do (owner-approved 2026-09-26). The
 * role id never appears on screen; these words are the product language.
 */
export interface RoleWords {
  label: string;
  detail: string;
}

const WORDS: Record<string, RoleWords> = {
  owner: { label: "Runs this World", detail: "Can do everything, including handing this World over." },
  admin: { label: "Helps run this World", detail: "Can add people and rooms, and can approve things." },
  member: { label: "Has their own space", detail: "Their own space, plus the rooms shared with everyone." },
  supervised: { label: "Has their own space, with limits", detail: "Their own space, within limits they can always see." },
  guest: { label: "Visiting", detail: "Only what's shared with them." },
};

export function roleWords(role: string | null | undefined): RoleWords {
  return WORDS[role ?? ""] ?? { label: "Not set yet", detail: "This person has no role yet, so they get the least." };
}

/** The roles an admin can give here, safest first. Owner is never in
 *  this list: ownership moves only by handing it over. */
export const ASSIGNABLE_ROLES = ["member", "admin", "supervised", "guest"] as const;

/** A longer line for the change form: what choosing this role means. */
export const ROLE_CHOICE_HINT: Record<(typeof ASSIGNABLE_ROLES)[number], string> = {
  member: "Their journal, notes and chats, plus shared rooms.",
  admin: "Can add people and rooms, and approve things. Still can't read anyone's own space.",
  supervised: "Their own space, within limits they will always see, with who set them.",
  guest: "Only what you share with them.",
};
