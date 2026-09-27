---
title: Rooms
kind: book
order: 2
for: everyone
---
A room is any app that speaks one small language, the **room contract**:
five doors that Worlds knocks on.

- **Who are you, and are you well?** (`GET /room`)
- **What's new?** Cards (`/room/cards`).
- **What needs a person?** Needs (`/room/needs-you`).
- **What can I ask you to do?** Actions (`/room/actions`).
- **Please do this.** One action (`POST /room/actions/{id}`).

* * *

Any app that answers those doors can be a room. Worlds learns the list of
rooms at runtime from the Workshop, so adding a room needs no Worlds release.

Every room has its own token (a password for Worlds to use). The token lives
in the server's private settings, never in the code.

* * *

**The room owns its data.** When you answer something in Worlds, Worlds
passes your answer to the room, and the room decides. The room writes a
**receipt**, and only the receipt says whether anything changed. Worlds
never says "done" on a room's behalf.

**Every action carries a key** (an idempotency key). If your phone sends the
same tap twice, the room does it once.

* * *

**Links open on the room's own site, never through Worlds.** A pass-through
would hand every room your Worlds sign-in.

The one exception is pictures: an image can't carry the room's token, so
Worlds passes a room's pictures through itself. It lets only real image
files through (it checks their first bytes), never a page or a script.

* * *

**One way to answer.** A need can offer up to six choices, and sometimes
room for your own words. Worlds answers every need the same way; the room
routes the answer to the right place. Learned the hard way: when each kind
of need had its own action, a Merge tap went to the wrong one and was
quietly refused.

**Learn more:** `docs/ROOMS.md`; the contract lives in Play-Nice (`room/0`).
