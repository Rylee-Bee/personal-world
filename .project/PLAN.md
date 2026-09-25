# Plan — Project Worlds (owner-approved 2026-09-25)

Status: approved by the owner (Rylee) 2026-09-25 after the Worlds vision review. Step 1 GO given 2026-09-25.
Review document: https://claude.ai/code/artifact/bd38f7ef-13ee-42e2-b700-9dc4079712f5 (sections A–L).

## The product in one paragraph

Things come to Rylee. She opens Worlds like email on her phone and her world is already gathered: mostly good/interesting things, with the have-tos in one calm place, no "e-yelling". She follows a thread as far as her capacity allows that day. The face is "the bridge of my station" — the Constellation star map design. Fun is a requirement, not decoration. Worlds and Project Home are one product in her mind; Project Home becomes a source that feeds Worlds.

## Rules for every lane

1. Starting direction, not specification: the Constellation star map (`portfolio/starfield-starmap-portfolio.html` in the design index, `media_files/designs/portfolio/`). Idea library to borrow from, combine and improve: theme-studio/station.html signal cards + volume registers, the 8 honest status words, the "quietly here" assistant drawer; today-dashboard-qwen calm copy; today-dashboard-codex "What needs you now"; meridian-status phone row; journal-timeline-qwen; the crew, companions and Station art.
2. Small slices; each ends with phone (390px) + desktop screenshots shown to Rylee before the next starts.
3. Real data before pretty screens.
4. Done = running on Rylee's instance and used by her. Green gates are necessary, not sufficient.
5. Offload bulk work (research, drafts, inventories) to cheap models via the `offload` CLI; the orchestrator (Claude) verifies every claim.
6. Protected, never archived: character canon (docs/CHARACTER-HANDBOOK.md, COMPANION-CANON.md, CREW-AND-STATION-THESIS.md, design/COMPANION_INTEGRATION.md), all crew/station/companion art and rigs, design/concepts/assets/, media_files/characters/.
7. Honest states and the accessibility contract still hold (docs/accessibility/ACCESSIBILITY_CONTRACT.md).
8. Owner gates: deploys to her live instance, anything touching secrets, deleting remote branches or data.

## Step 1 — first light: the Keeper, briefing and bridge as one experience (GO 2026-09-25)

Owner directive (2026-09-25): the Keeper, briefing and bridge are one experience. The briefing is what her world knows; the bridge is where she explores it; the Keeper is how it speaks; memory is how she returns without reconstructing. Existing designs, art and code are a **library of ideas, not a specification**: borrow, combine, reinterpret, improve. Calm means respecting attention and energy, not sterile; cute, curious and playful is required. Keep originals recoverable. Shell and real data grow together; no empty beautiful interfaces.

The first working slice must let her:
1. Open her world.
2. Discover something useful or interesting that has already arrived.
3. See what needs her attention without being overwhelmed.
4. Follow something that catches her interest.
5. Return later and find that Worlds remembers where she was.

| Slice | What | Rough size |
| --- | --- | --- |
| 1a | Truth pass (small): `ui/` has no orphaned screens; delete only truly dead bits (`ui/src/mocks/server.ts`, placeholder copy). Unused media/reminder/connection hooks are unfinished intent: keep and wire them. Fix Resume: `GET /api/journal/last` returns the newest entry of any kind, and the daily loop writes "capability X: status" lines | 1 day |
| 1b | First light: the bridge home in `ui/` fed by real sources already reachable (Project Home via its CLI or `GET /api/home`, lab state, journal/memory); remembers where she was across devices. **Personality ships here, not later** (owner refinement 2026-09-25): the crew stand on the map and report their systems in their own voices; the Keeper speaks the briefing | 3–4 days |
| 1c | More arrives: media (existing `native_media`: Plex/Sonarr/Radarr), calendars (personal ICS/CalDAV + work via Graph), the have-tos tray | 2–3 days |
| 1d | Deepen: richer character moments and animation, discovery surprises, polish | 1–2 days |
| 1e | A preview she can use on her phone (non-production); production cutover of her live Station only with her explicit approval | her time |

Each slice ends with phone and desktop screenshots or a working preview. Her reaction ("thumbs up" / "this feels wrong") gates the next major experience change; implementation details are Claude's call.

## Step 2 — inboxes (~1 week)

Personal email, work email and Teams summarized into "needs you" and "nice to know". Rylee is the Entra admin: one app registration, Microsoft Graph DELEGATED read-only scopes (Mail.Read, Chat.Read, Calendars.Read) signed in as her — never application-level Mail.Read (tenant-wide). Owner approved work data "with adequate controls".

## Step 3 — the rest of the morning (no timeline yet)

Reddit, Facebook/Messenger (restrictive APIs; may need email-digest workarounds), interests discovery, the crew as voices of the bridge (residents were switched off 2026-09-22; owner said losing them felt like losing something important).

## Parked (owner-approved 2026-09-25)

Node/Headscale remote-agent limb, Workbench/terminal broker, new contract machinery, new UI redesigns before sources flow.

## Housekeeping backlog

Project Home merge as a Worlds source; name collisions ("Workshop" means 3 things; "where we left off" exists 4 times: lab recap, lab enter, lab world, Project Home); media_files LimeZu stored twice (~700 MB; repoint game repos first); tidy the design index (16 superseded model variants); decide design/exports/0.1/; 17 duplicate crew/station image pairs left in place because live UI references filenames.

## Done 2026-09-25

Step 1b "first light" (PR #68; handoff: `.project/HANDOFF-BRIDGE-2026-09-25.md`). Owner: "a lot closer"; next is 1b.2 layout + life, then 1c.

Vision review + live walkthrough + inventory (review doc); PR #65 design archive (tag archive/pre-design-cleanup-2026-09-25; six old branches kept as archive/branch/* tags); PR #66 Play-Nice pin 44ec8f4 -> 60eaeab; media_files node_modules cleared (110 MB).

## Timeline note

Sizes are estimates, not measurements. Each slice waits for Rylee's reaction; on a low-capacity day it simply waits.
