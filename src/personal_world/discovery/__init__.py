"""Project Worlds discovery engine — per-world poll → filter → dedup → surface.

Vendored 2026-09-20 from the homelab `services/candy-dispenser/discovery`
package (commit 38862750 and earlier), which Rylee built as the candy
dispenser — her first build she thought might be worth something. It was.
Two production worlds (media, homelab-firmware) and 30 tests came with it.

The legacy env-globals loop (engine.run_once) is preserved for the
standalone container; Project Worlds consumes the per-world seam in
world_run.run_world — no module globals, per-world state, capture mode
when no push channel is configured.
"""
