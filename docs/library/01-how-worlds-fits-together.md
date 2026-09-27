---
title: How Worlds fits together
kind: book
order: 1
for: everyone
---
Worlds is a small core with everything else around it.

The core keeps what matters to you: facts it has seen, what you want to be
true, your rules, your journal, and your memories. It is small on purpose,
so it can last.

Everything that does the actual work is somewhere else: a provider, or a room.

* * *

A **provider** is a tool Worlds uses, like a model for chat or a place to
keep backups. Providers can be swapped. Worlds works without any of them;
they make it richer.

A **room** is another app that Worlds can show you: the Workshop (Project
Home), the Engine room (the homelab), Studio, Candy, Hive Works. Each room
owns its own data. Worlds shows what the room says and passes your answers
back. It never copies a room's code.

* * *

Worlds never reimplements a tool that already exists: Git, Docker, your
secret store. It asks them and shows you the answer.

That's why Worlds can stay small and honest. It is the place where
everything comes to you, not the place where everything is built.

**Learn more:** `docs/ARCHITECTURE.md` ("The one idea", "World model").
