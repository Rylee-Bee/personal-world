# ART REQUESTS — what to ask for, and how to ask

> **Status:** Reference · **Verified:** 2026-09-26 · **Canonical for:** how to phrase crew/area art requests so new work matches the existing style · **Read this if:** you are commissioning or generating new art.

**Display names:** see `docs/COMPANION-CANON.md` — some request text below predates the 2026-09-25 name updates (Sol, Scoop).

**In short:** the style clause to paste first, the priority list of assets, per-character one-line briefs, and copy-paste request blocks. It records what has already been delivered so nothing is re-requested.

Status: a practical request sheet. Grounded in the owner crew sheet
(`design/screens/crew.png`) and `docs/CHARACTER-HANDBOOK.md`. Companions are
described in `docs/COMPANION-CANON.md`. Art direction: `design/COMPANION_INTEGRATION.md` → "Art direction".

## 1. Paste this first — the style clause

> Match the Worlds crew sheet. Every character wears the **same dark
> uniform with gold trim and the same combadge**. Pastel-to-saturated palette,
> crisp dark outlines, large expressive eyes with highlights, rosy cheeks,
> sparkle accents. Warm, painterly, cozy lighting on a deep navy / space
> background. **Cute but competent** — adventurer/astronaut energy, not
> infantilised. Siblings in art direction, each with a **completely distinct
> silhouette**. No text baked into the artwork.

## 2. Ask for this next (highest value first)

1. **A full character sheet per companion**, like the poster: front /
   three-quarter / side / back, an expressions row, uniform detail insets, and a
   combadge close-up. Deliver a flat sheet **and** a transparent-background cutout.
