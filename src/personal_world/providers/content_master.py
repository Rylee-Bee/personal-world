"""Master content database: indexes across all per-repo content DBs.

The master never holds repo content — it holds a registry of repos
and fans out searches to each repo's ContentDB. Results are merged
and ranked across repos.

Discovery is automatic: scan a root directory for repos with
data/content.db or repos that match known patterns, create DBs
where needed, and keep the registry fresh.
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .content_db import ContentDB, _file_hash

MASTER_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repos (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE,
    path        TEXT    NOT NULL UNIQUE,
    repo_kind   TEXT    NOT NULL DEFAULT 'project',
    item_count  INTEGER NOT NULL DEFAULT 0,
    last_scan   TEXT    NOT NULL DEFAULT '',
    last_seen   TEXT    NOT NULL DEFAULT '',
    metadata    TEXT    NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_repos_kind ON repos(repo_kind);
CREATE INDEX IF NOT EXISTS idx_repos_last_seen ON repos(last_seen);
"""

# Known repo patterns — if a dir has one of these, it's a repo worth indexing.
_REPO_MARKERS = [
    "AGENTS.md",
    "README.md",
    "pyproject.toml",
    "package.json",
    "Cargo.toml",
    "compose.yaml",
    "compose.yml",
    ".git",
]

