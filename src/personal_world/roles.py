"""Roles and permissions — the one place code asks "can this person do X?".

Direction (owner-approved 2026-09-26): roles are *bundles of
permissions*. Code never checks a role name; it asks
``can(principal, permission)``. That keeps one answer for every app
(Worlds, Project Home, Candy) and makes a new role a table entry, not a
grep.

This module is **pure**: no I/O, no env reads, no imports from the
package. It reasons only about the ``Principal`` it is handed (duck
typed: ``id``/``kind``/``owner_id``/``scopes``/``role``), so it can be
imported anywhere without a cycle and tested without a store.

Roles (a grant, not an account type)
------------------------------------

``owner`` · ``admin`` · ``member`` · ``supervised`` · ``guest``

``supervised`` is exactly ``member`` for now — the narrowing (content
boundaries, no outside sharing) is step 2 and lands as *limits layered
on the role*, never as a different permission set here. ``guest`` is
``see_shared`` only; its "only what is shared with me" narrowing is
step 2 too. **Agents are not a role**: an agent is a principal of
``kind == "agent"`` whose reach is the lesser of its token scopes and
its owner's permissions.

``helper`` is likewise a grant layered on any account, not a role; its
per-person ``see_needs_of`` / ``act_for`` permissions arrive in step 2.
``can(..., target=...)`` already accepts the target those grants will
need and ignores it today.

Group mapping
-------------

Authelia (or any OIDC provider) may assert ``groups``; ``PW_ROLE_GROUPS``
maps those group names to roles, e.g.
``admin=admin,users=member,kids=supervised,guests=guest``. The highest
privilege wins when several groups match. ``owner`` can never come from a
group — ownership is the install's, not the IdP's — so an entry naming
``owner`` is ignored and logged.
"""

from __future__ import annotations

import logging
from typing import Any

_logger = logging.getLogger("personal_world.roles")

#: The closed set of roles. Order is highest privilege first.
ROLES: tuple[str, ...] = ("owner", "admin", "member", "supervised", "guest")

#: The closed set of permissions code is allowed to check. An unknown
#: permission fails closed (``can`` returns False) rather than raising,
#: so a typo can never widen access.
PERMISSIONS: tuple[str, ...] = (
    "own_space",
    "see_shared",
    "approve",
    "manage_people",
    "manage_rooms",
    "estate_secrets",
    "updates",
    "transfer_ownership",
)

#: The role → permission bundle. This is the plan's table, exactly.
ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "owner": frozenset(PERMISSIONS),
    "admin": frozenset(
        {
            "own_space",
            "see_shared",
            "approve",
            "manage_people",
            "manage_rooms",
            "estate_secrets",
            "updates",
        }
    ),
    # supervised == member for now (limits are step 2).
    "member": frozenset({"own_space", "see_shared"}),
    "supervised": frozenset({"own_space", "see_shared"}),
    # guest sees only what is shared with them (narrowing is step 2).
    "guest": frozenset({"see_shared"}),
}

#: Which token scopes may ever carry a permission for an agent. A
#: permission absent from this map can never belong to an agent (fail
#: closed) — notably ``approve``/``manage_*``/``estate_secrets``/
#: ``updates``/``transfer_ownership``, which stay human actions.
AGENT_SCOPE_PERMISSIONS: dict[str, frozenset[str]] = {
    "own_space": frozenset({"write", "journal"}),
    "see_shared": frozenset({"read"}),
}

#: Privilege order for "highest match wins" (lower rank = higher).
_ROLE_RANK: dict[str, int] = {role: rank for rank, role in enumerate(ROLES)}


def effective_role(principal: Any) -> str:
    """The role a principal is treated as, or ``"member"``.

    An explicit non-default ``role`` wins. A principal still carrying the
    **legacy ``admin`` scope** (pre-roles records and callers) is read as
    ``admin`` for back-compat; new code writes ``role`` and never the
    scope. An unknown/missing role is the fail-safe ``member`` — the
    least privilege that still owns a space — never owner or admin.
    """
    if principal is None:
        return "member"
    role = getattr(principal, "role", None)
    if isinstance(role, str) and role in ROLE_PERMISSIONS and role != "member":
        return role
    # Legacy bridge: the old `admin` scope still means admin.
    if getattr(principal, "kind", "person") == "person":
        scopes = getattr(principal, "scopes", ()) or ()
        if "admin" in scopes:
            return "admin"
    if isinstance(role, str) and role in ROLE_PERMISSIONS:
        return role
    return "member"


def _role_has(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


def can(principal: Any, permission: str, *, target: str | None = None) -> bool:
    """Can this principal do ``permission``? The one authorization question.

    Fail closed at every branch:

    * an unknown permission → ``False`` (never raise, never widen);
    * no principal → ``False``;
    * an **agent** → only if the permission is one an agent scope may
      carry AND the agent holds such a scope AND its **owner** also has
      the permission (the lesser of scopes and the person);
    * a **person** → whether the role bundle contains the permission.

    ``target`` is reserved for step 2 helper grants
    (``see_needs_of:<person>`` / ``act_for:<person>``). It is accepted
    and **ignored** today so those call sites can be written now; it must
    never silently change an answer before the grant model exists.
    """
    if permission not in PERMISSIONS:
        return False
    if principal is None:
        return False
    if getattr(principal, "kind", "person") == "agent":
        scope_ok = AGENT_SCOPE_PERMISSIONS.get(permission)
        if not scope_ok:
            return False
        if not (scope_ok & set(getattr(principal, "scopes", ()) or ())):
            return False
        # ``role`` on an agent principal carries its OWNER's role (set at
        # resolution); the owner must also have the permission.
        return _role_has(effective_role(principal), permission)
    return _role_has(effective_role(principal), permission)


def permissions_for(principal: Any) -> list[str]:
    """Every permission this principal holds, in ``PERMISSIONS`` order."""
    return [p for p in PERMISSIONS if can(principal, p)]


def role_for_groups(groups: list[str], mapping: str) -> str | None:
    """Map OIDC ``groups`` to a role via ``PW_ROLE_GROUPS``.

    ``mapping`` is ``group=role`` pairs, comma-separated. When several of
    the person's groups match, the highest privilege wins. Returns
    ``None`` when nothing matches (the caller keeps the stored role).
    An entry naming ``owner`` is ignored and logged: ownership is never
    granted by an external group.
    """
    if not groups or not mapping:
        return None
    group_roles: dict[str, str] = {}
    for entry in mapping.split(","):
        group, sep, role = entry.partition("=")
        group = group.strip()
        role = role.strip()
        if not sep or not group or not role:
            continue
        if role == "owner":
            _logger.warning(
                "PW_ROLE_GROUPS maps group %r to owner; ownership cannot "
                "come from a group — entry ignored",
                group,
            )
            continue
        if role not in ROLE_PERMISSIONS:
            continue
        group_roles[group] = role
    best: str | None = None
    for group in groups:
        role = group_roles.get(group)
        if role is None:
            continue
        if best is None or _ROLE_RANK[role] < _ROLE_RANK[best]:
            best = role
    return best