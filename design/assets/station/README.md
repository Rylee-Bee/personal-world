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
| `engineeringbg.png` | Engineering | Brass, pipes, amber light — Hekek's domain |
| `vaultbg.png` | The Vault | Warm library, lamplight, shelves — Bruma's domain |
| `observeatorybg.png` | The Observatory | Night sky, instruments, huge windows — Mira's domain |
| `quarters.png` | Your Quarters | Bed, lamplight, quiet — the bed icon lives here |
| `mediabg.png` | The Galley | Media/news backdrop |
| `maproom.png` | The Archives | Room with maps and references |
| `placesbg.png` | The Workshop | Places/projects backdrop |
| `systemsbg.png` | *(old Systems)* | Historical — superseded by engineeringbg |
| `bgstars1.png`, `bgstars2.png` | Any deck / starfield | Star backgrounds for decks without a dedicated room |
| `bridgebg` | **MISSING** | The Bridge currently uses bgstars2 |

### Character cutouts (transparent)

| File | Resident | Size |
|---|---|---|
| `renai.png` | Renai (Bridge) | 997K |
| `bolt.png` | Bolt (Workshop) | 1.5M |
| `ratatoskr.png` | Ratatoskr (Archives) | 2.4M |
| `burrito.png` | Burrito Journalism (Galley) | 1.5M |
| `hekek.png` | Hekek (Engineering) | 1024×1536, 2.5M |
| `bruma.png` | Bruma (Vault / standing in at Observatory) | 1024×1536, 2.1M |
| `world.png` | Personal World (the core) | 1122×1402, 1.3M |
| **mira.png** | **MISSING** | Observatory resident; art request #21 |

### Pose sheets

All seven residents have pose sheets in `characters/poses/`:
`renaipose.png`, `boltpose.png`, `ratatoskrpose.png`, `burritopose.png`,
`hekekpose.png`, `brumapose.png`, `worldpose.png`.

### Icons & marks

| File | Purpose |
|---|---|
| `bedicon.png` | Quarters bed icon (1.3M) |
| `goodnews.png` | The Good News mark |
| `softdot.png` | The Soft Dot mark |
| `lantern.png` | The Lantern mark |

### Composites

| File | Contents |
|---|---|
| `fullcrew.png` | The full crew shot |
| `newchars.png` | New area characters production sheet (Hekek, Bruma, Mira + Quarters) |
| `charscaletest.png` | Scale test for the crew |

---

## 2. What's still missing

| Need | Status |
|---|---|
| **`mira.png`** (Observatory cutout) | Art request #21 — Observatory uses Bruma as a placeholder until delivered |
| **Bridge room background** | Uses `bgstars2.png` as a starfield; a dedicated bridge scene would be ideal |
| **Archives room background** | Uses `maproom.png`; a dedicated archives/shelves scene may be better |
| **Quarters SVG export** | Bed icon as vector + 16/32/48px PNGs (art request #28) |

---

## 3. Where these are used

- **`showcase/station.html`** — the Station concept page (all 8 rooms)
- **`showcase/hub.html`** — the Ring home
- **`showcase/crew-maker.html`** — the crew-your-station concept
- **`design/assets/station/`** — tracked canonical copy

*Curated 2026-09-17.*