# Repo classification by marker presence.
_REPO_KINDS = {
    "compose.yaml": "infrastructure",
    "compose.yml": "infrastructure",
    "Cargo.toml": "rust",
    "pyproject.toml": "python",
    "package.json": "node",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ContentMaster:
    """Master content database — indexes repos, fans out searches."""

    def __init__(self, db_path: Path, code_root: Path | None = None):
        self.db_path = db_path
        self.code_root = code_root
        self._conn: sqlite3.Connection | None = None
        self._repo_dbs: dict[str, ContentDB] = {}

    def _connect(self) -> sqlite3.Connection:
        if self._conn is None:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.executescript(MASTER_SCHEMA)
            self._conn.execute(
                "INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)",
                ("schema_version", "1"),
            )
            self._conn.commit()
        return self._conn

    def close(self) -> None:
        for db in self._repo_dbs.values():
            db.close()
        self._repo_dbs.clear()
        if self._conn:
            self._conn.close()
            self._conn = None

    def _get_repo_db(self, repo_path: str) -> ContentDB:
        """Get or open a repo's ContentDB. Cached per-path."""
        if repo_path not in self._repo_dbs:
            db_path = Path(repo_path) / "data" / "content.db"
            self._repo_dbs[repo_path] = ContentDB(db_path)
        return self._repo_dbs[repo_path]

    # ── Discovery ──

    def discover(
        self, root: Path | None = None, *, force: bool = False
    ) -> dict[str, Any]:
        """Scan a root directory for repos and register them.

        For each repo found:
        1. Register in the master's repos table.
        2. Open (or create) that repo's content.db.
        3. Run discover() on the repo to index its content.
        4. Update item count and timestamps.

        Returns summary of what was found/updated.
        """
        scan_root = root or self.code_root
        if not scan_root or not scan_root.is_dir():
            return {"error": f"root not found: {scan_root}", "repos_found": 0}

        conn = self._connect()
        now = _now()
        found = 0
        indexed = 0
        errors = []

        for entry in sorted(scan_root.iterdir()):
            if not entry.is_dir() or entry.name.startswith("."):
                continue

            # Check if it looks like a repo
            repo_kind = _classify_repo(entry)
            if repo_kind is None:
                continue

            name = entry.name
            path_str = str(entry)
            found += 1

            # Register in master
            conn.execute(
                """INSERT INTO repos (name, path, repo_kind, last_seen)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(name) DO UPDATE SET
                       path=excluded.path, repo_kind=excluded.repo_kind,
                       last_seen=excluded.last_seen""",
                (name, path_str, repo_kind, now),
            )

            # Index the repo's content
            try:
                repo_db = self._get_repo_db(path_str)
                count = repo_db.discover(entry, force=force)
                indexed += count

                # Update stats
                stats = repo_db.stats()
                conn.execute(
                    "UPDATE repos SET item_count = ?, last_scan = ? WHERE name = ?",
                    (stats["total_items"], now, name),
                )
            except Exception as e:
                errors.append(f"{name}: {e}")

        conn.commit()
        return {
            "repos_found": found,
            "items_indexed": indexed,
            "errors": errors,
        }

    def register_repo(self, name: str, path: str, kind: str = "project") -> None:
        """Manually register a repo (for repos outside the scan root)."""
        conn = self._connect()
        conn.execute(
            """INSERT INTO repos (name, path, repo_kind, last_seen)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(name) DO UPDATE SET
                   path=excluded.path, repo_kind=excluded.repo_kind,
                   last_seen=excluded.last_seen""",
            (name, path, kind, _now()),
        )
        conn.commit()

    def remove_repo(self, name: str) -> bool:
        """Unregister a repo (does not delete its content.db)."""
        conn = self._connect()
        cur = conn.execute("DELETE FROM repos WHERE name = ?", (name,))
        conn.commit()
        self._repo_dbs.pop(name, None)
        return cur.rowcount > 0

    # ── Search ──

    def search(
        self,
        query: str,
        *,
        kind: str | None = None,
        repo: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """Search across all registered repos.

        Fans out to each repo's FTS5, merges results, ranks by
        relevance. Optionally filter by content kind or repo name.
        """
        conn = self._connect()
        repos = self._get_search_repos(conn, repo)

        all_results: list[dict[str, Any]] = []
        repos_searched = 0
        errors = []

        for repo_row in repos:
            repo_name = repo_row[0]
            repo_path = repo_row[1]
            try:
                repo_db = self._get_repo_db(repo_path)
                results = repo_db.search(query, kind=kind, limit=limit)
                for r in results:
                    r["repo"] = repo_name
                    r["repo_path"] = repo_path
                all_results.extend(results)
                repos_searched += 1
            except Exception as e:
                errors.append(f"{repo_name}: {e}")

        # Sort by FTS5 rank (already sorted per-repo, but merged list
        # needs re-sort). FTS5 rank is negative — more negative = better.
        # We don't have the raw rank, so sort by recency as tiebreaker.
        all_results.sort(key=lambda r: r.get("updated_at", ""), reverse=True)
        all_results = all_results[:limit]

        return {
            "results": all_results,
            "query": query,
            "count": len(all_results),
            "repos_searched": repos_searched,
            "errors": errors,
        }

    def _get_search_repos(
        self, conn: sqlite3.Connection, repo: str | None
    ) -> list[tuple]:
        """Get repos to search. Filter by name if specified."""
        if repo:
            return conn.execute(
                "SELECT name, path FROM repos WHERE name = ?", (repo,)
            ).fetchall()
        return conn.execute("SELECT name, path FROM repos").fetchall()

    # ── Read ──

    def list_repos(self) -> list[dict[str, Any]]:
        """List all registered repos with stats."""
        conn = self._connect()
        rows = conn.execute(
            "SELECT name, path, repo_kind, item_count, last_scan, last_seen "
            "FROM repos ORDER BY last_seen DESC"
        ).fetchall()
        return [
            {
                "name": r[0],
                "path": r[1],
                "kind": r[2],
                "item_count": r[3],
                "last_scan": r[4],
                "last_seen": r[5],
            }
            for r in rows
        ]

    def repo_content(
        self, repo_name: str, kind: str | None = None, limit: int = 100
    ) -> list[dict[str, Any]]:
        """List content from a specific repo."""
        conn = self._connect()
        row = conn.execute(
            "SELECT path FROM repos WHERE name = ?", (repo_name,)
        ).fetchone()
        if not row:
            return []
        repo_db = self._get_repo_db(row[0])
        return repo_db.list_content(kind=kind, limit=limit)

    def get_item(self, repo_name: str, path: str) -> dict[str, Any] | None:
        """Get a specific item from a specific repo."""
        conn = self._connect()
        row = conn.execute(
            "SELECT repos.path FROM repos WHERE repos.name = ?", (repo_name,)
        ).fetchone()
        if not row:
            return None
        repo_db = self._get_repo_db(row[0])
        item = repo_db.get(path)
        if item:
            item["repo"] = repo_name
        return item

    # ── Write (cross-repo) ──

    def store(
        self,
        repo_name: str,
        path: str,
        kind: str,
        body: str,
        **kwargs: Any,
    ) -> bool:
        """Store content in a specific repo's DB. Auto-registers the
        repo if not already known. Returns True on success."""
        conn = self._connect()
        row = conn.execute(
            "SELECT path FROM repos WHERE name = ?", (repo_name,)
        ).fetchone()
        if not row:
            # Auto-register — we need the path
            if self.code_root:
                repo_path = str(self.code_root / repo_name)
            else:
                return False
            conn.execute(
                "INSERT OR IGNORE INTO repos (name, path, repo_kind, last_seen) "
                "VALUES (?, ?, ?, ?)",
                (repo_name, repo_path, "project", _now()),
            )
            conn.commit()
        else:
            repo_path = row[0]

        repo_db = self._get_repo_db(repo_path)
        repo_db.upsert(path, kind, body, **kwargs)

        # Update item count
        stats = repo_db.stats()
        conn.execute(
            "UPDATE repos SET item_count = ?, last_scan = ? WHERE name = ?",
            (stats["total_items"], _now(), repo_name),
        )
        conn.commit()
        return True

    # ── Stats ──

    def stats(self) -> dict[str, Any]:
        """Master-level stats for observe() / health reporting."""
        conn = self._connect()
        repo_count = conn.execute("SELECT COUNT(*) FROM repos").fetchone()[0]
        total_items = (
            conn.execute("SELECT SUM(item_count) FROM repos").fetchone()[0] or 0
        )
        last_scan = conn.execute("SELECT MAX(last_scan) FROM repos").fetchone()[0]
        by_kind = {}
        for row in conn.execute(
            "SELECT repo_kind, COUNT(*) FROM repos GROUP BY repo_kind"
        ):
            by_kind[row[0]] = row[1]
        return {
            "repo_count": repo_count,
            "total_items": total_items,
            "repos_by_kind": by_kind,
            "last_scan": last_scan or "",
            "db_path": str(self.db_path),
        }


def _classify_repo(path: Path) -> str | None:
    """Check if a directory looks like a repo. Returns repo kind or None."""
    for marker in _REPO_MARKERS:
        if (path / marker).exists():
            return _REPO_KINDS.get(marker, "project")
    return None
