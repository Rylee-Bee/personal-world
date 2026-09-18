# Companion Canon — names, roles, and the id mapping

**Status:** Canonical for companion **display names** (owner-stated, 2026-09-17).
Not a replacement for `design/COMPANION_INTEGRATION.md` (design/art authority),
`docs/accessibility/ACCESSIBILITY_CONTRACT.md` (accessibility), or
`docs/CREW-AND-STATION-THESIS.md` (the family thesis).

**Who each resident is** — character and voice truth — is canonical in [`docs/CHARACTER-HANDBOOK.md`](CHARACTER-HANDBOOK.md); this file owns names and ids only.

Two truths coexist and must not be silently merged:

- **Owner canon is authoritative for the name a human reads and hears.**
- **Repo code is authoritative for machine identifiers** (station ids, server keys,
  artwork paths). Technical identifiers are deliberately unchanged; renaming a
  display name does not rename a key or an asset.

Where this file disagrees with repo evidence, the disagreement is recorded below
(see *Remaining inconsistencies*), not hidden.

---

## 1. The residents

| Name | Role | Origin (game / repo) | Station id | Server key |
|---|---|---|---|---|
| **Renai** | Personal companion (the operator theme) | Owner canon 2026-09-17. **Not in the repo today** — repo still labels her "Mermaid" | `mermaid` | `mermaid` |
| **Ratatoskr** | Worlds / lore / memory keeper — the Norse messenger squirrel | **VEFR** (owner game engine). Repo design label: "World-tree Squirrel" | `ratatoskr` | `world-tree-squirrel` |
| **Bolt** | Lab / development / AI helper ("Little Helper Robot") | Repo design (`design/COMPANION_INTEGRATION.md`); personal name chosen by the owner, 2026-09-17 | `robot` | `robot` |
| **Burrito Journalism** | Journalism / stories / city life — a **breakfast burrito truck** | **Burrito Journalism** (owner game). Repo design label: "Tacos & the Morning Paper" | `burrito` | `taco-news-truck` |
| **Personal World** | Default system companion | Repo product identity | *(none — absent from the Station control)* | `personal-world` |
| **Hekek** | Engineering — Builder · Maintainer · Steward | Owner canon 2026-09-17. **New area character, not in the repo today** | `hekek` *(proposed)* | `hekek` *(proposed)* |
| **Bruma** | The Vault — Archivist · Keeper · Witness | Owner canon 2026-09-17. **New area character, not in the repo today** | `bruma` *(proposed)* | `bruma` *(proposed)* |
| **Mira** | The Observatory — Observer · Note-Taker · Pattern Seeker | Owner canon 2026-09-17. **New area character, not in the repo today** | `mira` *(proposed)* | `mira` *(proposed)* |

"Origin (game / repo)" says where the character comes from, not that the repo
already spells the name that way.

**Quarters is an icon, not a resident.** The deck `Quarters` has no character, no
display name beyond the deck name, and no station id or server key. It is a
stylized bed icon in the crew icon language
(see [`docs/ART-REQUESTS.md`](ART-REQUESTS.md) and
[`docs/STATION-MAP.md`](STATION-MAP.md)); do not add it as a companion.

---

## 2. Server key ↔ station name mapping

