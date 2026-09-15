# TOOL → DOMAIN MATRIX — Project Worlds

Code-observed count: 29 registered tools (mission brief said 26;
repository truth wins). TOOL-000 is the container.

| Tool ID | Read/Write | Proposal? | Approval? | Executor | Domain target | State |
|---|---|---|---|---|---|---|
| TOOL-001 inspect_world_status | Read | No | No | world.summary() | DOMAIN-001 | ACTIVE |
| TOOL-002 inspect_manifest | Read | No | No | registry.manifest() | DOMAIN-007 | ACTIVE |
| TOOL-003 read_journal | Read | No | No | journal.recent | JOURNAL-002 | ACTIVE |
| TOOL-004 search_journal | Read | No | No | journal.search | JOURNAL-002 | ACTIVE |
| TOOL-005 inspect_source_control | Read | No | No | status_all | PROV-001 | ACTIVE |
| TOOL-006 inspect_source_control_history | Read | No | No | repository_history | PROV-001 | ACTIVE |
| TOOL-007 inspect_projects | Read | No | No | AgentSyncProjectSensor | PROV-026 | ACTIVE |
| TOOL-008 inspect_lab_inventory | Read | No | No | NativeLabInventory.observe | PROV-012 | ACTIVE |
| TOOL-009 inspect_lab_health | Read | No | No | NativeLabHealth.observe | PROV-012 | ACTIVE |
| TOOL-010 inspect_lab_resources | Read | No | No | NativeLabResources.observe | PROV-012 | ACTIVE |
| TOOL-011 inspect_lab_settings | Read | No | No | NativeLabSettings.observe | PROV-012 | ACTIVE |
| TOOL-012 inspect_reconciler_status | Read | No | No | NativeSettingsReconciler.observe | PROV-014 | ACTIVE |
| TOOL-013 inspect_reconciler_diff | Read | No | No | reconciler._desired (no observed diff) | PROV-014 | PARTIAL |
| TOOL-014 inspect_discovery_status | Read | No | No | NativeDiscovery.observe | PROV-013 | ACTIVE |
| TOOL-015 list_discovery_sources | Read | No | No | discovery.observe | PROV-013 | ACTIVE |
| TOOL-016 list_interests | Read | No | No | discovery.observe | PROV-013 | ACTIVE |
| TOOL-017 run_discovery | Read-labeled (fetches external content; saves feedback) | No | No | discovery.discover | PROV-013 | ACTIVE (write side-effect mislabeled read) |
| TOOL-018 inspect_vault_status | Read | No | No | vault.is_unlocked | STORE-003 (lock state only) | ACTIVE |
| TOOL-019 inspect_reminders | Read | No | No | direct reminders.json read (env PW_DATA_DIR) | STORE-006 (bypasses Scheduler) | ACTIVE (duplicate path) |
| TOOL-020 inspect_media_status | Read | No | No | engine.status | PROV-015 | ACTIVE |
| TOOL-021 inspect_media_recent | Read | No | No | engine.recent | PROV-015 | ACTIVE |
| TOOL-022 inspect_media_activity | Read | No | No | engine.activity | PROV-015 | ACTIVE |
| TOOL-023 search_media | Read | No | No | engine.search | PROV-015 | ACTIVE |
| TOOL-024 propose_journal_entry | Write | Yes (in-memory proposal) | Required by contract; approval state carried in execute args | _execute_approved_write → journal.record(source=brain-tool) | JOURNAL-001 | ACTIVE |
| TOOL-025 propose_world_intent | Write | Yes | Same as above | _execute_approved_write → world.set_intent | WORLD-002 | ACTIVE |
| TOOL-026 propose_world_fact | Write | Yes | Same as above | _execute_approved_write → world.record_fact | WORLD-001 | ACTIVE |
| TOOL-027 propose_reminder | Write | Yes | Same as above | executor marks "executed" WITHOUT touching STORE-006 | STORE-006 (intended) | PARTIAL (proposal completes; no reminder written) |
| TOOL-028 propose_reconciler_apply | Write | Yes | Same as above | executor notes only ("actual provider apply requires adapter") | PROV-014 | PARTIAL |
| TOOL-029 execute_approved_write | Write | No (is the executor) | requires_step_up flag set; approval is a model-supplied `approved` boolean | in-memory _proposals dict (per-process, not persisted) | JOURNAL-001 / WORLD-001 / WORLD-002 | PARTIAL (approval semantics are advisory: caller-passed boolean, in-memory store) |

Cross-cutting observations (reality, not fixes):

- All write proposals route through one in-memory `_proposals` dict in
  tool_registry.py; it does not survive restarts and is not exposed to
  the human approval UI. Approval comes back as an argument to
  TOOL-029 from the chat loop.
- TOOL-017 (`run_discovery`) is registered read_write="read" while it
  fetches external content and can persist feedback to
  discovery.json.
- TOOL-019 reads reminders.json directly via `PW_DATA_DIR` env instead
  of the Scheduler singleton, duplicating the API-067 read path.