/* DEEPLINK — keep the URL hash in step with where you are in the systems map.
   A location such as  #/interests/music  restores on load, and the hash
   updates as you drill in, open a cluster, or zoom back out. Share the URL
   and it lands on the same spot.

   HOW IT WORKS (no edits to starmap.js, no new globals):
   • Restore: parse the hash, then drive the real map — zoom out to the galaxy
     and click each segment, exactly like a person would. This reuses the
     map's own drill/dive logic, so nothing is re-implemented or duplicated.
   • Sync: a MutationObserver watches #sky for re-renders (childList only).
     Every navigation replaces #sky's contents; a drag only restyles a child,
     so dragging a planet never touches the hash. On each render we recompute
     the current location from the live DOM + PW_MAP_API.viewTree() and write
     the hash with history.replaceState (no history spam).

   Uses replaceState only: drilling is in-page state, so Back still leaves the
   page rather than walking back through every zoom. A manual hash edit (or a
   pasted link) fires hashchange and is honoured. Exposes nothing global. */
(function () {
  'use strict';

  var sky = null, crumb = null, observer = null;
  var suppress = false;      // true while we are driving the map programmatically
  var lastSegs = [];         // last known location, as id segments (fallback)

  /* ── small helpers ── */
  function parseHash() {
    var h = location.hash || '';
    h = h.replace(/^#\/?/, '');
    if (!h) { return []; }
    return h.split('/').filter(Boolean).map(function (s) {
      try { return decodeURIComponent(s); } catch (e) { return s; }
    });
  }

  function findNodeBtn(id) {
    var btns = sky.querySelectorAll('.node');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-id') === id) { return btns[i]; }
    }
    return null;
  }

  function zoomOutButton() {
    return crumb ? crumb.querySelector('#sky-out') : null;
  }

  function sameIdSet(a, b) {
    if (a.length !== b.length) { return false; }
    var seen = {};
    for (var i = 0; i < a.length; i++) { seen[a[i]] = true; }
    for (var j = 0; j < b.length; j++) { if (!seen[b[j]]) { return false; } }
    return true;
  }

  /* Which tree node is currently rendered? Its children are exactly the
     node buttons on screen. Match that set against viewTree() to recover the
     current region id without relying on display names. */
  function currentIdFromDom(tree) {
    var nodes = sky.querySelectorAll('.node');
    var displayed = [];
    for (var i = 0; i < nodes.length; i++) {
      var d = nodes[i].getAttribute('data-id');
      if (d) { displayed.push(d); }
    }
    var found = null;
    (function walk(n) {
      if (found) { return; }
      var kids = (n.children || []).map(function (c) { return c.id; });
      if (sameIdSet(kids, displayed)) { found = n.id; return; }
      (n.children || []).forEach(walk);
    })(tree);
    return found;
  }

  /* Path of ids from the first level down to (and including) `id`,
     excluding the galaxy root. [] for the root itself. */
  function pathTo(tree, id) {
    if (!id || tree.id === id) { return []; }
    var result = null;
    (function walk(n, acc) {
      if (result) { return; }
      (n.children || []).forEach(function (c) {
        var next = acc.concat([c.id]);
        if (c.id === id) { result = next; } else { walk(c, next); }
      });
    })(tree, []);
    return result || [];
  }

  /* Recompute the location segments from the live DOM. */
  function computeSegs() {
    var API = window.PW_MAP_API;
    if (!API || !API.viewTree) { return lastSegs.slice(); }
    var tree = API.viewTree();
    var cur = currentIdFromDom(tree);
    if (!cur) { return lastSegs.slice(); }        // ambiguous render; hold steady
    var segs = pathTo(tree, cur);
    var sel = sky.querySelector('.node.sel');     // an open cluster (dive)
    if (sel) {
      var sid = sel.getAttribute('data-id');
      if (sid && segs[segs.length - 1] !== sid) { segs.push(sid); }
    }
    lastSegs = segs.slice();
    return segs;
  }

  function writeHash(segs) {
    if (suppress) { return; }
    var h = segs.length ? '#/' + segs.join('/') : '';
    if ((location.hash || '') === h) { return; }   // nothing changed
    var url = location.pathname + location.search + h;
    try { history.replaceState(null, '', url); }
    catch (e) { try { location.hash = h; } catch (e2) {} }
  }

  function syncHash() { writeHash(computeSegs()); }

  /* ── restore a location by driving the real map ── */
  function zoomOutToGalaxy() {
    var guard = 0, out;
    while ((out = zoomOutButton()) && !out.hidden && guard++ < 24) { out.click(); }
  }

  function restore(segs) {
    suppress = true;
    if (observer) { observer.disconnect(); }
    try {
      zoomOutToGalaxy();
      for (var i = 0; i < segs.length; i++) {
        var btn = findNodeBtn(segs[i]);
        if (!btn) { break; }        // target not in the (user-shaped) map: stop honestly
        btn.click();
      }
    } finally {
      if (observer) { observer.observe(sky, { childList: true }); }
      suppress = false;
    }
    sky.scrollIntoView({ block: 'center', behavior: 'auto' });
    syncHash();                      // canonicalise to where we actually landed
  }

  function onHashChange() {
    if (suppress) { return; }
    var want = parseHash();
    var have = computeSegs();
    if (want.join('/') === have.join('/')) { return; }  // already there
    restore(want);
  }

  /* ── boot: wait for the map to exist and be rendered ── */
  function init() {
    observer = new MutationObserver(function () { if (!suppress) { syncHash(); } });
    observer.observe(sky, { childList: true });
    window.addEventListener('hashchange', onHashChange);

    var initial = parseHash();
    if (initial.length) { restore(initial); }   // honour a shared/pasted link
  }

  function start(tries) {
    sky = document.getElementById('sky');
    crumb = document.getElementById('sky-crumb');
    if (!sky) { return; }                        // no map on this page; do nothing
    // Wait until starmap.js has rendered and exposed its API (it is a deferred
    // sibling, so this is normally immediate). Bounded so we never hang.
    if (!window.PW_MAP_API && (tries == null || tries > 0)) {
      setTimeout(function () { start(tries == null ? 40 : tries - 1); }, 40);
      return;
    }
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { start(null); });
  } else { start(null); }
})();
