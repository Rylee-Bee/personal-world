# Station assets — the new art set (2026-09-17)

**Status:** Owner drop (`design/owner/station/`). Canonical art for the
Station rooms and residents. Curated into `design/assets/station/`.

**Source:** `design/owner/station/` (local working drop, gitignored).
**Tracked copy:** `design/assets/station/` (committed).

---

## 1. What this set contains

### Room backgrounds (1672×941)

| File | Deck | Notes |
|---|---|---|
| `engineeringbg.png` | Systems | Brass, pipes, amber light — Hekek's domain |
| `vaultbg.png` | Backups | Warm library, lamplight, shelves — Bruma's domain |
| `observeatorybg.png` | Interests | Night sky, instruments, huge windows — Mira's domain |
| `quarters.png` | Settings | Bed, lamplight, quiet — the bed icon lives here |
| `mediabg.png` | News | Media/news backdrop |
| `maproom.png` | Journal | Room with maps and references |
| `placesbg.png` | Projects | Places/projects backdrop |
| `systemsbg.png` | *(old Systems)* | Historical — superseded by engineeringbg |
| `bgstars1.png`, `bgstars2.png` | Any deck / starfield | Star backgrounds for decks without a dedicated room |
| `bridgebg.png` | Today | Delivered 2026-09-18 (1672×941) — lived-in station interior |

### Character cutouts (transparent)

| File | Resident | Size |
|---|---|---|
| `renai.png` | Renai (Today) | 997K |
| `bolt.png` | Bolt (Projects) | 1.5M |
| `ratatoskr.png` | Ratatoskr (Journal) | 2.4M |
| `burrito.png` | Burrito Journalism (News) | 1.5M |
| `hekek.png` | Hekek (Systems) | 1024×1536, 2.5M |
| `bruma.png` | Bruma (Backups / standing in at Interests) | 1024×1536, 2.1M |
| `world.png` | Personal World (the core) | 1122×1402, 1.3M |
| **mira.png** | Mira (Interests) | 1024×1536, alpha — delivered 2026-09-18 |

### Pose sheets

All seven residents have pose sheets in `characters/poses/`:
`renaipose.png`, `boltpose.png`, `ratatoskrpose.png`, `burritopose.png`,
`hekekpose.png`, `brumapose.png`, `worldpose.png`.

### Icons & marks

| File | Purpose |
|---|---|
| `bedicon.png` | Settings bed icon (1.3M) |
| `goodnews.png` | The Good News mark |
| `softdot.png` | The Soft Dot mark |
| `lantern.png` | The Lantern mark |

### Composites

| File | Contents |
|---|---|
| `fullcrew.png` | The full crew shot |
| `newchars.png` | New area characters production sheet (Hekek, Bruma, Mira + Settings) |
| `charscaletest.png` | Scale test for the crew |

---

## 2. What's still missing

| Need | Status |
|---|---|
| **Journal room background** | Uses `maproom.png`; a dedicated archives/shelves scene may be better |
| **Settings SVG export** | Bed icon as vector + 16/32/48px PNGs (art request #28) |
| **Vector SVGs for new crew** | Hekek, Bruma, Mira need vector exports (art request #22) |

---

## 3. Where these are used

- **`showcase/station.html`** — the Station concept page (all 8 rooms)
- **`showcase/hub.html`** — the Ring home
- **`showcase/crew-maker.html`** — the crew-your-station concept
- **`design/assets/station/`** — tracked canonical copy

*Curated 2026-09-17.*