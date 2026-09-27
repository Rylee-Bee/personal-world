---
title: Live, both ways
kind: book
order: 3
for: everyone
---
Worlds used to ask each room "anything new?" every so often. That works, but
it's slow and wasteful, and a screen you're looking at could be a minute
behind.

Now it's two-way.

* * *

**From a room to Worlds:** when a room's data changes, it pings Worlds:
"hive-works changed". The ping carries no content, so the worst a wrong
ping can do is make Worlds look again.

Worlds forgets what it remembered about that room, and tells every open
screen through a live stream. The screens re-read the room within seconds.

* * *

**From Worlds to a room:** what you do in Worlds (answer, merge, riff) goes
to the room as an action. When the room says it worked, Worlds tells the
open screens on your other devices too.

* * *

If the live stream drops, the browser reconnects by itself, and the regular
refresh still runs underneath. Live is a speed-up, never the only way to be
right.

**Learn more:** `docs/ROOMS.md`; the endpoints are `POST
/api/rooms/{id}/changed` and `GET /api/rooms/events`.
