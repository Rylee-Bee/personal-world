# Worlds Next UI — Build Questions Handoff

These are the questions whose answers would let me build this product
correctly. Answer as many or as few as you want — each one resolves
an ambiguity I'd otherwise guess at.

Organized by impact: the earlier questions unblock more work.

---

## Direction & feel

**1.** The orchestration says "lean and serene." You said "a little more
dashboardy." Where on this spectrum do you actually want to land?

```
literary/ambient ←————————→ functional/dashboard
(journal feel)               (admin panel feel)
```

Is it closer to "warm Notion" or "calm Linear" or something else?

**2.** The orchestration defines five volume registers (Generous → Ambient
→ Practical → Attentive → Quiet). For the DEFAULT state of each
screen, which register should it be in? Or should I just use my
judgment?

**3.** How much do you care about the companion artwork in the actual
product? Should it be:
- A meaningful presence on every screen (orchestration's intent)
- A subtle accent on Today/World only
- Optional/decorative, easily off
- Not a priority right now

---

## What's real vs aspirational

**4.** Which screens are you actually using day-to-day right now? (Today,
Journal, Chat, Projects, Vault, Settings, Lab…?) Knowing what's
real helps me prioritize wiring over polish.

**5.** Does the `/api/chat` endpoint actually have working threads/messages
persistence, or is it a single-turn conversation right now? The
orchestration describes durable threads with attachments — is that
built or planned?

**6.** Is there actual data flowing through the Interests and Media
sections, or are they still the honest empty states the CURRENT.md
describes?

**7.** Does the "World" overview (`/world`) show real structured state
(facts, intent, policies, actors) or is it a basic status page?

**8.** Are there real notifications/reminders firing, or is the reminders
system mostly set up but unused?

---

## Navigation & structure

**9.** The "world" section doesn't exist in the backend's `/api/sections`
endpoint — it's a frontend-only route. Should I keep it synthesized
in the nav, or does the backend need to add it?

**10.** The orchestration mentions "Connections" as a separate section from
Settings. Does `/connections` exist as a route, or is it a tab
within Settings?

**11.** Should deep links like `/projects?repo=my-repo` still work after
the navigation restructure? Any specific deep links you rely on?

**12.** The Places popover — is a popover the right mechanism, or would
you prefer a slide-out drawer, a full page, or a dropdown menu?

---

## Today screen

**13.** For the Today "quiet day" — what's the most important thing you
want to see at a glance? Health status? Recent journal? Active
reminders? Or just the greeting and silence?

**14.** The health stars/meter — keep them, replace with something else,
or remove entirely?

**15.** The "Run Daily Loop" button — is this something you actually use,
or should it be buried deeper / removed from Today?

**16.** When there are project attention items (dirty tree, ahead/behind),
how prominently should they surface? Card-level? Inline list?
Notification-style?

---

## Visual & typography

**17.** The design tokens define `Young Serif` for expressive headings and
`Instrument Sans` for interface text. Are these the right fonts, or
are they just what was in the Figma exploration?

**18.** Color: the tokens have rose (#b57f8b), teal (#72b1b1), and gold
(#e4c58d) as personality colors. Are these the right accent
palette, or do you want to adjust?

**19.** Dark mode is the default. Is light mode something you actually
use/need working, or is it "nice to have"?

**20.** The sidebar — the orchestration says "restrained navigation band"
and "no permanent large sidebar." The current implementation has
a 112px rail (Today) and ~248px sidebar (other screens). Are
these widths right?

---

## Chat & assistant

**21.** The "World Assistant" drawer that opens from the companion — is
this the primary chat interface, or do you use the dedicated
`/chat` route more?

**22.** Should contextual "Ask about this" actions on other screens
open the assistant drawer or navigate to `/chat`?

**23.** The orchestration says "changing routes does not mutate an existing
thread." Is this behavior currently working, or does the chat
reset when you navigate?

---

## Data & persistence

**24.** The orchestration describes "structured assessment records" for
Today (question, reservation, attention items with evidence). Is
there a backend endpoint for these, or do I need to derive them
from existing data (capabilities, source control, journal)?

**25.** Journal entries — do you distinguish "personal writing" from
"machine events" in practice, or does the journal contain a mix?

**26.** For the Vault — is this actively used? Should the Vault screen
be prominent in Places or buried?

---

## Responsive & accessibility

**27.** Do you actually use this on a phone? If so, which phone and
orientation? Knowing the real device helps me prioritize mobile
polish.

**28.** The 44px minimum touch target — is this a hard requirement you
want enforced everywhere, or a guideline?

**29.** Text scaling — do you use browser zoom or OS text scaling? The
orchestration requires 200% zoom support. Is this tested?

---

## Scope & priorities

**30.** If you could only have THREE screens fully wired and polished
for checkpoint 1, which three? (I'd guess Today, Chat, Journal
but want to confirm.)

**31.** What's the minimum viable "this feels like a different product"
for you? Is it the new navigation + Today? Or does it need more?

**32.** Are there any screens you actively DON'T want me to touch right
now? (e.g., Vault is sensitive, Lab is in flux, etc.)

**33.** The orchestration has 17 implementation phases. Realistically,
what's the most important 20% that delivers 80% of the value?

---

## Technical

**34.** The container at `:8000` is running the published GHCR image
(main branch). Should I build from this worktree's code instead,
or is the dev server at `:5173` sufficient for previewing?

**35.** Should I run the Playwright E2E tests against the new UI, or
are those testing the old shell structure and would just break?

**36.** The existing 349 frontend tests — should I be adding new tests
for the new nav/today state projection, or is "doesn't break
existing tests" sufficient for now?

---

## The product question

**37.** The orchestration's D4 checkpoint question is "Are we actually
building the right product now?" What would make you answer YES
to that? What's the single most important thing the new UI needs
to get right?

**38.** What do you hate most about the current UI? What makes you
want to change it? (This is the real north star for what to fix
first.)

**39.** When you imagine using this product every morning, what's the
first thing you want to see and feel?

---

*Answer on any schedule. Each answer lets me move faster with more
confidence and less rework.*
