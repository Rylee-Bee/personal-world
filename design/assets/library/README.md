# Room and companion library (owner, 2026-09-26)

Art anyone's Worlds can use, not tied to one person's rooms or crew. Generated
in one batch, in the same style history as the crew and the room doorways, so
it stays consistent.

- `doorways/doorway-*.png`: 12 room interiors, 1024 px tall, transparent
  outside the arch: study, archive, garden, kitchen, lounge, music,
  observatory, post, travel, vault, wellness, hallway.
- `picks/pick-*.png`: 16 portrait-only faces, 1024 × 1024, navy background,
  made for circle crops and checked at 40 px.
- `pick-labels.json`: a suggested first name per face. Suggestions only;
  people name their own companions.

Nothing is assigned automatically (owner: "no need to set defaults"). People
choose a room's doorway on the Crew page (saved on that device), and can give
a companion they add one of these faces (stored as that companion's own
picture through `POST /api/crew/{id}/portrait`).

Web sizes live in `ui/public/assets/crew/{256,512}/` with the same names as
`.webp`. Edit these masters, never the web copies.