2. **A six-pose state sheet per companion**, matching the design's emotional
   states: `REST` (quietly here) · `CURIOUS` (something caught my attention) ·
   `ATTENTIVE` (I'll keep watch) · `ENGAGED` (how can I help) · `PROTECTIVE`
   (keeping watch) · `GIVING SPACE` (absent / quietly here). These map to real
   companion behaviour, so they are worth more than random poses.
3. **The combadge on its own** — large and clean — plus 4–6 small variants if
   each role has its own.
4. **A scale sheet**: the same character at micro (16–20px), nav (32px), inline
   (48px), empty (64px), error (64px), feature (96px+), so the silhouette reads
   at every size.
5. **A wide "the crew together" scene** (like the poster's bottom band), roughly 3:1.
6. **Icon set**: the crew emblem + the five silhouette marks, as app icon / favicon sizes.

## 3. Per-character clauses (paste when asking for one)

- **Renai** — "a pastel mermaid with a rainbow braid, gold gaze, uniform combadge;
  **Explorer · Companion · Dreamer**; curious and lyrical, follows the current of
  thought; wonder, reflection, personal continuity; the **least task-oriented**
  of the crew."
- **Ratatoskr** — "a Norse messenger squirrel beneath Yggdrasil: lavender cloak,
  gold brooch, blue cap, messenger satchel, acorn; the world-tree's leaves are
  tiny books; **Scout · Guide · Explorer**; quick and a little mischievous; runs
  between worlds carrying knowledge."
- **Bolt** — "a small round helper robot with a glowing antenna; **Helper ·
  Learner · Good Company**; plain and careful, allergic to shortcuts; competence
  without omniscience; can just be tinkering quietly."
- **Burrito Journalism** — "a breakfast burrito truck with a news sign and warm
  lights; **News · Snacks · Stories · Everywhere**; warm newsroom voice, background
  before breaking; gloriously weird — keep it that way."
- **Personal World** — "a small smiling planet with a golden ring; **Home ·
  Connection · Possibility**; the spirit of the place, not a chat personality; it
  expresses through light and constellations more than dialogue."

**New area characters — one-line clauses (owner canon 2026-09-17).** Hekek,
Bruma and Mira now have transparent cutouts (Mira delivered 2026-09-18); vector
SVGs are still outstanding. Paste the clause as-is when commissioning.

- **Hekek** — "A retired paladin dwarf turned station engineer; Builder ·
  Maintainer · Steward; broad, steady and practical, wearing the Worlds
  navy-and-gold crew uniform adapted into a durable engineering coat and apron,
  carrying well-used tools and subtle relics of his paladin life; maintenance as
  care, repair over spectacle."
- **Bruma** — "A gentle polar bear librarian who tends the Vault; Archivist ·
  Keeper · Witness; large, calm and reassuring, wearing the Worlds
  navy-and-gold crew uniform as a warm librarian mantle, surrounded by carefully
  kept books, provenance cards, archive ribbons and lamplight; preservation
  without possessiveness."
- **Mira** — "A bright, slightly forgetful young Observatory investigator;
  Observer · Note-Taker · Pattern Seeker; curious and capable, wearing the
  Worlds navy-and-gold crew uniform as a practical astronomer's jacket,
  carrying notebooks and observing tools; she may forget the name, but remembers
  the shape of the pattern."
- **Settings** *(icon, not a character)* — "A simple stylized bed, pillow and
  folded blanket in the Worlds navy-and-gold icon language, with a tiny
  optional celestial accent; calm, private and instantly readable at small
  sizes."

> **Set rule:** Same crew, same uniform, different worlds — cute but competent,
> warm painterly light, and a distinct silhouette for each.

## 4. Format to ask for (so the result is usable)

- Transparent-background PNG cutouts **plus** the flat sheet.
- **Vector / SVG export** where possible (the current owner set is SVG — crisp at any size).
- **No text baked in** — we label in code.
- A consistent canvas size across the set.
- Front / ¾ / side / back and expressions delivered as a grid.
- Uniform and combadge delivered separately too, so they can be reused.

## 5. Do not

- Change the uniform or drop the combadge — that is what makes them a *crew*.
- Make them human, angry, needy, or infantile.
- Bake in text, watermarks, or UI chrome.
- Regenerate or replace the existing art — **add** to it.
- Use a saturated hue as the only signal for anything meaningful.

## 6. The one-liner to remember

> "Same crew, same uniform, different worlds — **cute but competent**, warm
> painterly light, and a distinct silhouette for each."

---

## 7. Gap list — DELIVERED 2026-09-17

Everything below arrived in `design/owner/crew/newassets/` (owner drop, gitignored):

- **Transparent cutouts:** `renai1/2`, `ratatoskr1`, `bolt1`, `burrito1`, `worlds1` (alpha).
- **True-vector crew SVGs (~3 KB each):** `project-worlds-crew-svg-clean/{renai, ratatoskr, bolt, burrito-journalism, personal-world, planet-emblem}.svg`.
- **App icon + favicon set:** `project-worlds-app-icons/` — 1024→16 px PNG + multi-size `.ico`, navy `#051437`, emblem centred.
- **Attention-voice marks:** `goodnews.png`, `softdot.png`, `lantern.png`.
- **Rooms (the four areas):** `peoplebg.png`, `mediabg.png`, `systemsbg.png`, `placesbg.png` (1672×941).
- **Skies:** `bgstars1.png`, `bgstars2.png`.
- **Pose sheets:** `renaipose`, `ratatoskrpose`, `boltpose`, `burritopose`.
- **Emblem:** `badge.png`.

Still to do (repo housekeeping, not art): label which poses are the six product states.
The asset set is now **tracked** in `design/assets/crew/` (promoted 2026-09-17 from the
gitignored drop). The table below is kept as the record of what was asked for.

Character work is **done** (see "What already exists" below). What remains is
mostly implementation-ready assets, plus four undrawn areas.

| Still missing | Why |
|---|---|
| ~~Mira transparent cutout~~ | ✅ DELIVERED 2026-09-18 — `design/owner/station/mira.png` (1024×1536, alpha), promoted to `design/assets/station/characters/mira.png`. Art request #21. |
| ~~Today room background~~ | ✅ DELIVERED 2026-09-18 — `design/owner/station/bridgebg.png` (1672×941), promoted to `design/assets/station/backgrounds/bridgebg.png`. |
| **Vector / SVG for new crew** | The 2026-09-17 art set has PNGs; Hekek, Bruma, Mira need vector SVGs matching the existing `design/assets/crew/vector/` set. |
| **Settings SVG export** | ❌ MISSING — bed icon as vector + 16/32/48px PNGs (art request #28). |
| **The six product states, labeled** | The sheets have "Six Key Poses"; the Station reacts to `REST · CURIOUS · ATTENTIVE · ENGAGED · PROTECTIVE · GIVING SPACE`. If those poses are not mapped to those, that is the one character gap. |

**One-line ask:** cutouts + vector, the four areas, and the exported icon files
— the characters themselves are already excellent.

### What already exists (so nothing is re-requested)

- **Master sheets:** `crew.png`, `crew2–5` — turnarounds, expression rows, six key
  poses, uniform details, combadge + variants, scale sheet, icon set, "The Crew Together".
- **Per-character sheets:** `mermaidchar.png`, `ratataskor.png`, and the rest in
  `design/owner/crew/`.
- **Scale sheet** with sizes: 16 Micro · 32 Nav · 48 Inline · 64 Empty · 64 Error · 96 Feature.
- **Icon + sticker library:** `icons.png` (characters, symbols, books, map, world-tree, foliage, weather).
- **Wide crew scene:** `design/screens/crew-scene-sept17.png` (tracked).
- **Crew portrait:** `design/screens/worlds.png` (tracked).
- **Station art set (2026-09-17):** `design/owner/station/` → curated to `design/assets/station/`.
  Room backgrounds for all 8 decks (engineering, vault, observatory, quarters, media,
  archives/maps, starfield), transparent cutouts for 7 residents (renai, bolt, ratatoskr,
  burrito, hekek, bruma, personal-world), pose sheets, icons (bedicon, goodnews, softdot,
  lantern), and composites (fullcrew, newchars, charscaletest).

Owner drops live in `design/owner/crew/` (gitignored); curated pieces are promoted
to `design/screens/` and `design/assets/station/`.

---

## 8. Copy-paste requests (one topic each)

### Prefix — paste this under every request below

> **Style:** match the Worlds crew sheet — the same dark uniform with gold
> trim and the shared **planet combadge**; pastel-to-saturated palette; crisp dark
> outlines; large expressive eyes; rosy cheeks; sparkle accents; warm painterly
> light on a deep navy field; **cute but competent** (not infantilised). Keep it
> consistent with the existing crew art. No text in the image.

---

**1 · Transparent cutout — Renai**

```
Give me one transparent-background PNG of Renai (the mermaid), full body, front
view, completely isolated — no background, no panel, no drop shadow. She wears the
crew uniform with the planet combadge.
```

**2 · Transparent cutout — Ratatoskr**

```
Give me one transparent-background PNG of Ratatoskr (the Norse messenger squirrel:
cap, cloak, satchel, acorn), full body, front view, completely isolated — no
background, no panel, no drop shadow. Same uniform and combadge.
```

**3 · Transparent cutout — Bolt**

```
Give me one transparent-background PNG of Bolt (the little helper robot), full
body, front view, completely isolated — no background, no panel, no drop shadow.
Same uniform and combadge.
```

**4 · Transparent cutout — Burrito Journalism**

```
Give me one transparent-background PNG of the Burrito Journalism truck, side view,
completely isolated — no background, no panel, no drop shadow. Same uniform/marking
language as the crew.
```

**5 · Transparent cutout — Personal World**

```
Give me one transparent-background PNG of Personal World (the smiling ringed
planet), completely isolated — no background, no panel, no drop shadow. Same
combadge/emblem language.
```

**6 · Six labeled states — Renai**

```
One reference sheet of Renai in six separated, captioned poses — REST (quietly
here), CURIOUS (something caught my attention), ATTENTIVE (I'll keep watch),
ENGAGED (how can I help), PROTECTIVE (keeping watch), GIVING SPACE (quietly
present). Caption each pose with its state name. (Captions are fine on this
reference sheet.)
```

**7 · Six labeled states — Ratatoskr**

```
One reference sheet of Ratatoskr in the same six captioned states: REST, CURIOUS,
ATTENTIVE, ENGAGED, PROTECTIVE, GIVING SPACE. Caption each pose. (Captions fine
here.)
```

**8 · Six labeled states — Bolt**

```
One reference sheet of Bolt in the same six captioned states: REST, CURIOUS,
ATTENTIVE, ENGAGED, PROTECTIVE, GIVING SPACE. Caption each pose. (Captions fine
here.)
```

**9 · Six labeled states — Burrito Journalism**

```
One reference sheet of the Burrito Journalism truck in the same six captioned
states: REST, CURIOUS, ATTENTIVE, ENGAGED, PROTECTIVE, GIVING SPACE (e.g. parked,
noticing, watching, serving, protecting, quietly idle). Caption each pose.
```

**10 · Six labeled states — Personal World**

```
One reference sheet of Personal World in the same six captioned states: REST,
CURIOUS, ATTENTIVE, ENGAGED, PROTECTIVE, GIVING SPACE (expressed through light,
orbit speed and atmosphere rather than a face change). Caption each pose.
```

**11 · Vector / SVG export**

```
Convert the existing crew sheets into clean SVG: one file per character (Renai,
Ratatoskr, Bolt, Burrito Journalism, Personal World) and one for the planet
emblem. Keep the exact same design, colours and combadge; no embedded raster.
```

**12 · App icon + favicon set**

```
From the crew emblem (the planet combadge), produce an app-icon set: 1024, 512,
256, 192, 180, 152, 120, 64, 32 and 16 px PNGs, plus one multi-size .ico. Centred,
clean, on the deep navy field, no text.
```

**13 · Attention-voice marks (a set of three)**

```
Three small, simple transparent marks for the attention voices: GOOD NEWS (a
sparkle/star), A SMALL UPDATE (a soft dot or page), WHEN YOU'RE READY (a small
lantern — a gentle "waiting" mark). Minimal, one or two palette colours, no text.
```

**14 · Area art — People**

```
Wide scene art (~16:9) for the "People" area of the world: a warm, inhabited space
where the people in your life appear as gentle presences and constellations. Deep
navy, warm light, quiet, no text, no UI chrome.
```

**15 · Area art — Media**

```
Wide scene art (~16:9) for the "Media" area: a cosy den of screens, shelves and a
small lit screen — where what you watch and read lives. Deep navy, warm light, no
text, no UI chrome.
```

**16 · Area art — Systems**

```
Wide scene art (~16:9) for the "Systems" area: the quiet engine room — soft
machinery, gauges and lights that read as "everything is running". Deep navy, warm
light, calm, no text, no UI chrome.
```

**17 · Area art — Places**

```
Wide scene art (~16:9) for the "Places" area: a map-room / observatory of
locations, pins and horizons. Deep navy, warm light, no text, no UI chrome.
```

**18 · Per-area skies (repeat per area)**

```
A quiet background "sky" for the <AREA> area — a subtle constellation/star field
that feels like that area's night sky. Low-contrast, calm, no text. (Swap <AREA>
for: Interests, Projects, Journal, People, Media, Systems, Places.)
```

---

## 9. New area crew — Hekek · Bruma · Mira (added 2026-09-17)

Already delivered in `design/assets/crew/newchars.png`: turnarounds
(front / ¾ / side / back), expression rows, the six labeled states, the combadge,
and role detail insets — plus the **Settings** bed-icon set with sizes.

Still needed (one topic per request):

| Need | Why |
|---|---|
| **Transparent cutouts** — one per character | The sheet is composite; the UI needs each isolated. |
| **Vector SVGs** — Hekek, Bruma, Mira | Match `design/assets/crew/vector/` for crisp scaling. |
| **Scale tests** (16→96 px) | Confirm each silhouette reads small. |
| **New room art** — Systems, Records, Interests, Settings | The four new decks have no backdrop yet. |
| **Settings icon export** | 16/32/48 px PNGs + a vector SVG. |

**19 · Transparent cutout — Hekek**

```
A transparent-background PNG of Hekek (the retired paladin dwarf engineer), full
body, front view, isolated. Navy crew uniform with gold trim, combadge, apron,
tool belt, hammer-wrench.
```

**20 · Transparent cutout — Bruma**

```
A transparent-background PNG of Bruma (the polar bear librarian), full body, front
view, isolated. Librarian mantle, combadge, archive satchel and key.
```

**21 · Transparent cutout — Mira** ✅ delivered 2026-09-18

```
A transparent-background PNG of Mira (the young Observatory investigator), full
body, front view, isolated. Astronomer's jacket, combadge, notebook satchel and
observing tool.
```

**22 · Vector SVGs — Hekek · Bruma · Mira**

```
Clean SVG of Hekek, Bruma and Mira — one file each, same design and colours, no
embedded raster. Match the existing crew vectors in design/assets/crew/vector/.
```

**23 · Scale tests**

```
A scale test of each new character (Hekek, Bruma, Mira) at 16, 32, 48, 64 and 96 px,
labelled, so each silhouette reads small.
```

**24 · Room art — Systems (Hekek)**

```
Wide (~16:9) room art for Systems: heavy machinery, brass and pipes, a
workbench, warm amber light. Deep navy, no text.
```

**25 · Room art — Records (Bruma)**

```
Wide (~16:9) room art for Records: a warm library of shelves, lamplight and
archive drawers. Preserved and cherished, never ominous. No text.
```

**26 · Room art — Interests (Mira)**

```
Wide (~16:9) room art for Interests: brass instruments, star maps, a large
telescope, huge night-sky windows. Deep navy, warm light, no text.
```

**27 · Room art — Settings**

```
Wide (~16:9) room art for Settings: a calm restful room — bed, lamplight, quiet and
private. Deep navy and warm gold, no text.
```

**28 · Settings bed icon export**

```
Export the Settings bed icon as clean 16, 32 and 48 px PNGs plus a vector SVG, in
the crew icon language (navy + warm gold, optional tiny crescent, no face).
```
## 10. The Assistant, painted (requested and DELIVERED 2026-09-26)

**Delivered:** `design/assets/crew/assistant/assistant-{portrait,listening,hello}.png`, with web
sizes in `ui/public/assets/crew/{256,512}/`. The hello image was replaced the same day with a
clean-edge cutout (no glow, no waving hand), padded to a 1024² square so it sits on any panel.

The Assistant is Worlds' **plain default companion**: who answers when the person
hasn't chosen anyone. Today it's a drawn SVG (`design/assets/crew/assistant/assistant.svg`):
a friendly computer monitor in the crew's navy and gold, with a small gold
ringed-planet commbadge (Sol's shape, no face) on its stand. This asks for a painted
version that sits beside the rest of the crew without standing out.

**Who it is.** Calm, helpful, a little shy; plain-spoken, never cutesy. It's a
*screen with a kind face*: two eyes, a small smile, rosy cheeks, all shown **on the
screen**. No arms or legs; emotion lives in the face and a little tilt of the monitor.
It is not Sol (the planet logo) and never wears her face.

**Deliver (so it drops straight in):**

| File | What | Canvas | Used for |
| --- | --- | --- | --- |
| `assistant-portrait.png` | Round-porthole bust, **same framing as `portraits/bolt-portrait.png`** (screen centred, face at the same height) | 1024 × 1024, transparent | Crew page, keeper emblems, briefing speaker (24–84 px) |
| `assistant-listening.png` | Bust, face turned slightly to the reader, attentive | 1024 × 1024, transparent | Beside Chat (the "Chat with your companion" board) |
| `assistant-hello.png` | Full monitor on its stand, smiling; a small gold cursor-hand waves **on the screen** | 1024 × 1536, transparent | Empty states, first-day guide |
| `assistant-sheet.png` (optional) | The six states on one sheet: REST · CURIOUS · ATTENTIVE · ENGAGED · PROTECTIVE · GIVING SPACE | any, flat | Reference |

- PNG with real transparency, no baked-in text, no background glow or halo in the cutouts.
- Must still read at **24 px**: a clear screen shape and two eyes, nothing fiddly.
- Drop the files in `design/owner/crew/newassets/` (or send them). Claude curates them
  into `design/assets/crew/assistant/` and exports `ui/public/assets/crew/{256,512}/`
  WebPs, the same as the crew.

**Copy-paste request:**

```
Paint the Assistant for the Project Worlds crew: a friendly computer monitor on a small
stand — the plain default helper. Same style as the crew sheet: warm, painterly, crisp
dark outlines, deep navy casing with gold trim, cozy lighting. The face lives ON the
screen: two large expressive eyes with highlights, a small gentle smile, rosy cheeks.
A small gold ringed-planet commbadge (a planet with a ring, no face) sits on the stand.
No arms or legs; emotion comes from the face and a slight tilt. Calm, helpful, a little
shy; cute but competent. No text anywhere.
Deliver, each as a transparent PNG:
1) assistant-portrait.png — 1024×1024 round-porthole bust, framed exactly like the other
   crew portraits (screen centred, face at the same height).
2) assistant-listening.png — 1024×1024 bust, attentive, turned slightly toward the viewer.
3) assistant-hello.png — 1024×1536 full monitor on its stand, smiling, with a small gold
   cursor-hand waving on the screen.
Optional: a sheet of six states (rest, curious, attentive, engaged, protective, giving space).
It must still read at 24 px.
```

## 11. Painted spot icons (requested 2026-09-26)

The interface uses **line icons** (`design/assets/icons/`) for buttons and
menus. This asks for their painted cousins: **spot icons**, one per idea,
for empty states, section headers, cards and the People page. They are what
makes a screen feel like Worlds at a glance. Owner rule: *if we can add
whimsy, whimsy is an obligation.*

**Style.** The same language as the lower rows of the Icon Atlas
(`icons/Personal Worlds Icon Atlas.png`): a small painted object, crisp dark
outline, deep navy body, warm gold trim, one tiny sparkle, soft cozy light.
**Objects only: no faces, no characters, no text.** Each must still read at
**32 px**, so one clear silhouette per icon.

**Deliver:** 16 PNGs, **512 × 512, real transparency**, the object centred
with about 10% empty margin, no shadow or glow outside the object.

| File | Object | Where it shows |
| --- | --- | --- |
| `spot-memory.png` | An open book with a small star rising from the pages | Memory, empty journal |
| `spot-chat.png` | A round speech bubble with a sparkle inside | Chat, empty conversation |
| `spot-secrets.png` | An ornate gold key | Secrets section, "Confirm it's you" |
| `spot-room.png` | A small arched doorway with warm light inside | Rooms, "No rooms yet" |
| `spot-people.png` | Two mugs side by side, steam curling together | People page |
| `spot-helper.png` | Two cupped hands holding a small star | "Let someone help me" |
| `spot-limits.png` | A lantern, softly lit | "Your limits" |
| `spot-guest.png` | A ticket with a star punched in it | Guests |
| `spot-candy.png` | A wrapped sweet with a starry wrapper | Candy, discovery |
| `spot-approve.png` | A wax seal pressed with a star | Approvals, "Decided just now" |
| `spot-quiet.png` | A crescent moon with a small star, sleepy | Quiet days, nothing needs you |
| `spot-unreachable.png` | A small lantern behind a wisp of fog | A room Worlds can't reach |
| `spot-find.png` | A brass spyglass | Find a room, search empty |
| `spot-settings.png` | A brass cog with a star in the middle | Settings |
| `spot-journal.png` | A quill resting on a rolled scroll | Writing a note |
| `spot-crew.png` | A compass rose badge | Your crew |

**Copy-paste request:**

```
Paint a set of 16 small spot icons for the Project Worlds app, matching the painted
object icons on the Worlds Icon Atlas: warm, painterly, crisp dark outlines, deep navy
bodies with warm gold trim, one tiny sparkle each, soft cozy light. Objects only: no
faces, no characters, no text. Each icon is one clear silhouette that still reads at
32 px. Deliver each as its own transparent PNG, 512×512, object centred with ~10%
margin, no outer glow or shadow:
spot-memory (open book, a small star rising from the pages), spot-chat (round speech
bubble with a sparkle inside), spot-secrets (ornate gold key), spot-room (small arched
doorway with warm light inside), spot-people (two mugs side by side, steam curling
together), spot-helper (two cupped hands holding a small star), spot-limits (softly lit
lantern), spot-guest (ticket with a star punched in it), spot-candy (wrapped sweet with
a starry wrapper), spot-approve (wax seal pressed with a star), spot-quiet (sleepy
crescent moon with a small star), spot-unreachable (small lantern behind a wisp of fog),
spot-find (brass spyglass), spot-settings (brass cog with a star in the middle),
spot-journal (quill resting on a rolled scroll), spot-crew (compass rose badge).
```

## 12. Sol, four more moods (requested 2026-09-26)

Sol (the smiling ringed planet, the logo) has five moods: `sol-hello`,
`sol-cheer`, `sol-curious`, `sol-rest` and the mark. Every empty or error
state should have a Sol that fits, so Worlds never needs extra words to feel
kind. Sol stays **voiceless**: these are faces, not speech.

**Deliver:** 4 PNGs, **1024 × 1024, real transparency**, framed exactly like
`design/assets/crew/sol/sol-cheer.png` (same size and position of the planet
and ring), no text, no glow outside the art. Must read at 48 px.

| File | Mood | Where it shows |
| --- | --- | --- |
| `sol-searching.png` | Peering through a tiny brass telescope, one eye closed, curious smile | Searching, "Finding who's here…", loading |
| `sol-sleeping.png` | Eyes closed, snug under a little cloud blanket, three tiny stars floating up (no "Zz" letters) | Offline, "Can't reach Worlds" |
| `sol-proud.png` | Beaming, eyes happy arcs, a small gold ribbon medal on the ring | "You're all settled in", everything done |
| `sol-oops.png` | Sheepish smile, one small bandage on the planet, holding a tiny wrench on the ring | Something went wrong (nothing lost) |

**Copy-paste request:**

```
Paint four more moods for Sol, the Project Worlds logo: the same smiling ringed planet
as sol-cheer.png (blue-green planet, gold ring, rosy cheeks, big friendly eyes), in the
same warm painterly style with crisp dark outlines. Keep the planet and ring exactly the
same size and position as sol-cheer.png so the moods swap cleanly. No text, no letters,
no outer glow. Each a transparent PNG, 1024×1024, readable at 48 px:
1) sol-searching.png — peering through a tiny brass telescope, one eye closed, curious smile.
2) sol-sleeping.png — eyes closed, snug under a little cloud blanket, three tiny stars
   floating up (no Zz letters).
3) sol-proud.png — beaming, eyes as happy arcs, a small gold ribbon medal on the ring.
4) sol-oops.png — sheepish smile, one small bandage on the planet, holding a tiny wrench.
```

## 13. App icon (requested 2026-09-26)

Worlds has no proper icon for the browser tab, the phone home screen or
installing it as an app. Sol is the mark, so the icon is Sol on a tile.

**Deliver:** `app-icon.png`, **1024 × 1024, no transparency**: Sol (the
`sol-mark` pose) centred on a deep navy (#161a30 to #1f2442) rounded tile
with a few tiny gold stars. Keep everything that matters inside the **middle
80%** (phones crop the corners to circles or squircles). Must read at
**16 px** in a browser tab, so the planet and ring should fill most of that
middle space and small stars must not crowd it.

Claude exports the favicon, apple-touch and app-install sizes from it, and
builds the GitHub social preview image (1280 × 640) from the showcase art.

**Copy-paste request:**

```
Make the Project Worlds app icon: Sol, the smiling ringed planet logo (same design as
sol-mark.png), centred on a deep navy rounded-square tile (#161a30 to #1f2442) with a few
tiny gold stars. Warm painterly style, crisp dark outlines. 1024×1024 PNG, no
transparency. Keep everything important inside the middle 80% so it survives circle and
squircle crops, and make Sol large enough to read at 16 px. No text.
```

### Where to put the files (11 to 13)

Drop everything in `design/owner/crew/newassets/` (or send a zip). Claude
checks each file for real transparency and size, curates the masters into
`design/assets/icons/spot/`, `design/assets/crew/sol/` and
`design/assets/brand/`, exports the WebP sizes into `ui/public/assets/`, and
wires them in.