Evidence: `design/opendesign-exploration/station/real-data.js` L94–99,
`design/opendesign-exploration/station/station.js` L30–35,
`design/opendesign-exploration/station/settings.html` L371–376
(the Station's "Your companion" control), and
`src/personal_world/prefs.py` L134–142 (the server `COMPANION` preference).

| Station value (browser) | Server value (`prefs.py`) | Binding | Notes |
|---|---|---|---|
| `mermaid` | `mermaid` | exact | Same id both sides. Display canon is **Renai**. |
| `ratatoskr` | `world-tree-squirrel` | renamed | Station id is the character name; server key is the descriptor. |
| `robot` | `robot` | exact | Display: **Bolt** ("Little Helper Robot"). |
| `burrito` | `taco-news-truck` | renamed | Station id is the game name; server key is the descriptor. |
| *(absent)* | `personal-world` | server-only | Default value and floor of the companion preference; the Station control offers only the four above. |
| `hekek` *(proposed)* | `hekek` *(proposed)* | exact | **Not in the Station control or server today.** Display canon: **Hekek**. New area character, owner canon 2026-09-17. |
| `bruma` *(proposed)* | `bruma` *(proposed)* | exact | **Not in the Station control or server today.** Display canon: **Bruma**. New area character, owner canon 2026-09-17. |
| `mira` *(proposed)* | `mira` *(proposed)* | exact | **Not in the Station control or server today.** Display canon: **Mira**. New area character, owner canon 2026-09-17. |

The three `*(proposed)*` rows are a naming proposal only — no code reads them
yet, and whether these ids are correct is **UNKNOWN** until an implementation
decision. `Quarters` is deliberately absent: it is an icon, not a resident.

The Station and the server are two stores that are **not synchronized**
(`real-data.js` L94–98: the Station control saves in this browser, the server
keeps its own value). The mapping above is the translation, not a live sync.

---

## 3. Naming rules

**Which name is canonical per surface**

| Surface | Use |
|---|---|
| Human-facing copy, docs, chat, UI labels | Owner canon: **Renai**, **Ratatoskr**, **Bolt**, **Burrito Journalism**, **Personal World**, **Hekek**, **Bruma**, **Mira**. **Quarters** names the deck/icon, not a resident. |
| Station code (`design/opendesign-exploration/station/`) | ids `mermaid`, `ratatoskr`, `robot`, `burrito` (proposed for the new area crew: `hekek`, `bruma`, `mira`) |
| Server / preferences / API | keys `personal-world`, `mermaid`, `robot`, `world-tree-squirrel`, `taco-news-truck` (proposed for the new area crew: `hekek`, `bruma`, `mira`) |
| Artwork / rig filenames | Keep the existing paths (`mermaid`, `robot`, `world-tree-squirrel`, `taco-news-truck`, `personal-world`). Never rename art to match a display name. |

**What each must never be confused with**

- **Renai is not the default.** "Personal World" is the default system companion;
  Renai (id `mermaid`) is the personal companion / operator theme. Do not use
  "Mermaid" as her name in human-facing copy — it is the artwork form and the id.
- **"Personal World" is overloaded.** It is both the resident and the product's
  former name (renamed *Project Worlds* 2026-09-12). The resident keeps the name;
  the product does not.
- **Ratatoskr is the squirrel, not the tree.** Do not address the character as
  "World-tree Squirrel" (repo descriptor) or as "Yggdrasil" (the world tree).
- **The truck is a breakfast burrito truck, not a taco truck.** "Tacos & the
  Morning Paper" is the repo's old display label for the same resident; reconcile
  toward **Burrito Journalism** and keep the game reference.
- **Bolt is the robot's personal name** (owner-stated 2026-09-17). Use **Bolt**
  in human-facing copy; "Little Helper Robot" is the role/descriptor, not a
  separate character.

**Artwork is reused, never regenerated.** Do not trace, recreate, or overwrite the
companion source rigs, the Mermaid master Lottie
(`design/assets/mermaid-companion-master.lottie` — byte-identical by decision),
the icon library, or the screen SVGs. A display-name change is a copy change, not
an art change. Rules live in `AGENTS.md` ("Do not casually regenerate"),
`docs/CREW-AND-STATION-THESIS.md` §3.6, and
`.agents/skills/personal-world-implement-figma/SKILL.md` (L150–156).

---

## 4. OPEN and UNKNOWN

- **Renai — name missing from the repo.** `rg -i 'renai'` returns 0 matches.
  The repo labels her "Mermaid" everywhere. Which surface adopts "Renai" first,
  and whether the id `mermaid` ever changes, is **UNKNOWN** (do not change ids
  without an explicit decision). *(Earlier working draft name "Willow" is retired —
  do not reintroduce it; it was too close to personal information.)*
- **Bolt — resolved.** The robot's personal name is **Bolt** (owner-stated
  2026-09-17); "Little Helper Robot" remains the role/descriptor. No id changes
  (`robot` stays `robot`).
- **Personal World — Station id UNKNOWN/absent.** The Station "Your companion"
  control (`settings.html` L371–376) offers only `mermaid`, `ratatoskr`, `robot`,
  `burrito`; `personal-world` exists only as a server value/floor. Whether the
  Station should expose it is UNKNOWN.
- **"Tacos & the Morning Paper" retirement date UNKNOWN.** Reconcile to Burrito
  Journalism; when the repo label is retired is not yet decided.
- **Hekek, Bruma, Mira — ids proposed, not implemented.** Owner canon adds three
  area residents (2026-09-17). Their station ids / server keys are **proposed**
  as `hekek`, `bruma`, `mira` (exact binding), but no code, asset, or Station
  control reads them yet. Whether these ids are correct is **UNKNOWN** until an
  owner/implementation decision. `Quarters` has no id — it is an icon, not a
  resident.

---

## 5. Remaining inconsistencies (deliberately not silently fixed here)

Recorded by `rg -i 'renai|ratatoskr|world-tree|tacos & the morning paper|burrito journalism'`:

- `README.md` L3 spells **`Ratataskor`** (typo, missing the second `r`); L252 uses
  the descriptor **"world-tree squirrel and the taco news truck"**. Not fixed.
- `CHANGELOG.md` L221–222 and `design/assets/README.md` / `icons/README.md` still
  use **"Tacos & the Morning Paper"** and **"World-tree Squirrel"** descriptors.
  Not fixed.
- `docs/CREW-AND-STATION-THESIS.md` §2 and `design/COMPANION_INTEGRATION.md` L29–33
  still head their tables with the repo descriptors, not the canon names. Pointer
  added; tables not rewritten.
- `docs/STATION-GAP-ANALYSIS.md` L114–117 already records the
  `ratatoskr`/`burrito` ↔ `world-tree-squirrel`/`taco-news-truck` drift. Left as-is;
  this file is the mapping.
- `src/personal_world/prefs.py` L137 and `src/personal_world/api.py` L2907 keep the
  server keys and art filename. Correct — identifiers are not renamed.

Names below remain **UNKNOWN** in the repo: **Renai** (absent from copy; the id
stays `mermaid`), and the new area crew **Hekek**, **Bruma**, **Mira** (owner
canon 2026-09-17; no repo copy or id yet). **Bolt** is now canon (owner-stated
2026-09-17).