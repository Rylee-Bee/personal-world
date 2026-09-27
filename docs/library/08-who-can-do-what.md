---
title: Who can do what
kind: book
order: 8
for: everyone
---
Worlds can be shared by a household. Each person has a **role**, and a role
is a bundle of **permissions**.

| Role | Can |
|---|---|
| Owner | Everything, including handing ownership to someone else |
| Admin | Approve things, manage people and rooms, see secret names, install updates |
| Member | Their own space, and what's shared with them |
| Supervised | The same as a member, for now |
| Guest | Only what's shared with them |

* * *

Every check in the code asks one question: "can this person do this?"
(`can(person, "approve")`). No screen decides on its own. An unknown role is
treated as the smallest one.

Sign-in can come from your own sign-in service (for example Authelia). Its
groups map to Worlds roles, so you manage people in one place.

* * *

**Helpers:** one person can help another, for example to see what's waiting
for them. They can act for them only if that was granted. Every grant has an
end.

**Agents** (tools with a token) get narrow scopes like "read" or "notify".
Approving, managing people, secrets and updates stay human actions: no
agent token can ever carry them.

**Learn more:** `docs/IDENTITY-BOUNDARY.md`, `src/personal_world/roles.py`.
