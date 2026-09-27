---
title: How a change reaches you
kind: book
order: 10
for: everyone
---
Every change to Worlds starts as a **pull request**: a proposed change that
checks run against. Tests, the browser checks, security scanning and
accessibility checks all have to pass.

When it's merged, the build server makes a **container image** for that
exact version, labelled with its commit (a short code like `a955167`).

* * *

Deploying means the server pulls that image and restarts Worlds with it,
after taking a backup. Worlds then reports which version it's running at
`/healthz`, so "is it live?" has a checkable answer.

Learned the hard way: sometimes the image build is skipped for a commit. So
a deploy waits for the image of **that** commit, not just the newest one.
Otherwise you "deploy" and get the old version.

* * *

**The last step is your phone.** An installed app can stay open in memory
for days and never reload. Worlds now remembers the version it opened with.
When a newer one is live, it reloads the next time you come back to it,
unless you're in the middle of typing. Then it says "Worlds was updated"
with a Reload button, and waits for you.

**Learn more:** `docs/OPERATIONS.md`, `docs/CI-ENVIRONMENT-NOTES.md`.
