/* QUICK JUMP — a calm command-palette for the systems map.
   Open with Ctrl/Cmd+K or the visible "Search" button in the top bar. Type to
   filter the map's own node names + structure (read live from
   PW_MAP_API.viewTree(), so your renames/adds/hides are respected). Pick a
   result and the map drills/zooms straight to it.

   ACCESSIBILITY: a real ARIA 1.2 combobox — the input keeps focus while
   aria-activedescendant tracks the highlighted option in a role="listbox".
   Up/Down browse, Enter jumps, Home/End jump to the ends, Esc closes, Tab is
   trapped inside the dialog. Visible focus rings, 44px targets, reduced-motion
   safe. When nothing matches we say so plainly — never a invented result.

   Self-contained: it navigates by driving the real map (zoom out, then click
   each segment), so it works whether or not deeplink.js is also wired. If
   deeplink.js is present, the URL hash follows automatically. */
(function () {
  'use strict';

  var MAG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="qs-mag">' +
            '<circle cx="11" cy="11" r="6.4" fill="none" stroke="currentColor" stroke-width="2"/>' +
            '<line x1="15.8" y1="15.8" x2="20.4" y2="20.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
            '</svg>';

  var MAX_RESULTS = 8;
  var OVERVIEW = { id: '__overview', name: 'Systems Map', pathIds: [], ancestorNames: [],
                   overview: true, hasKids: true, custom: false };

  var trigger = null, backdrop = null, dialog = null, input = null,
      list = null, emptyEl = null, statusEl = null, closeBtn = null;
  var results = [];        // entries currently shown
  var active = -1;         // index of the highlighted option
  var lastFocus = null;    // where to return focus on close
  var open = false;

  /* ── helpers ── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function prefersReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function isMac() {
    var p = navigator.platform || navigator.userAgent || '';
    return /Mac|iPod|iPhone|iPad/.test(p);
  }

  /* ── build a flat, searchable index from the live map tree ── */
  function buildIndex() {
    var out = [OVERVIEW];
    var API = window.PW_MAP_API;
    if (!API || !API.viewTree) { return out; }
    var tree = API.viewTree();
    (function walk(node, pathIds, ancestorNames) {
      if (node.id !== tree.id) {
        out.push({
          id: node.id,
          name: node.name || node.id,
          pathIds: pathIds,
          ancestorNames: ancestorNames,
          hasKids: !!(node.children && node.children.length),
          custom: !!node.custom
        });
      }
      (node.children || []).forEach(function (c) {
        var cPath = (node.id === tree.id) ? [c.id] : pathIds.concat([c.id]);
        var cAnc  = (node.id === tree.id) ? []     : ancestorNames.concat([node.name || node.id]);
        walk(c, cPath, cAnc);
      });
    })(tree, [], []);
    return out;
  }

  function score(e, q) {
    var name = (e.name || '').toLowerCase();
    if (e.overview) {
      if (/^(map|home|overview|start|world|worlds|systems|seven|top)$/.test(q)) { return 0; }
      if (name.indexOf(q) === 0) { return 1; }
      return name.indexOf(q) > -1 ? 3 : -1;
    }
    if (name === q) { return 0; }
    if (name.indexOf(q) === 0) { return 1; }
    try { if (new RegExp('\\b' + escapeRe(q)).test(name)) { return 2; } } catch (err) {}
    if (name.indexOf(q) > -1) { return 3; }
    if ((e.ancestorNames || []).join(' ').toLowerCase().indexOf(q) > -1) { return 4; }
    return -1;
  }

  function runSearch(raw) {
    var q = (raw || '').trim().toLowerCase();
    var idx = buildIndex();
    if (!q) {
      // Before typing: offer the overview + the seven worlds as a starting point.
      return idx.filter(function (e) { return e.overview || e.ancestorNames.length === 0; })
                .slice(0, MAX_RESULTS);
    }
    var scored = [];
    idx.forEach(function (e) {
      var s = score(e, q);
      if (s >= 0) { scored.push({ e: e, s: s }); }
    });
    scored.sort(function (a, b) {
      return (a.s - b.s) ||
             (a.e.pathIds.length - b.e.pathIds.length) ||
             String(a.e.name).localeCompare(String(b.e.name));
    });
    return scored.slice(0, MAX_RESULTS).map(function (x) { return x.e; });
  }

  function subText(e) {
    if (e.overview) { return 'zoom out to the seven worlds'; }
    var where = e.ancestorNames.length ? 'in ' + e.ancestorNames.join(' › ') : 'top of the map';
    var badge = e.hasKids ? 'region' : (e.custom ? 'yours' : 'cluster');
    return where + ' · ' + badge;
  }

  /* ── render the listbox ── */
  function render() {
    var q = input.value;
    results = runSearch(q);

    if (!window.PW_MAP_API || !window.PW_MAP_API.viewTree) {
      list.innerHTML = '';
      list.hidden = true;
      emptyEl.hidden = false;
      emptyEl.textContent = 'The map isn’t ready to search on this page yet.';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
      return;
    }

    if (!results.length) {
      list.innerHTML = '';
      list.hidden = true;
      emptyEl.hidden = false;
      emptyEl.textContent = q.trim()
        ? 'No places match “' + q.trim() + '”. Try a world like Interests, or a cluster like Music.'
        : 'Nothing to show yet.';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
      return;
    }

    emptyEl.hidden = true;
    emptyEl.textContent = '';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');

    list.innerHTML = results.map(function (e, i) {
      return '<li class="qs-opt" id="qs-opt-' + i + '" role="option" aria-selected="false" data-i="' + i + '">' +
               '<span class="qs-opt-name">' + esc(e.name) + '</span>' +
               '<span class="qs-opt-sub">' + esc(subText(e)) + '</span>' +
             '</li>';
    }).join('');

    setActive(0);
  }

  function setActive(i) {
    if (!results.length) { active = -1; input.removeAttribute('aria-activedescendant'); return; }
    active = (i + results.length) % results.length;
    var opts = list.querySelectorAll('.qs-opt');
    for (var k = 0; k < opts.length; k++) {
      var on = (k === active);
      opts[k].classList.toggle('active', on);
      opts[k].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    input.setAttribute('aria-activedescendant', 'qs-opt-' + active);
    var cur = opts[active];
    if (cur && cur.scrollIntoView) { cur.scrollIntoView({ block: 'nearest' }); }
  }

  function move(delta) {
    if (!results.length) { return; }
    setActive(active < 0 ? (delta > 0 ? 0 : results.length - 1) : active + delta);
  }

  /* ── navigate the real map to an entry ── */
  function findNodeBtn(scope, id) {
    var btns = scope.querySelectorAll('.node');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-id') === id) { return btns[i]; }
    }
    return null;
  }

  function navigate(pathIds) {
    var skyEl = document.getElementById('sky');
    var crumbEl = document.getElementById('sky-crumb');
    if (!skyEl) { return; }

    // Zoom all the way out so we start from a known place (the galaxy).
    var guard = 0, out;
    while (crumbEl && (out = crumbEl.querySelector('#sky-out')) && !out.hidden && guard++ < 24) {
      out.click();
    }
    // Then walk in, one segment at a time, letting the map decide drill vs dive.
    (pathIds || []).forEach(function (id) {
      var btn = findNodeBtn(skyEl, id);
      if (btn) { btn.click(); }
    });

    skyEl.scrollIntoView({ block: 'center', behavior: prefersReduced() ? 'auto' : 'smooth' });
    if (skyEl.focus) { skyEl.focus(); }
  }

  function choose(entry) {
    if (!entry) { return; }
    var label = entry.overview ? 'the Systems Map overview'
      : entry.name + (entry.ancestorNames.length ? ', in ' + entry.ancestorNames.join(' › ') : '');
    close();
    navigate(entry.pathIds);
    announce('Jumped to ' + label + '.');
  }

  function announce(msg) {
    if (statusEl) { statusEl.textContent = msg; }
  }

  /* ── open / close ── */
  function openDialog() {
    if (open) { input.focus(); input.select(); return; }
    lastFocus = document.activeElement;
    open = true;
    backdrop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    setBackgroundInert(true);
    input.value = '';
    render();                       // fresh index each open (structure may have changed)
    input.focus();
  }

  function close() {
    if (!open) { return; }
    open = false;
    backdrop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    setBackgroundInert(false);
    input.removeAttribute('aria-activedescendant');
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  function setBackgroundInert(on) {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el === backdrop) { continue; }
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') { continue; }
      try { el.inert = on; } catch (e) {}
    }
  }

  /* ── focus trap ── */
  function focusables() {
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
              'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var all = dialog.querySelectorAll(sel);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.getAttribute('tabindex') === '-1') { continue; }   // skip programmatic-only (parity with onboarding.js)
      if (el.offsetWidth || el.offsetHeight || el.getClientRects().length) { out.push(el); }
    }
    return out;
  }

  function onDialogKeydown(e) {
    var key = e.key;
    if (key === 'Escape') { e.preventDefault(); close(); return; }
    if (key === 'ArrowDown') { e.preventDefault(); move(1); return; }
    if (key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
    if (key === 'Home' && results.length) { e.preventDefault(); setActive(0); return; }
    if (key === 'End' && results.length) { e.preventDefault(); setActive(results.length - 1); return; }
    if (key === 'Enter') { e.preventDefault(); if (active >= 0) { choose(results[active]); } return; }
    if (key === 'Tab') {
      var f = focusables();
      if (!f.length) { return; }
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  /* ── build the UI ── */
  function buildTrigger() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qs-trigger';
    btn.id = 'qs-trigger';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'qs-dialog');
    btn.setAttribute('aria-label', 'Search the map — jump to any world or cluster');
    btn.innerHTML = MAG +
      '<span class="qs-trigger-label">Search</span>' +
      '<kbd class="qs-kbd" aria-hidden="true">' + (isMac() ? '⌘K' : 'Ctrl K') + '</kbd>';
    btn.addEventListener('click', openDialog);
    return btn;
  }

  function buildDialog() {
    var wrap = document.createElement('div');
    wrap.className = 'qs-backdrop';
    wrap.id = 'qs-backdrop';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="qs-dialog" id="qs-dialog" role="dialog" aria-modal="true" ' +
           'aria-labelledby="qs-heading" tabindex="-1">' +
        '<h2 id="qs-heading" class="sr-only">Quick jump</h2>' +
        '<div class="qs-field">' +
          MAG +
          '<label class="sr-only" for="qs-input">Search the map</label>' +
          '<input id="qs-input" class="qs-input" type="text" role="combobox" ' +
                 'aria-expanded="false" aria-controls="qs-list" aria-autocomplete="list" ' +
                 'autocomplete="off" autocapitalize="off" spellcheck="false" ' +
                 'aria-describedby="qs-help" placeholder="Jump to a world or cluster…">' +
          '<button type="button" class="qs-close" id="qs-close" aria-label="Close search">&times;</button>' +
        '</div>' +
        '<p id="qs-help" class="sr-only">Type to filter. Use Up and Down arrow keys to browse ' +
          'results, Enter to jump to the highlighted place, Escape to close.</p>' +
        '<ul id="qs-list" class="qs-list" role="listbox" aria-label="Map locations"></ul>' +
        '<p id="qs-empty" class="qs-empty" role="status" aria-live="polite" hidden></p>' +
        '<div class="qs-foot">' +
          '<span class="qs-hint" aria-hidden="true">' +
            '<kbd>↑</kbd><kbd>↓</kbd> browse · <kbd>Enter</kbd> jump · <kbd>Esc</kbd> close' +
          '</span>' +
        '</div>' +
      '</div>';

    // Clicking the dim backdrop (but not the dialog) closes.
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) { close(); } });
    return wrap;
  }

  function boot() {
    if (document.getElementById('qs-trigger')) { return; }   // already built

    // Trigger into the top bar, grouped with "Hail Assistant".
    trigger = buildTrigger();
    var topbar = document.querySelector('.topbar');
    if (topbar) {
      var anchor = topbar.querySelector('.help-btn') || topbar.querySelector('#topbar-region');
      if (anchor) { topbar.insertBefore(trigger, anchor); } else { topbar.appendChild(trigger); }
    } else {
      document.body.appendChild(trigger);
    }

    // Dialog + a persistent, screen-reader-only status line for jump confirmations.
    backdrop = buildDialog();
    document.body.appendChild(backdrop);

    statusEl = document.createElement('div');
    statusEl.className = 'sr-only';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(statusEl);

    dialog = backdrop.querySelector('#qs-dialog');
    input = backdrop.querySelector('#qs-input');
    list = backdrop.querySelector('#qs-list');
    emptyEl = backdrop.querySelector('#qs-empty');
    closeBtn = backdrop.querySelector('#qs-close');

    closeBtn.addEventListener('click', close);
    input.addEventListener('input', render);
    // Clicking an option jumps (mousedown so it beats input blur).
    list.addEventListener('mousedown', function (e) {
      var opt = e.target.closest ? e.target.closest('.qs-opt') : null;
      if (!opt) { return; }
      e.preventDefault();
      var i = parseInt(opt.getAttribute('data-i'), 10);
      if (!isNaN(i)) { choose(results[i]); }
    });
    // Hovering an option highlights it (keeps mouse + aria-activedescendant in step).
    list.addEventListener('mouseover', function (e) {
      var opt = e.target.closest ? e.target.closest('.qs-opt') : null;
      if (!opt) { return; }
      var i = parseInt(opt.getAttribute('data-i'), 10);
      if (!isNaN(i) && i !== active) { setActive(i); }
    });
    dialog.addEventListener('keydown', onDialogKeydown);

    // Global Ctrl/Cmd+K.
    document.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'k') {
        e.preventDefault();
        if (open) { input.focus(); input.select(); } else { openDialog(); }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
