# The Worlds library

> **Status:** Current · **Verified:** 2026-09-27 · **Canonical for:** nothing (plain-words teaching; each book points to the doc that is canonical) · **Read this if:** you want to understand how Worlds works and why, without reading code.

**In short:** short books that teach how Worlds works: how the pieces fit,
how the screens are layered, and the lessons learned the hard way building
it. They are written for people first (any tech level), and agents may read
them too.

Each book is a Markdown file with a small header (`title`, `kind: book`,
`order`, `for`) and pages separated by `* * *`, the same format as VEFR's
Library. That way Worlds can show them in the app later without changing a word.

| # | Book | What it teaches |
|---|---|---|
| 01 | [How Worlds fits together](01-how-worlds-fits-together.md) | The small core, the providers, and the rooms around it |
| 02 | [Rooms](02-rooms.md) | How other apps show up in Worlds, and why Worlds never copies them |
| 03 | [Live, both ways](03-live-both-ways.md) | How a change in one app shows up in Worlds within seconds |
| 04 | [How the screens are layered](04-how-the-screens-are-layered.md) | Tokens, themes, your own settings, and the parts nobody can change |
| 05 | [Honest by default](05-honest-by-default.md) | "Unknown" is an answer; nothing claims to be fine without proof |
| 06 | [Secrets](06-secrets.md) | Say where a secret lives, never what it is |
| 07 | [Every setup checks itself](07-every-setup-checks-itself.md) | No config files to edit; the same tools for everyone |
| 08 | [Who can do what](08-who-can-do-what.md) | Roles, permissions, helpers, and what agents may never do |
| 09 | [Notifications](09-notifications.md) | Three tiers, quiet hours, private notes, and iPhone |
| 10 | [How a change reaches you](10-how-a-change-reaches-you.md) | From a pull request to the app on your phone |
| 11 | [Lessons learned the hard way](11-lessons-learned-the-hard-way.md) | The mistakes that shaped the rules |

**Adding a book:** keep it short (a page is a few short paragraphs), use
plain words, say what is true today, and end with a "Learn more" line
pointing to the canonical doc. When a book and a canonical doc disagree,
the canonical doc wins; fix the book in the same pull request.
