---
title: Secrets
kind: book
order: 6
for: everyone
---
**Say where a secret lives, never what it is.** That one rule covers code,
logs, chat, screenshots and docs.

"The notify token is in the server's private settings file" is fine.
The token itself never appears anywhere but that file.

* * *

In Worlds, the Secrets board shows **names and health only**: which secrets
exist, which are missing, which are old. Never a value.

A value is typed in only once, on the Workshop's trusted page, after
"Confirm it's you". After it's saved, nobody can see it again, including you.
To change one, you type a new one.

* * *

Learned the hard way: tools and helpers leak by accident. A check that
printed "the secret word was…", a VPN tool that exported the server's
private key, an export that included a password. Each was caught in review
and now has a test that fails if it ever comes back.

**Learn more:** `docs/ARCHITECTURE.md` ("Secrets"), `SECURITY.md`.
