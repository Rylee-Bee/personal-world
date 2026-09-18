# The Station — deck map

**Status:** Owner canon (owner-stated 2026-09-17). The logical deck plan of
**The Station** (Project Worlds): eight decks, each named for the job done there,
each with a resident — except `Quarters`, which is an icon.

- **Character and voice truth** (who each resident is) →
  [`docs/CHARACTER-HANDBOOK.md`](CHARACTER-HANDBOOK.md).
- **Names, ids, and the station-id ↔ server-key mapping** →
  [`docs/COMPANION-CANON.md`](COMPANION-CANON.md).
- This file owns the **map** only: which deck exists, what its job is, and who is
  there.

---

## 1. The eight decks

**Every name is a job.** A deck is not a rank or a title — *Bridge*, *Workshop*,
*Vault* and the rest name the work that happens there. The deck plan places the
crew; it is not a hierarchy. This stays consistent with
[`docs/CREW-AND-STATION-THESIS.md`](CREW-AND-STATION-THESIS.md) §1 (*no ranks and
stations, no franchise framing*): these are job names, not crew roles.

| Deck | Its job | Product area | Resident |
|---|---|---|---|
| **Bridge** | Personal presence — conversation, wonder, reflection, personal continuity | Chat / Companion | **Renai** |
| **Engineering** | Keeping the machinery healthy enough that dramatic problems never happen; maintenance as care | Systems | **Hekek** |
| **Workshop** | Making things together — building, learning by doing, checking the work | Projects / Lab | **Bolt** |
| **Archives** | Carrying knowledge between worlds; finding paths and connections across lore and memory | Journal / Memory | **Ratatoskr** |
| **Galley** | Bringing the outside world home — news, stories, city life, at a wander-over pace | Media | **Burrito Journalism** |
| **Observatory** | Watching, note-taking, and noticing patterns before they are understood | Interests | **Mira** |
| **Vault** | Careful preservation with provenance — remembering where things came from | Vault | **Bruma** |
| **Quarters** | Rest, privacy, safety, and quiet | Settings / rest | **icon — no character** |

The *Product area* column is a **proposed** deck → surface mapping, not owner
canon and not yet implemented; see §3.

---

## 2. Quarters is an icon, not a resident

`Quarters` does **not** need a character. It is a stylized bed icon in the same
visual language as the crew icon set: simple rounded silhouette; bed, pillow,
folded blanket; dark navy and warm gold; optional tiny star or crescent; no face,
no personality. It should read clearly at 16px, 32px and 48px, and must not use
colour as the only meaningful signal. It communicates **rest · privacy · safety ·
quiet** (see [`docs/ART-REQUESTS.md`](ART-REQUESTS.md)).

Do not add `Quarters` as a companion, a station id, or a server key.

---

## 3. The crew is the default — and it is a setting (owner canon, 2026-09-17)

The residents in §1 are **the default crew**: they ship in the box, and they are
also the owner's own crew. They are not the only possible crew.

- **A deck is a job; a resident is who does it.** The **eight decks are fixed** —
  they name the work (Bridge, Engineering, …). **Residents are assignable.**
- **Which resident sits on a deck is a setting.** Anyone can create their own
  resident and assign them to any deck — including Quarters, where the bed icon is
  the default when nobody is assigned.
- **A created resident is a resident pack** (name, role line, voice, art),
  installed and uninstalled with provenance — the existing "a new identity is a
  pack, not a one-off" mechanism
  ([`docs/CREW-AND-STATION-THESIS.md`](CREW-AND-STATION-THESIS.md) §5).
- By default **one resident per deck**; a resident may still *visit* another deck
  as a temporary reaction, never a silent permanent move.
- **The setting never touches the accessibility floor.** It is a product
  preference alongside theme and companion — *not* a key in
  [`docs/accessibility/PREFERENCES_SCHEMA.json`](accessibility/PREFERENCES_SCHEMA.json),
  which is the comfort floor. No crew choice may remove a label, a control, or a
  route to functionality; residency never carries critical information
  (thesis §3.1).

This does not weaken the thesis — *nobody has to become more like the others
first.* It extends it: nobody has to keep the shipped crew first, either.

---

## 4. Open / UNKNOWN

- **Deck names are owner canon; the implementation is not.** No deck plan exists
  in the Station or the server today. Whether the Station exposes decks as
  navigable areas is **UNKNOWN**.
- **Product areas are proposed.** Which product surface each deck maps to
  (Chat, Systems, Projects/Lab, Journal/Memory, Media, Interests, Vault,
  Settings) is a proposal recorded above; the owner spec names decks and
  residents, not surfaces.
- **Three area residents are not in the repo.** Hekek, Bruma and Mira are owner
  canon (2026-09-17); their station ids / server keys (`hekek`, `bruma`, `mira`)
  are **proposed** and unread by any code or asset. See
  [`docs/COMPANION-CANON.md`](COMPANION-CANON.md).
- **Quarters has no id.** It is an icon, not a resident — unless someone assigns
  one to it (§3).
- **Resident creation and assignment are a concept, not an implementation.** The
  2026-09-17 concept in §3 says anyone may create residents and assign them to
  decks; no creator, pack format, or assignment model exists in the code yet.