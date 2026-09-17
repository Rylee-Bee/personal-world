/* ═══════════════════════════════════════════════════════════════
   PROJECTS CONTENT VIEW — real source-control reads, honest states.

   Rendered into #projects-view, below the systems map, on
   projects.html. Styling: projects-view.css.

   DATA TRUTH (this view performs real reads; every record shown is
   yours, read from git on this server at the times shown):
      API-033 GET  /api/source-control/status      repository list
      API-034 GET  /api/source-control/history     newest-first commits
   There is no file-tree endpoint, so NO tree is rendered — absence is
   shown, never filled with invented files.
   The estate read API-079 GET /api/projects/status (agent-sync
   sensor) exists but is not consumed on this surface yet.

   THE ONE WRITE — API-035 POST /api/source-control/refresh — is never
   called. The "How project refresh would work" gate is an
   explanation only: no proposal path is wired to it yet (LANG-019),
   so the button explains the safe path instead of promising one.
   Nothing runs a command.

   HONEST STATES (content-guide vocabulary):
      not_configured → "Source control is not set up."   (absence is
        not failure; no fake repos are substituted for it)
      unavailable/error → couldn't-check + Try again
      healthy + repos → the real list, observed timestamps shown
      Status is never colour-alone: healthy / work in progress /
      diverged / unknown each render as a word, canonical vocabulary
      one disclosure down.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MOUNT = 'projects-view';

  /* canonical status → the plain word shown on the surface
     (LABELS wording mirrors api.js; "unknown" says not known yet) */
  var WORD = {
    healthy: 'all good',
    dirty: 'work in progress',
    diverged: 'diverged',
    unknown: 'not known yet'
  };

  function API() { return window.PW_API; }

  /* ── small helpers ── */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mono(s) { return '<span class="pv-mono">' + esc(s) + '</span>'; }

  function whenText(iso) {
    if (!iso) { return null; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return null; }
    return d.toLocaleString([], {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit'
    });
  }
  function timeEl(iso) {
    if (!iso) { return esc('undated'); }
    return '<time datetime="' + esc(iso) + '">' + esc(whenText(iso) || iso) + '</time>';
  }

  /* Map one repo record (source_control.repository_status shape) to a
     canonical status + plain sentence. Never invents a field. */
  function repoState(r) {
    if (r && r.error && r.branch === null && r.dirty === null) {
      return { status: 'unknown', why: 'Repository state could not be read. Nothing here is guessed — what is known is shown.' };
    }
    if (r && r.error && (r.dirty === null)) {
      return { status: 'unknown', why: 'The working-tree check failed. The branch information above may still be current.' };
    }
    var dirty = !!(r && r.dirty);
    var ahead = r && typeof r.ahead === 'number' ? r.ahead : null;
    var behind = r && typeof r.behind === 'number' ? r.behind : null;
    if (ahead && behind) { return { status: 'diverged', why: 'Local and remote histories have both moved — this one needs a human decision, not a script.' }; }
    if (dirty || ahead || behind) { return { status: 'dirty', why: 'Some of the work is still local. A dirty or unpublished tree is information, not an emergency.' }; }
    if (ahead === 0 && behind === 0 && !dirty) {
      return { status: 'healthy', why: 'Clean tree, even with its remote. Nothing here is waiting on you.' };
    }
    return { status: 'unknown', why: 'Not every part of this repository could be read. What was observed is shown; the rest is not known yet.' };
  }

  /* ── chips: every one carries a word, never colour alone ── */
  function branchChip(r) {
    var body = (r && r.branch) ? 'branch ' + mono(r.branch) : 'branch not observed';
    return '<li><span class="pv-chip pv-chip-branch">' +
             '<span class="pv-cdot" aria-hidden="true"></span>' + body +
           '</span></li>';
  }
  function syncText(r) {
    var ahead = typeof r.ahead === 'number' ? r.ahead : null;
    var behind = typeof r.behind === 'number' ? r.behind : null;
    if (ahead === null || behind === null) { return 'ahead / behind not known'; }
    if (ahead === 0 && behind === 0) { return 'even with ' + (r.remote ? 'its remote' : 'no remote tracking branch'); }
    var parts = [];
    if (ahead > 0) { parts.push(ahead + ' ahead'); }
    if (behind > 0) { parts.push(behind + ' behind'); }
    return parts.join(' · ') + (r.remote ? '' : ' (no remote tracking branch)');
  }
  function syncChip(r) {
    return '<li><span class="pv-chip pv-chip-sync">' +
             '<span class="pv-cdot" aria-hidden="true"></span>' + esc(syncText(r)) +
           '</span></li>';
  }
  function statusChip(status) {
    return '<li><span class="pv-chip pv-chip-status pv-st-' + esc(status) + '">' +
             '<span class="pv-cdot" aria-hidden="true"></span>' +
             '<span class="pv-chip-k">status</span> ' + esc(WORD[status] || status) +
           '</span></li>';
  }

  /* ── honest states ─────────────────────────────────────────── */

  function notSetupHTML(why) {
    return '<div class="pv-state" role="status">' +
      '<b>Your repositories are not set up.</b>' +
      '<p>Project Worlds reads repository state through git on this server. ' +
      esc(why || 'No folders to watch are configured, so there are no repositories to show.') +
      ' Nothing here is filled in with sample content — absence is not failure.</p>' +
      '<p>When folders are configured for source control on the server, ' +
      'they appear here with their real state.</p>' +
      '</div>';
  }

  /* ── commits ── */
  function commitsBlockHTML(r, env) {
    var head = '<h4 class="pv-block-h" id="pv-commits-h">Recent commits</h4>';
    var inner;
    if (!env) {
      inner = '<div class="pv-state"><b>Checking recent commits…</b></div>';
    } else if (!env.ok) {
      inner = '<div class="pv-state"><b>Couldn’t read the history.</b> ' +
        esc((env.error && env.error.message) || '') +
        ' <button type="button" class="pv-btn pv-btn-gate" data-pv-history-retry>Try again</button></div>';
    } else if (!env.data || !env.data.commits || !env.data.commits.length) {
      inner = '<div class="pv-state"><b>No commits observed.</b> An empty repository is a valid quiet state, not an error.</div>';
    } else {
      inner = '<ol class="pv-commits">' + env.data.commits.map(function (c) {
        return '<li class="pv-commit">' +
                 '<span class="pv-rail" aria-hidden="true"></span>' +
                 '<span class="pv-subject">' + esc(c.subject) + '</span>' +
                 '<span class="pv-commit-meta">' +
                   '<span class="pv-hash">' + esc(String(c.revision || '').slice(0, 7)) + '</span>' +
                   '<span class="pv-when">' + timeEl(c.date) + '</span>' +
                 '</span>' +
               '</li>';
      }).join('') + '</ol>';
    }
    return '<section class="pv-block" aria-labelledby="pv-commits-h">' + head + inner + '</section>';
  }

  /* ── the gate: explains the safe write flow, performs no write.
     Until a real proposal path is wired, the button is labelled for
     what it actually does (LANG-019). ── */
  function gatePanelHTML(r) {
    return '<p class="pv-gate-head"><strong>This explanation did not run a ' +
             'command or change this repository.</strong> It is what the ' +
             'control shows instead of an action, until a refresh path is wired.</p>' +
           '<ol class="pv-steps">' + STEPS.map(stepHTML).join('') + '</ol>' +
           '<p class="pv-gate-stop">The later steps are not wired yet. When a ' +
             'refresh is wired, the first action stays the smallest useful one: ' +
             're-run the read-only status for ' + mono(r.name) + ' through ' +
             mono('API-035 POST /api/source-control/refresh') +
             ' with your explicit confirmation, then observe again and write ' +
             'down what came back.</p>' +
           '<div class="pv-gate-actions">' +
             '<button type="button" class="pv-btn pv-btn-quiet" data-pv-gate-close>Close explanation</button>' +
             '<span class="pv-gate-tag">Esc closes it too</span>' +
           '</div>';
  }

  function stepHTML(s) {
    return '<li class="pv-step">' +
             '<span class="pv-step-n" aria-hidden="true"></span>' +
             '<div>' +
               '<span class="pv-step-name">' + esc(s.name) + '</span>' +
               '<p class="pv-step-why">' + esc(s.why) + '</p>' +
               '<p class="pv-step-tech">' + esc(s.tech) + '</p>' +
               '<span class="pv-step-state ' + (s.shown ? 'pv-step-shown' : 'pv-step-unwired') + '">' +
                 (s.shown ? 'read here · from the real repository' : 'not wired') +
               '</span>' +
             '</div>' +
           '</li>';
  }

  var STEPS = [
    {
      name: 'Observe',
      why: 'Look without touching. Read-only: which repositories exist, what branch each is on, how far ahead or behind it is, and whether files are changed.',
      tech: 'API-033 GET /api/source-control/status · reads below are this view’s real reads',
      shown: true
    },
    {
      name: 'Diff',
      why: 'Show exactly what would change — in plain words first, then the lines. No hidden scope, no surprises at the end.',
      tech: 'API-034 GET /api/source-control/history for context; a diff is computed read-only, never applied',
      shown: false
    },
    {
      name: 'Propose',
      why: 'Write down one named action with what it does, why, which tool it uses, what the risk is, and what to expect. Then it waits for you.',
      tech: 'a proposal waits for an explicit approval — agreement anywhere else is never authorization',
      shown: false
    },
    {
      name: 'Approve, act, observe again',
      why: 'You say yes explicitly; the one approved action runs; the view is checked again so you can see what actually happened.',
      tech: 'API-035 POST /api/source-control/refresh · require_step_up · journaled',
      shown: false
    }
  ];

  function gateHTML(r) {
    return '<section class="pv-gate" aria-labelledby="pv-gate-h">' +
             '<h4 class="pv-block-h" id="pv-gate-h">Refreshing ' + mono(r.name) + '</h4>' +
             '<p class="pv-gate-lede">A refresh is a <strong>write</strong>, so it would be ' +
               'gated. This control explains the safe path instead of taking it: what would ' +
               'be observed, what would change, and what your confirmation would be required for.</p>' +
             '<div class="pv-gate-row">' +
               '<button type="button" class="pv-btn pv-btn-gate" id="pv-gate-btn" ' +
                       'aria-expanded="false" aria-controls="pv-gate-panel">' +
                 '<span class="pv-btn-main">How project refresh would work</span>' +
                 '<span class="pv-btn-sub">explains the safe path · writes nothing</span>' +
               '</button>' +
             '</div>' +
             '<div class="pv-gate-panel" id="pv-gate-panel" tabindex="-1" hidden>' +
               gatePanelHTML(r) +
             '</div>' +
           '</section>';
  }

  /* ── the panel for the chosen repository ── */
  function panelHTML(r) {
    var state = repoState(r);
    return '<article class="pv-panel" aria-labelledby="pv-panel-title">' +
             '<header class="pv-panel-head">' +
               '<div class="pv-panel-id">' +
                 '<span class="pv-glyph" aria-hidden="true">✦</span>' +
                 '<h3 class="pv-repo-title" id="pv-panel-title">' + esc(r.name) + '</h3>' +
               '</div>' +
               '<ul class="pv-chips">' + branchChip(r) + syncChip(r) + statusChip(state.status) + '</ul>' +
               '<p class="pv-sentence">' + esc(state.why) + '</p>' +
               '<p class="pv-observed">read from git on this server · checked just now</p>' +
             '</header>' +
             '<div class="pv-body">' + commitsBlockHTML(r, null) + '</div>' +
             gateHTML(r) +
           '</article>';
  }

  /* ── technical disclosure: canonical terms, real bindings ── */
  function techHTML() {
    return '<details class="tech pv-tech">' +
             '<summary>technical · status vocabulary, real bindings, and the write gate</summary>' +
             '<div class="tech-body">' +
               'canonical statuses: healthy · dirty · diverged · unknown<br>' +
               'shown on screen: all good · work in progress · diverged · not known yet<br>' +
               '<br>' +
               'API-033 GET  /api/source-control/status     the repository list above (real read; not_configured when no folders are configured)<br>' +
               'API-034 GET  /api/source-control/history    the commits for a chosen repository, newest first<br>' +
               'API-035 POST /api/source-control/refresh    the only write here: confirm-first, journaled. Not wired to this page.<br>' +
               'API-036 GET  /api/source-control/enrichment  remote facts via the gh session — not consumed on this surface.<br>' +
               'API-079 GET  /api/projects/status           project estate via the agent-sync sensor — not consumed on this surface.<br>' +
               '<br>' +
               'no file tree is shown because no read provides one; unknown paths are left out, never invented.<br>' +
               'this view performs reads only. it never calls the write.' +
             '</div>' +
           '</details>';
  }

  function repoButtonHTML(r) {
    var state = repoState(r);
    return '<li><button type="button" class="pv-repo-btn" data-repo="' + esc(r.name) + '" aria-pressed="false">' +
             '<span class="pv-pick" aria-hidden="true">✓</span>' +
             '<span class="pv-repo-name">' + esc(r.name) + '</span>' +
             '<span class="pv-chip pv-chip-status pv-st-' + esc(state.status) + '">' +
               '<span class="pv-cdot" aria-hidden="true"></span>' +
               '<span class="pv-chip-k">status</span> ' + esc(WORD[state.status] || state.status) +
             '</span>' +
           '</button></li>';
  }

  function shellHTML(env) {
    var repos = (env && env.data && Array.isArray(env.data.repos)) ? env.data.repos : [];
    return '<h2 class="pv-title" id="pv-title">Your repositories</h2>' +
      '<p class="pv-lede">What you are making, as it actually is — read from git on this ' +
        'server just now. A dirty tree is information, not an emergency. ✦</p>' +
      '<div class="pv-choose" role="group" aria-labelledby="pv-choose-label">' +
        '<span class="pv-sublabel" id="pv-choose-label">Choose a repository</span>' +
        '<ul class="pv-repolist">' + repos.map(repoButtonHTML).join('') + '</ul>' +
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
      say('Explanation open. Nothing was written: this explanation did not run a command or change a repository.');
    } else {
      btn.focus();
      say('Explanation closed. Nothing was written.');
    }
  }

  function find(name) {
    if (!latest || !latest.ok || !latest.data) { return null; }
    var repos = latest.data.repos || [];
    for (var i = 0; i < repos.length; i++) { if (repos[i].name === name) { return repos[i]; } }
    return null;
  }

  function select(name, quiet) {
    var r = find(name);
    if (!r || !mount) { return; }
    var slot = document.getElementById('pv-panel-slot');
    if (!slot) { return; }
    var focusWasInside = slot.contains(document.activeElement);

    current = name;
    Array.prototype.forEach.call(mount.querySelectorAll('[data-repo]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-repo') === name ? 'true' : 'false');
    });
    slot.innerHTML = panelHTML(r);
    /* wrap the commits block in a stable repaint target */
    var body = slot.querySelector('.pv-body');
    if (body) {
      var block = body.querySelector('.pv-block');
      var slotDiv = document.createElement('div');
      slotDiv.id = 'pv-history-slot';
      block.parentNode.replaceChild(slotDiv, block);
      slotDiv.appendChild(block);
    }
    loadHistoryRows(name);

    if (focusWasInside) {
      var title = document.getElementById('pv-panel-title');
      if (title) { title.setAttribute('tabindex', '-1'); title.focus(); }
    }
    if (!quiet) {
      var state = repoState(r);
      say(r.name + ' — ' + (WORD[state.status] || state.status) + '. ' + state.why);
    }
  }

  /* fetch the real history for the selected repository (API-034) */
  function loadHistoryRows(name) {
    function fetchRows() {
      API().read('API-034', { query: { repo: name, limit: 10 } }).then(function (env) {
        var active = document.getElementById('pv-history-slot');
        if (!active || current !== name) { return; }
        var block = active.querySelector('.pv-block');
        if (!block) { return; }
        var fresh = document.createElement('div');
        fresh.innerHTML = commitsBlockHTML({ name: name }, env);
        block.parentNode.replaceChild(fresh.firstChild, block);
      });
    }
    fetchRows();
  }

  /* ── the whole boot: one real read drives the surface ── */
  var latest = null;
  var listenersOn = null;

  function paint(env) {
    latest = env;
    if (!mount) { return; }

    if (!env || env.ok === undefined) {
      mount.innerHTML = loadingHTML();
      wire();
      return;
    }

    /* not_configured outranks ok: an empty payload from an unconfigured
       source is an honest not-set-up state, never a quiet empty list */
    if (env.status === 'not_configured') {
      mount.innerHTML = notSetupShell(env);
      wire();
      return;
    }

    if (!env.ok) {
      if (env.status === 'not_configured') {
        mount.innerHTML = notSetupShell(env);
      } else {
        mount.innerHTML = failureShell(env);
      }
      wire();
      return;
    }

    mount.innerHTML = shellHTML(env);
    wire();
    var repos = env.data && env.data.repos ? env.data.repos : [];
    if (repos.length) { select(repos[0].name, true); }
    else { /* a successful read that found nothing: the same honest not-set-up state */
      mount.innerHTML = notSetupShell(env);
      wire();
    }
  }

  function loadingHTML() {
    return '<h2 class="pv-title" id="pv-title">Your repositories</h2>' +
      '<p class="pv-lede">What you are making, as it actually is.</p>' +
      '<p class="pv-boot" role="status">Checking your repositories…</p>' +
      techHTML();
  }

  function notSetupShell(env) {
    var why = (env && env.warnings && env.warnings[0]) || null;
    var text;
    if (why === 'no source_control search paths configured') {
      text = 'No folders to watch are configured yet.';
    } else if (why === 'no git repositories found in configured search paths') {
      text = 'The configured folders contain no git repositories yet.';
    } else {
      text = 'No repositories are reachable from the configured folders yet.';
    }
    return '<h2 class="pv-title" id="pv-title">Your repositories</h2>' +
      '<p class="pv-lede">What you are making, as it actually is.</p>' +
      notSetupHTML(text) +
      '<p class="pv-observed">checked just now</p>' +
      techHTML();
  }

  function failureShell(env) {
    return '<h2 class="pv-title" id="pv-title">Your repositories</h2>' +
      '<p class="pv-lede">What you are making, as it actually is.</p>' +
      '<div class="pv-state" role="status">' +
        '<b>Couldn’t check your repositories.</b>' +
        '<p>' + esc((env && env.error && env.error.message) || '') + '</p>' +
        '<p>Nothing was changed by this failed check. Try again below.</p>' +
        '<button type="button" class="pv-btn pv-btn-gate" data-pv-retry>Try again</button>' +
      '</div>' +
      techHTML();
  }

  function shellLoading() {
    /* kept for the debug surface above; loading painting also goes
       through paint() with its shellLoading replacement removed */
    return loadingHTML();
  }

  /* Delegated listeners live on the mount itself: every repaint keeps
     them working, so wiring happens once per mount (the guard keeps a
     repeated boot from stacking handlers). */
  function wire() {
    if (listenersOn === mount) { return; }
    listenersOn = mount;
    mount.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) { return; }
      if (t.closest('[data-pv-retry]')) { boot(); return; }
      var repoBtn = t.closest('[data-repo]');
      if (repoBtn) { select(repoBtn.getAttribute('data-repo')); return; }
      var retry = t.closest('[data-pv-history-retry]');
      if (retry && current) { loadHistoryRows(current); return; }
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
    mount.innerHTML = loadingHTML();
    if (!API()) {
      paint({ ok: false, status: 'unavailable',
              error: { message: 'The page could not talk to the server just now.' } });
      return;
    }
    API().read('API-033').then(paint);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  /* small surface for review/debugging in the console; performs no writes */
  window.PW_PROJECTS_VIEW = {
    current: function () { return current; },
    latest: function () { return latest; },
    refresh: function () { boot(); }
  };
})();
