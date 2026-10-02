# Plan: Worlds rooms + recipes (rebuild/front-door)

Goal: finish the room and recipe backlog. You do NOT write code: workers do, via `offload agent`. You dispatch, verify, report honestly. Python tests: `uv run --extra test --extra crypto pytest --timeout=30 -q <path>`. Contracts live in docs/rebuild/CONTRACTS.md (C1, C2, C3, C8); read the sections a task touches and put them in the worker's brief.

## Tasks (run IN ORDER; they share models.py / recipes.py / test files; commit each accepted task locally before the next)
| ID | What | Acceptance | Tier |
|---|---|---|---|
| T4 | Room actions can carry typed `choices` and an `allow_text` field (room/0 /room/actions descriptor, see docs C8 and contracts/surfaces/ROOM.md if present in the repo). Answering a room need from Worlds goes through the C3 dispatcher like any write (approve -> consume -> dispatch at most once). Add `test_action_with_choices_prefills_request`. | `uv run --extra test --extra crypto pytest --timeout=30 -q tests/worlds/test_dispatcher.py tests/worlds/test_room0.py` | `-m code` |
| T5 | Room `/changed` ping (ROOM rule 15): a room may signal a change out of band; Worlds then invalidates that room's cache so the next read refetches (it never dispatches an action). Add `test_room_changed_ping_invalidates_cache`. | `uv run --extra test --extra crypto pytest --timeout=30 -q tests/worlds/test_room0.py -k changed` | `-m code` |
| T9 | New auth kind `cookie_session` (qBittorrent style: POST login, hold the session cookie in memory only, re-login on 403) in the provider model + reference provider/runner, plus a sanitised `config/recipes/qbittorrent/` recipe in the existing recipe-directory format (look at config/recipes/sonarr/ for the shape; read-only requests; synthetic example host; `verified: false`). Secrets only via secret_ref; the cookie is never logged or persisted. | `uv run --extra test --extra crypto pytest --timeout=30 -q tests/recipes tests/worlds/test_runner.py -k "qbittorrent or cookie"` | `-m code` |
| T10 | New auth kind `password_grant` (Grimmory style: POST credentials to a token endpoint, hold the bearer token in memory, refresh on 401) mirroring T9, plus `config/recipes/grimmory/` (`verified: false`). | `uv run --extra test --extra crypto pytest --timeout=30 -q tests/recipes tests/worlds/test_runner.py -k "grimmory or password_grant"` | `-m code` |
| T11 | Room-recipe install path: the recipe loader (src/personal_world/worlds/recipes.py) recognises room recipes (config/recipes/project-home, config/recipes/discovery-room, currently marked `planned`) and installs them like other recipes; remove the `planned` marker only when installable. Add `test_room_recipe_install_routes_through_loader`. Existing tests forbid the word "candy" in recipes: keep that. | `uv run --extra test --extra crypto pytest --timeout=30 -q tests/recipes` | `-m code` |
| T12 | OpenAPI import: `recipes.py` gets `from_openapi(doc)` that turns an OpenAPI 3 document into sanitised provider + GET-only request skeletons (never writes; unknown auth schemes become a TODO note, never guessed). Add `test_openapi_import_emits_provider_request_skeleton` and a test that a POST path is not imported as a request. | `uv run --extra test --extra crypto pytest --timeout=30 -q tests/recipes -k openapi` | `-m code` |

Final gate for the whole plan: `uv run --extra test --extra crypto pytest --timeout=30 -q tests/worlds tests/recipes` and `uv run personal-world framework validate --json` pass.

## How to delegate
Write each worker brief to /tmp/briefs/<id>.md with a Bash heredoc (goal, exact allowed files, quoted contract text, constraints, ONE acceptance command), then:
`offload agent -m code --repo . --brief /tmp/briefs/T4.md --name t4 "Implement T4 per the brief"`
It prints a `--- apply:` command; run it, then run the acceptance yourself. A worker's claim is worth nothing; your acceptance run is the truth. Commit accepted work locally (`git add -A && git commit -m "T4: ..."`); never push.
Allowed files: `src/personal_world/worlds/{models,dispatcher,room0,room_routes,runner,reference_provider,recipes}.py`, `config/recipes/**`, `tests/worlds/**`, `tests/recipes/**`, `docs/rebuild/CONTRACTS.md` (only to document what a task adds). Any other file touched = reject the patch.

## Budget and rules
- At most 12 worker runs total (retries count). A retry needs a new brief quoting the failing output. 60 minutes wall clock.
- Never weaken or delete an existing test. If a test or contract contradicts a brief, do NOT work around it: stop that task and report the conflict.
- No raw secrets anywhere; recipes use `secret_ref` and synthetic hosts. Never deploy, push, or contact the network.
- If a worker fails twice on a task, mark it blocked and move on (later tasks that depend on it are blocked too).

## Final report (your last message ENDS with this JSON on one line)
{"tasks": {"T4": "done|blocked|escalated", ...}, "worker_runs": <int>, "acceptance_pass": {"T4": true|false, ...}, "escalations": ["short reason", ...]}
Before it: 3-6 plain sentences on what is verified, what is not, and anything the owner must decide.
