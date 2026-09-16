/* ═══════════════════════════════════════════════════════════════
   PROJECTS CONTENT VIEW — a simplified GitHub-like repository panel
   for the Station prototype. Rendered into #projects-view, below the
   systems map, on projects.html. Styling: projects-view.css.

   HONESTY CONTRACT (HANDOFF-UI-FIX.md §2)
   · Every record below is SPECIMEN and is labelled specimen in the
     DOM. Nothing is fetched. None of it is your work.
   · The shapes mirror the real READ envelopes, so wiring this later
     is a swap, not a rewrite:
       API-079 GET  /api/projects/status           project estate
       API-033 GET  /api/source-control/status     branch/ahead/behind/dirty
       API-034 GET  /api/source-control/history    newest-first commits
       API-036 GET  /api/source-control/enrichment remote facts (gh session)
   · The ONE write in this domain — API-035 POST
     /api/source-control/refresh — is never called, simulated, faked,
     or implied. "Propose refresh" is a GATE: it opens an explanation
     of observe → diff → propose → approve → act → re-observe and says
     plainly that nothing was written.
   · Status is never colour-alone: healthy / needs_attention / dirty /
     diverged / unknown each render as a word, with the canonical
     vocabulary one disclosure down.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MOUNT = 'projects-view';

  /* canonical status → the plain word shown on the surface */
  var WORD = {
    healthy:         'all good',
    needs_attention: 'needs you',
    dirty:           'work in progress',
    diverged:        'diverged',
    unknown:         'not sure yet'
  };

  /* The safe write path. Steps 1-3 are what this prototype can show
     (as specimen). Steps 4-6 need a live, signed-in world and a
     step-up approval, and are honestly marked as not wired. */
  var STEPS = [
    {
      name: 'Observe',
      why: 'Look without touching. Read-only: which repositories exist, what branch each is on, how far ahead or behind it is, and which files are dirty.',
      tech: 'API-033 GET /api/source-control/status · API-079 GET /api/projects/status (agent-sync observation; carries its own observed_at, so it stays a dated observation rather than timeless truth)',
      shown: true
    },
    {
      name: 'Diff',
      why: 'Show exactly what would change — in plain words first, then the lines. No hidden scope, no surprises at the end.',
      tech: 'API-034 GET /api/source-control/history?repo=&limit= for context; the diff itself is computed read-only, never applied',
      shown: true
    },
    {
      name: 'Propose',
      why: 'Write down one named action with what it does, why, which tool it uses, what the risk is, and what to expect. Then it waits for you.',
      tech: 'proposal rendered by UI-004 Projects; agreement anywhere else is never authorization',
      shown: true
    },
    {
      name: 'Approve',
      why: 'You say yes explicitly, and the world re-checks who you are at the moment of action rather than trusting an earlier session.',
      tech: 'API-035 POST /api/source-control/refresh — require_step_up, person-scoped',
      shown: false
    },
    {
      name: 'Act',
      why: 'The single approved action runs. Here that is deliberately small: re-run the read-only git status for ONE repository. Then it is written down — who proposed, what was approved, what happened, which tool, what came back, and when.',
      tech: 'API-035 → PROV-001 NativeGit → journaled as a provider action',
      shown: false
    },
    {
      name: 'Re-observe',
      why: 'Look again and show you the new state, so you can see what actually happened instead of trusting the promise that something did.',
      tech: 'API-033 again · API-036 GET /api/source-control/enrichment for remote facts (not_configured when there is no gh session)',
      shown: false
    }
  ];

  /* ── SPECIMEN DATA ─────────────────────────────────────────────
     Five repositories, one per honest state, so the panel can show
     every state the real domain has — including the calm one. */
  var REPOS = [
    {
      id: 'personal-world',
      name: 'personal-world',
      status: 'dirty',
      branch: 'main',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
      work: '9 changes in the working tree — 7 modified, 2 untracked, 0 conflicted',
      sentence: 'Published state is safe; your local work is still in progress. Nothing is lost and nothing is urgent — a dirty tree is information.',
      observed: 'observed 2 hours ago · a dated observation, not timeless truth',
      enrichment: 'remote facts available: 4 open pull requests · last remote push 2 hours ago',
      tree: {
        state: 'observed',
        rows: [
          {
            kind: 'dir', name: 'src/', when: '2 days ago',
            note: 'the world model, providers, and the API',
            children: [
              { kind: 'file', name: 'api.py', when: '2 days ago', note: 'routes, including the four source-control reads' },
              { kind: 'file', name: 'source_control.py', when: '1 week ago', note: 'native git baseline — read-only by default' },
              { kind: 'dir', name: 'providers/', when: '2 days ago', note: 'adapters; each one degrades honestly' }
            ]
          },
          { kind: 'dir', name: 'frontend/', when: 'today', note: 'React surfaces, tokens, browser gates' },
          { kind: 'dir', name: 'docs/', when: '2 days ago', note: 'architecture, accessibility contract, surface registry' },
          { kind: 'dir', name: 'design/', when: 'today', note: 'tokens, companion art, this exploration', flag: 'modified' },
          { kind: 'file', name: 'AGENTS.md', when: 'yesterday', note: 'truth-routing rules for agents' },
          { kind: 'file', name: 'ROADMAP.md', when: '1 week ago', note: 'direction, not promises' },
          { kind: 'file', name: 'pyproject.toml', when: '1 week ago', note: 'package and tool configuration' }
        ]
      },
      commits: {
        state: 'observed',
        rows: [
          { hash: '7c41a9e', subject: 'projects: a content view under the map — repo, tree, commits', when: '2 hours ago' },
          { hash: 'a3f2e1c', subject: 'station: bigger planets, warmer glows, companion sparkles', when: '5 hours ago' },
          { hash: 'b7d4a2f', subject: 'map: drag to rearrange planets, layout persists per region', when: 'yesterday' },
          { hash: 'c9e1f3d', subject: 'chat: template cards replace the hidden dropdown', when: '2 days ago' },
          { hash: 'd2a8b4e', subject: 'accessibility: 44px floor audit, focus rings, reduced-motion guards', when: '3 days ago' }
        ]
      }
    },
    {
      id: 'lantern-notes',
      name: 'lantern-notes',
      status: 'needs_attention',
      branch: 'main',
      upstream: 'origin/main',
      ahead: 0,
      behind: 4,
      work: 'working tree clean — no local changes',
      sentence: 'The remote has newer history than this copy: 4 commits you do not have yet. Nothing is broken, this one just needs you.',
      observed: 'observed 20 minutes ago',
      enrichment: 'remote facts available: 4 new commits on origin/main · 1 open issue',
      tree: {
        state: 'observed',
        rows: [
          { kind: 'dir', name: 'notes/', when: '3 days ago', note: '412 markdown notes, newest first' },
          { kind: 'dir', name: 'drafts/', when: '3 days ago', note: 'half-finished, on purpose' },
          { kind: 'file', name: 'README.md', when: '1 week ago', note: 'what this notebook is for' },
          { kind: 'file', name: 'index.md', when: '3 days ago', note: 'generated table of contents' }
        ]
      },
      commits: {
        state: 'observed',
        rows: [
          { hash: '4e8b0d1', subject: 'notes: evening page, plus two links back to older thinking', when: '3 days ago' },
          { hash: '9a2c7f4', subject: 'index: regenerate after the weekend batch', when: '5 days ago' },
          { hash: '1f6d3b8', subject: 'drafts: pick the tide metaphor back up', when: '1 week ago' }
        ]
      }
    },
    {
      id: 'pickle',
      name: 'pickle',
      status: 'diverged',
      branch: 'feature/tide',
      upstream: 'origin/feature/tide',
      ahead: 2,
      behind: 5,
      work: '3 changes in the working tree — 2 modified, 1 untracked, 0 conflicted',
      sentence: 'Local and remote histories have diverged — both sides have work the other does not have. This is the one that needs a human decision, not a script.',
      observed: 'observed 2 hours ago',
      enrichment: 'remote facts unavailable: no gh session, so remote detail is unknown',
      tree: {
        state: 'observed',
        rows: [
          { kind: 'dir', name: 'pickle/', when: 'today', note: 'the adapter layer other projects borrow', flag: 'modified' },
          { kind: 'dir', name: 'tests/', when: 'today', note: 'contract tests for the adapters' },
          { kind: 'file', name: 'CHANGELOG.md', when: 'today', note: 'two entries not published yet', flag: 'local only' },
          { kind: 'file', name: 'pyproject.toml', when: '4 days ago', note: 'package metadata' }
        ]
      },
      commits: {
        state: 'observed',
        rows: [
          { hash: '5b0f7a2', subject: 'adapters: keep the sensor read-only, log what it saw', when: 'today', flag: 'local only' },
          { hash: 'e3d9c61', subject: 'tests: pin the record shape the other side expects', when: 'today', flag: 'local only' },
          { hash: '2c7a4e9', subject: 'docs: explain why diverged is a decision, not an error', when: '4 days ago' },
          { hash: '8f1b5d3', subject: 'chore: drop the unused retry helper', when: '6 days ago' }
        ]
      }
    },
    {
      id: 'agent-sketches',
      name: 'agent-sketches',
      status: 'healthy',
      branch: 'main',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
      work: 'working tree clean — no local changes',
      sentence: 'All good. Published, clean tree, nothing waiting on you. This is the quiet state, and it is a good thing to see.',
      observed: 'observed 2 hours ago',
      enrichment: 'remote facts available: 0 open pull requests · last remote push 6 days ago',
      tree: {
        state: 'observed',
        rows: [
          { kind: 'dir', name: 'sketches/', when: '6 days ago', note: 'small experiments, each one self-contained' },
          { kind: 'file', name: 'README.md', when: '6 days ago', note: 'which sketches are still alive' },
          { kind: 'file', name: 'LICENSE', when: '2 weeks ago', note: 'shared licence for the folder' }
        ]
      },
      commits: {
        state: 'observed',
        rows: [
          { hash: 'c19e4b7', subject: 'sketch: a map that only reveals what you walk toward', when: '6 days ago' },
          { hash: '6d2f8a0', subject: 'readme: mark two sketches as finished thinking', when: '6 days ago' },
          { hash: '0a5c3e2', subject: 'initial commit', when: '2 weeks ago' }
        ]
      }
    },
    {
      id: 'old-notebooks',
      name: 'old-notebooks',
      status: 'unknown',
      branch: null,
      upstream: null,
      ahead: null,
      behind: null,
      work: null,
      sentence: 'Not sure yet. The last look at this repository did not finish, so there is nothing honest to say about its branch, its sync, or its files. Unknown is a real state — not an empty one, and not a broken one.',
      observed: 'last observation failed 3 days ago · nothing newer is known',
      enrichment: 'remote facts not configured: no gh session, so remote detail is unknown too',
      tree: {
        state: 'unobserved',
        why: 'The observation ended in an error, so no tree is shown rather than an invented one. In the product this is API-033 returning an error for this path: the tree is unknown, not empty.'
      },
      commits: {
        state: 'unobserved',
        why: 'History was not read, so none is listed. API-034 would supply this newest-first once an observation succeeds.'
      }
    }
  ];

  /* ── small helpers ── */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mono(s) { return '<span class="pv-mono">' + esc(s) + '</span>'; }
  function find(id) {
    for (var i = 0; i < REPOS.length; i++) { if (REPOS[i].id === id) { return REPOS[i]; } }
    return null;
  }
  function specimen() { return '<span class="pv-specimen">specimen</span>'; }

  /* ── chips: every one carries a word, never colour alone ── */
  function branchChip(r) {
    var body = r.branch === null
      ? 'branch not observed'
      : 'branch ' + mono(r.branch);
    return '<li><span class="pv-chip pv-chip-branch">' +
             '<span class="pv-cdot" aria-hidden="true"></span>' + body +
           '</span></li>';
  }

  function syncText(r) {
    if (r.ahead === null || r.behind === null) { return 'ahead / behind unknown'; }
    if (r.ahead === 0 && r.behind === 0) { return 'even with ' + r.upstream; }
    var parts = [];
    if (r.ahead > 0) { parts.push(r.ahead + ' ahead'); }
    if (r.behind > 0) { parts.push(r.behind + ' behind'); }
    return parts.join(' · ') + ' of ' + r.upstream;
  }
  function syncChip(r) {
    return '<li><span class="pv-chip pv-chip-sync">' +
             '<span class="pv-cdot" aria-hidden="true"></span>' + esc(syncText(r)) +
           '</span></li>';
  }

  function statusChip(r) {
    return '<li><span class="pv-chip pv-chip-status pv-st-' + esc(r.status) + '">' +
             '<span class="pv-cdot" aria-hidden="true"></span>' +
             '<span class="pv-chip-k">status</span> ' + esc(WORD[r.status]) +
           '</span></li>';
  }

  /* ── file tree: directories are real disclosures (native keyboard) ── */
  function flag(f) {
    return f ? '<span class="pv-flag">' + esc(f) + '</span>' : '';
  }
  function treeRow(n, depth) {
    var kids = (n.children && n.children.length) ? n.children : null;
    var expandable = n.kind === 'dir' && kids && depth === 0;
    var ico = (expandable ? '<span class="pv-caret" aria-hidden="true">▸</span>' : '') +
              '<span class="pv-ico" aria-hidden="true">' + (n.kind === 'dir' ? '📁' : '📄') + '</span>';
    var body = ico + '<span class="pv-name">' + esc(n.name) + '</span>' +
               (n.note ? '<span class="pv-note">' + esc(n.note) + '</span>' : '') +
               flag(n.flag) +
               (expandable ? '<span class="pv-count">' + kids.length + ' inside</span>' : '') +
               '<span class="pv-when">' + esc(n.when) + '</span>';
    if (expandable) {
      return '<li><details class="pv-dir">' +
               '<summary>' + body + '</summary>' +
               '<ul class="pv-tree-sub">' + kids.map(function (c) { return treeRow(c, depth + 1); }).join('') + '</ul>' +
             '</details></li>';
    }
    return '<li class="pv-row">' + body + '</li>';
  }

  function treeBlock(r) {
    var head = '<h4 class="pv-block-h" id="pv-tree-h">Files' +
      (r.tree.state === 'observed' ? ' <span class="pv-count">' + r.tree.rows.length + ' top level</span>' : '') +
      ' ' + specimen() + '</h4>';
    var inner;
    if (r.tree.state !== 'observed') {
      inner = '<div class="pv-state"><b>No tree observed</b>' + esc(r.tree.why) + '</div>';
    } else {
      inner = '<ul class="pv-tree">' + r.tree.rows.map(function (n) { return treeRow(n, 0); }).join('') + '</ul>';
    }
    return '<section class="pv-block" aria-labelledby="pv-tree-h">' + head + inner + '</section>';
  }

  /* ── recent commits: hash · message · when ── */
  function commitsBlock(r) {
    var head = '<h4 class="pv-block-h" id="pv-commits-h">Recent commits' +
      (r.commits.state === 'observed' ? ' <span class="pv-count">' + r.commits.rows.length + ' shown, newest first</span>' : '') +
      ' ' + specimen() + '</h4>';
    var inner;
    if (r.commits.state !== 'observed') {
      inner = '<div class="pv-state"><b>No history observed</b>' + esc(r.commits.why) + '</div>';
    } else {
      inner = '<ol class="pv-commits">' + r.commits.rows.map(function (c) {
        return '<li class="pv-commit">' +
                 '<span class="pv-rail" aria-hidden="true"></span>' +
                 '<span class="pv-subject">' + esc(c.subject) + '</span>' +
                 '<span class="pv-commit-meta">' +
                   '<span class="pv-hash">' + esc(c.hash) + '</span>' +
                   flag(c.flag) +
                   '<span class="pv-when">' + esc(c.when) + '</span>' +
                 '</span>' +
               '</li>';
      }).join('') + '</ol>';
    }
    return '<section class="pv-block" aria-labelledby="pv-commits-h">' + head + inner + '</section>';
  }

  /* ── the gate: explains the safe write flow, performs no write ── */
  function stepHTML(s) {
    return '<li class="pv-step">' +
             '<span class="pv-step-n" aria-hidden="true"></span>' +
             '<div>' +
               '<span class="pv-step-name">' + esc(s.name) + '</span>' +
               '<p class="pv-step-why">' + esc(s.why) + '</p>' +
               '<p class="pv-step-tech">' + esc(s.tech) + '</p>' +
               '<span class="pv-step-state ' + (s.shown ? 'pv-step-shown' : 'pv-step-unwired') + '">' +
                 (s.shown ? 'shown here · specimen' : 'not wired in this prototype') +
               '</span>' +
             '</div>' +
           '</li>';
  }

  function gatePanelHTML(r) {
    return '<p class="pv-gate-head"><strong>Nothing was written.</strong> No command ran, no file ' +
             'changed, no repository was touched — not here and not anywhere. This is the ' +
             'explanation the gate shows instead of an action.</p>' +
           '<ol class="pv-steps">' + STEPS.map(stepHTML).join('') + '</ol>' +
           '<p class="pv-gate-stop">Steps 4 to 6 need a live, signed-in world and an explicit ' +
             'step-up approval at the moment of action, so this prototype stops at the ' +
             'explanation — deliberately, not accidentally. When they are wired, the first ' +
             'action stays the smallest useful one: re-run the read-only status for ' +
             mono(r.name) + ' through ' + mono('API-035 POST /api/source-control/refresh') +
             ', then journal what came back.</p>' +
           '<div class="pv-gate-actions">' +
             '<button type="button" class="pv-btn pv-btn-quiet" data-pv-gate-close>Close explanation</button>' +
             '<span class="pv-gate-tag">Esc closes it too</span>' +
           '</div>';
  }

  function gateHTML(r) {
    return '<section class="pv-gate" aria-labelledby="pv-gate-h">' +
             '<h4 class="pv-block-h" id="pv-gate-h">Refresh ' + mono(r.name) + '</h4>' +
             '<p class="pv-gate-lede">A refresh is a <strong>write</strong>, so it is gated. ' +
               'Pressing this button shows you the safe path instead of taking it: what would ' +
               'be observed, what would change, and what your approval would be required for.</p>' +
             '<div class="pv-gate-row">' +
               '<button type="button" class="pv-btn pv-btn-gate" id="pv-gate-btn" ' +
                       'aria-expanded="false" aria-controls="pv-gate-panel">' +
                 '<span class="pv-btn-main">Propose refresh</span>' +
                 '<span class="pv-btn-sub">gated · explains only</span>' +
               '</button>' +
               '<span class="pv-gate-tag">writes nothing</span>' +
             '</div>' +
             '<div class="pv-gate-panel" id="pv-gate-panel" tabindex="-1" hidden>' +
               gatePanelHTML(r) +
             '</div>' +
           '</section>';
  }

  /* ── the panel for the chosen repository ── */
  function panelHTML(r) {
    return '<article class="pv-panel" aria-labelledby="pv-panel-title">' +
             '<header class="pv-panel-head">' +
               '<div class="pv-panel-id">' +
                 '<span class="pv-glyph" aria-hidden="true">✦</span>' +
                 '<h3 class="pv-repo-title" id="pv-panel-title">' + esc(r.name) + '</h3>' +
               '</div>' +
               '<ul class="pv-chips">' + branchChip(r) + syncChip(r) + statusChip(r) + '</ul>' +
               '<p class="pv-sentence">' + esc(r.sentence) + '</p>' +
               '<p class="pv-observed">' +
                 esc(r.observed) + '<br>' +
                 (r.work ? esc(r.work) + '<br>' : '') +
                 esc(r.enrichment) + ' · ' + specimen() +
               '</p>' +
             '</header>' +
             '<div class="pv-body">' + treeBlock(r) + commitsBlock(r) + '</div>' +
             gateHTML(r) +
           '</article>';
  }

  /* ── technical disclosure: canonical terms, real bindings ── */
  function techHTML() {
    return '<details class="tech pv-tech">' +
             '<summary>technical · status vocabulary, real bindings, and the write gate</summary>' +
             '<div class="tech-body">' +
               'canonical status: healthy · needs_attention · dirty · diverged · unknown<br>' +
               'shown on screen:  all good · needs you · work in progress · diverged · not sure yet<br>' +
               '<br>' +
               'API-079 GET  /api/projects/status            project estate (agent-sync sensor; honest "unavailable" envelope when absent)<br>' +
               'API-033 GET  /api/source-control/status      per repo: branch, revision, dirty, ahead, behind, remote, error<br>' +
               'API-034 GET  /api/source-control/history     newest-first commits for one repository (the list above)<br>' +
               'API-035 POST /api/source-control/refresh     the ONLY write here: propose → approve → act, require_step_up, journaled. Never called by this prototype.<br>' +
               'API-036 GET  /api/source-control/enrichment  remote facts via the gh session; not_configured when there is none<br>' +
               '<br>' +
               'every write in this world goes: observe → diff → propose → approve → act → re-observe<br>' +
               'this view performs no reads and no writes. every record above is specimen.' +
             '</div>' +
           '</details>';
  }

  function repoButtonHTML(r) {
    return '<li><button type="button" class="pv-repo-btn" data-repo="' + esc(r.id) + '" aria-pressed="false">' +
             '<span class="pv-pick" aria-hidden="true">✓</span>' +
             '<span class="pv-repo-name">' + esc(r.name) + '</span>' +
             '<span class="pv-chip pv-chip-status pv-st-' + esc(r.status) + '">' +
               '<span class="pv-cdot" aria-hidden="true"></span>' +
               '<span class="pv-chip-k">status</span> ' + esc(WORD[r.status]) +
             '</span>' +
           '</button></li>';
  }

  function shellHTML() {
    return '<h2 class="pv-title" id="pv-title">Your repositories</h2>' +
      '<p class="pv-lede">What you are making, as it actually is — including the messy parts. ' +
        'A dirty tree is information, not an emergency. ✦</p>' +
      '<p class="pv-specimen-line">' + specimen() + ' Every repository, branch, file and commit ' +
        'below is illustrative. It is shaped like the real read APIs so that wiring it later is a ' +
        'swap rather than a rewrite — but none of it is your work, and this page reads nothing and ' +
        'writes nothing.</p>' +
      '<div class="pv-choose" role="group" aria-labelledby="pv-choose-label">' +
        '<span class="pv-sublabel" id="pv-choose-label">Choose a repository · five honest states</span>' +
        '<ul class="pv-repolist">' + REPOS.map(repoButtonHTML).join('') + '</ul>' +
      '</div>' +
      '<div id="pv-panel-slot"></div>' +
      '<p class="sr-only" role="status" aria-live="polite" id="pv-live"></p>' +
      techHTML();
  }

  /* ── behaviour ── */
  var mount = null;
  var liveTimer = null;
  var current = null;

  function say(text) {
    var live = document.getElementById('pv-live');
    if (!live) { return; }
    if (liveTimer) { window.clearTimeout(liveTimer); }
    live.textContent = '';
    /* one tick later, so a repeated identical message still announces */
    liveTimer = window.setTimeout(function () { live.textContent = text; }, 60);
  }

  function setGate(open) {
    var btn = document.getElementById('pv-gate-btn');
    var panel = document.getElementById('pv-gate-panel');
    if (!btn || !panel) { return; }
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      panel.focus();
      say('Explanation open. Nothing was written: no command ran and no file changed.');
    } else {
      btn.focus();
      say('Explanation closed. Nothing was written.');
    }
  }

  function select(id, quiet) {
    var r = find(id);
    if (!r || !mount) { return; }
    var slot = document.getElementById('pv-panel-slot');
    if (!slot) { return; }
    var focusWasInside = slot.contains(document.activeElement);

    current = r;
    Array.prototype.forEach.call(mount.querySelectorAll('[data-repo]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-repo') === id ? 'true' : 'false');
    });
    slot.innerHTML = panelHTML(r);

    if (focusWasInside) {
      var title = document.getElementById('pv-panel-title');
      if (title) { title.setAttribute('tabindex', '-1'); title.focus(); }
    }
    if (!quiet) {
      say(r.name + ' — ' + WORD[r.status] + '. ' + r.sentence + ' Specimen data; nothing was read or written.');
    }
  }

  function wire() {
    mount.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) { return; }
      var repoBtn = t.closest('[data-repo]');
      if (repoBtn) { select(repoBtn.getAttribute('data-repo')); return; }
      if (t.closest('#pv-gate-btn')) {
        var panel = document.getElementById('pv-gate-panel');
        setGate(!!panel && panel.hidden);
        return;
      }
      if (t.closest('[data-pv-gate-close]')) { setGate(false); }
    });

    mount.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') { return; }
      var panel = document.getElementById('pv-gate-panel');
      if (!panel || panel.hidden) { return; }
      e.preventDefault();
      setGate(false);
    });
  }

  function boot() {
    mount = document.getElementById(MOUNT);
    if (!mount) { return; }
    mount.classList.add('pv');
    mount.innerHTML = shellHTML();
    wire();
    select(REPOS[0].id, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  /* small surface for review/debugging in the console; performs no writes */
  window.PW_PROJECTS_VIEW = {
    specimen: REPOS,
    steps: STEPS,
    current: function () { return current; },
    select: function (id) { select(id); }
  };
})();
