/* THE SYSTEMS MAP — a chart of systems, not a shrine to "you".
   Depth 0: the major constellations. Enter one: clusters + relationships +
   recent activity + provenance + suggestion. Enter a cluster: its objects.
   Complexity emerges because the user moves toward it.

   USER-MALLEABLE STRUCTURE: the tree below is only the DEFAULT. A stored
   structure patch (pw-map-structure) can add, rename, re-parent (merge/split),
   hide, and nest nodes to any depth — "music with 20 bands" or "books+audio
   under media" are both just edits. A per-region depth preference
   (pw-region-<id>) controls how many levels reveal at once.

   HONESTY: dataset is a SPECIMEN. Real bindings: interests API-051,
   projects API-079/033, journal API-005, companions registry, media API-054,
   systems API-020, places = this Station.

   ACCESSIBILITY: nodes are buttons with full names; attention is a glow/ring
   PLUS words in the info strip and the Needs-you line (never glow alone);
   drillable bodies wear an orbit ring; icons are decorative; motion opt-in.
*/
(function () {
  'use strict';

  var O = function (t, src, when) { return { t: t, src: src, when: when }; };

  // Build the galaxy from the shared sections config (PW_SECTIONS).
  // This keeps the map in sync with the topbar nav — add a section
  // to sections.js and it appears on both surfaces automatically.
  // Rebuilt on every viewTree() call so late-arriving canonical
  // sections (from /api/sections) replace the fallback.
  function buildDefaultTree() {
    var sections = window.PW_SECTIONS || [];
    return {
      id: 'world', name: 'Station', kind: 'galaxy',
      activity: 'nothing needs attention; routine work is batched behind the glass',
      provenance: 'personal-world status',
      rec: 'start anywhere, or nowhere. Both are valid.',
      children: sections.map(function (s) {
        return {
          id: s.id,
          name: s.name,
          color: s.colorKey || 'world',
          egg: s.egg || undefined,
          activity: '',
          provenance: '',
          rec: '',
          children: [],
          href: s.href
        };
      })
    };
  }
  var DEFAULT_TREE = buildDefaultTree();

  var COLORS = {
    ai: 'var(--lavender)', music: 'var(--coral)', build: 'var(--teal)',
    reading: 'var(--gold)', creative: 'var(--green)', world: 'var(--cream)'
  };
  var ICON = {
    interests: 'sparkle', projects: 'wrench', journal: 'pen',
    chat: 'heart', settings: 'gear',
    today: 'sparkle', media: 'film', lab: 'flask', vault: 'cloud',
    ai: 'brain', music: 'music', reading: 'book', papers: 'book',
    pw: 'wrench', tools: 'gear', entries: 'pen', running: 'pen',
    companions: 'heart', humans: 'heart', albums: 'music', watching: 'film',
    capabilities: 'cloud', providers: 'cloud', decks: 'compass', care: 'leaf', rest: 'leaf'
  };
  var CMD = {
    world: 'personal-world status', interests: 'personal-world discovery interests',
    projects: 'personal-world repo status', journal: 'personal-world journal list',
    today: 'personal-world daily', media: 'personal-world media status',
    lab: 'personal-world lab health', vault: 'personal-world vault status',
    people: 'personal-world companions list',
    pw: 'personal-world repo diff  →  propose  →  approve  →  act  →  re-observe',
    tools: 'personal-world repo status', entries: 'personal-world journal list',
    running: 'personal-world memory search', companions: 'personal-world companions list',
    humans: 'personal-world actors', albums: 'personal-world media library',
    watching: 'personal-world media recent', capabilities: 'personal-world lab health',
    providers: 'personal-world lab inventory', decks: 'personal-world places'
  };

  /* ── Live attention from the world projection ──
     Replaces the hardcoded ATTN specimen. Reads real
     proposal/reminder counts from PW_WORLD_STATE. */
  function liveAttention() {
    var ws = window.PW_WORLD_STATE && window.PW_WORLD_STATE.current();
    if (!ws) return {};
    var attn = {};
    ws.sections.forEach(function (s) {
      if (s.attentionCount > 0) {
        attn[s.id] = s.attentionCount;
      }
    });
    return attn;
  }
  /* ── Live section state from the world projection ──
     Returns { status, statusLabel, mood, configured } for a section,
     or null if not available. */
  function liveSectionState(id) {
    var ws = window.PW_WORLD_STATE && window.PW_WORLD_STATE.current();
    if (!ws) return null;
    return ws.sections.find(function (s) { return s.id === id; }) || null;
  }

  var sky = document.getElementById('sky');
  var crumb = document.getElementById('sky-crumb');
  var info = document.getElementById('sky-info');
  var dive = document.getElementById('sky-dive');
  if (!sky || !crumb) { return; }

  /* ── structure patching ── */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function readStruct() {
    try { return JSON.parse(localStorage.getItem('pw-map-structure') || '{}'); } catch (e) { return {}; }
  }
  function writeStruct(s) {
    try { localStorage.setItem('pw-map-structure', JSON.stringify(s)); } catch (e) {}
  }
  function find(node, id, parent) {
    if (node.id === id) { return { node: node, parent: parent }; }
    var out = null;
    (node.children || []).forEach(function (c) {
      if (!out) { out = find(c, id, node); }
    });
    return out;
  }
  function regionPrefs(id) {
    try { return JSON.parse(localStorage.getItem('pw-region-' + id) || '{}'); } catch (e) { return {}; }
  }
  function viewTree() {
    var t = clone(buildDefaultTree());
    var s = readStruct();
    (s.hide || []).forEach(function (id) {
      var f = find(t, id, null);
      if (f && f.parent) {
        f.parent.children = f.parent.children.filter(function (c) { return c.id !== id; });
      }
    });
    Object.keys(s.rename || {}).forEach(function (id) {
      var f = find(t, id, null);
      if (f) { f.node.name = s.rename[id]; }
    });
    Object.keys(s.move || {}).forEach(function (id) {
      var target = s.move[id];
      var f = find(t, id, null);
      var p = target === 'world' ? { node: t } : find(t, target, null);
      if (!f || !f.parent || !p) { return; }
      f.parent.children = f.parent.children.filter(function (c) { return c.id !== id; });
      (p.node.children = p.node.children || []).push(f.node);
    });
    (s.add || []).forEach(function (a) {
      var p = a.parent === 'world' ? { node: t } : find(t, a.parent, null);
      if (!p) { return; }
      (p.node.children = p.node.children || []).push(
        { id: a.id, name: a.name, color: a.color || 'world', objects: [], custom: true });
    });
    return t;
  }

  var path = [];
  var current = null;
  var selectedCluster = null;

  /* ── custom positions (drag-and-drop) ── */
  function readPositions(regionId) {
    try { return JSON.parse(localStorage.getItem('pw-positions-' + regionId) || '{}'); } catch (e) { return {}; }
  }
  function writePositions(regionId, positions) {
    try { localStorage.setItem('pw-positions-' + regionId, JSON.stringify(positions)); } catch (e) {}
  }
  function clearPositions(regionId) {
    try { localStorage.removeItem('pw-positions-' + regionId); } catch (e) {}
  }

  function resolve(root, p) {
    var n = root;
    for (var i = 0; i < p.length; i++) {
      var found = null;
      (n.children || []).forEach(function (c) { if (c.id === p[i]) { found = c; } });
      if (!found) { return root; }
      n = found;
    }
    return n;
  }

  (function initStart() {
    var start = sky.getAttribute('data-start');
    if (start) { path = [start]; }
  })();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function organic(i, n, id) {
    var GA = 2.399963229728653;
    var theta = i * GA + (hash(id) % 100) / 100 * 0.6;
    var rr = Math.sqrt((i + 0.55) / n);
    var jx = ((hash(id + 'x') % 9) - 4);
    var jy = ((hash(id + 'y') % 9) - 4);
    // Clamp so orbs stay inside .sky on narrow viewports (~390 px).
    return {
      x: clamp(50 + Math.cos(theta) * rr * 38 + jx, 12, 88),
      y: clamp(50 + Math.sin(theta) * rr * 33 + jy, 10, 90)
    };
  }
  function mass(k) {
    var c = k.children ? k.children.length : (k.objects || []).length;
    return 36 + Math.min(c, 6) * 5;
  }

  function render(zoom) {
    current = resolve(viewTree(), path);
    var rp = regionPrefs(current.id);
    var forceLeaf = (rp.depth === 1);
    var kids = (current.children || []).slice();
    var saved = readPositions(current.id);
    var pts = kids.map(function (k, i) {
      if (saved[k.id]) { return saved[k.id]; }
      return organic(i, kids.length, k.id);
    });

    var cr = '<button type="button" id="sky-out"' + (path.length ? '' : ' hidden') + '>&larr; Zoom out</button>' +
             '<span class="crumb-here">' + esc(current.name) + '</span>' +
             '<span class="crumb-sep" aria-hidden="true">&middot;</span>' +
             '<span style="font-size:var(--fs-micro);color:var(--text-faint)">' +
             (current.kind === 'galaxy' ? kids.length + ' constellations' : kids.length + ' bodies in this region') +
             '</span>';
    crumb.innerHTML = cr;

    // Only show the breadcrumb if we're not at the galaxy level (avoid redundancy with h1)
    crumb.style.display = current.kind === 'galaxy' ? 'none' : 'flex';

    var region = document.getElementById('topbar-region');
    if (region) {
      region.textContent = current.kind === 'galaxy'
        ? 'systems map'
        : current.name.toLowerCase() + (selectedCluster ? ' · ' + selectedCluster : '');
    }

    var lines = '';
    if (current.kind !== 'galaxy') {
      pts.forEach(function (p, i) {
        lines += '<line class="thread-line ' + esc(kids[i].color) + '" x1="50%" y1="50%" x2="' +
                 p.x.toFixed(1) + '%" y2="' + p.y.toFixed(1) + '%"/>';
      });
      kids.forEach(function (k, i) {
        (k.links || []).forEach(function (lid) {
          var j = -1;
          kids.forEach(function (x, xi) { if (x.id === lid) { j = xi; } });
          if (j > i) {
            lines += '<line class="thread-line world" x1="' + pts[i].x.toFixed(1) + '%" y1="' + pts[i].y.toFixed(1) +
                     '%" x2="' + pts[j].x.toFixed(1) + '%" y2="' + pts[j].y.toFixed(1) + '%"/>';
          }
        });
      });
    }

    var html = '<span class="orbit" style="width:74%;height:66%"></span>' +
               '<span class="orbit" style="width:52%;height:46%"></span>' +
               '<svg class="threads" aria-hidden="true" focusable="false">' + lines + '</svg>';

    kids.forEach(function (k, i) {
      var egg = k.egg ? '<span class="node-egg" aria-hidden="true"><svg><use href="chars.svg#char-' +
                        esc(k.egg) + '"/></svg></span>' : '';
      var isDrill = !!k.children && !forceLeaf;
      var isSel = selectedCluster === k.id;
      var attn = liveAttention()[k.id] || 0;
      var secState = liveSectionState(k.id);
      var mood = secState ? secState.mood : '';
      var scale = (1 + Math.min(attn, 4) * 0.06).toFixed(2);
      // Sleeping nodes are slightly smaller and dimmer
      if (mood === 'sleeping' || mood === 'off') {
        scale = (0.7 + Math.min(attn, 4) * 0.06).toFixed(2);
      }
      var moodClass = mood ? ' mood-' + mood : '';
      html += '<span class="drift" style="left:' + pts[i].x.toFixed(1) + '%;top:' + pts[i].y.toFixed(1) +
              '%;--ddur:' + (20 + (hash(k.id) % 18)) + 's;--ddelay:-' + (hash(k.id + 'd') % 20) + 's">' +
              '<button type="button" class="node' + (isSel ? ' sel' : '') + (attn ? ' attn' : '') +
              (isDrill ? ' drill' : '') + moodClass + '" data-id="' + esc(k.id) + '" ' +
              'style="--node-color:' + COLORS[k.color] + ';--nscale:' + scale + ';--orb:' + mass(k) + 'px" ' +
              'aria-label="' + esc(k.name) +
              (secState && secState.statusLabel ? ', ' + secState.statusLabel + ',' : '') +
              (attn ? ' ' + attn + ' item' + (attn === 1 ? '' : 's') + ' need you,' : '') +
              (isDrill ? ' enter region' : ' show what is in it') + '">' +
              '<span class="node-orb" aria-hidden="true">' +
              '<svg class="node-ic" focusable="false"><use href="icons.svg#ic-' + (ICON[k.id] || 'sparkle') + '"/></svg>' +
              egg + '</span>' +
              '<span class="node-line"><span class="node-label">' + esc(k.name) + '</span></span>' +
              '</button></span>';
    });

    sky.innerHTML = html;

    // info strip: real activity / provenance / suggestion / needs-you-IN-WORDS
    var ws = window.PW_WORLD_STATE && window.PW_WORLD_STATE.current();
    var needsWords = kids.map(function (k) {
      var a = liveAttention()[k.id];
      return a ? esc(k.name) + ' (' + a + ')' : null;
    }).filter(Boolean).join(', ');

    // Real section states in words
    var sectionStates = kids.map(function (k) {
      var ss = liveSectionState(k.id);
      if (!ss || !ss.statusLabel) return null;
      return esc(k.name) + ': ' + esc(ss.statusLabel);
    }).filter(Boolean).join(' · ');

    if (info) {
      var noteLine = '';
      if (ws && ws.unchecked && ws.unchecked.length) {
        noteLine = '<div><span class="il">Map note</span> some sources could not be checked (' +
          esc(ws.unchecked.join(', ')) + ') — this view is honest about what it does not know</div>';
      } else if (sectionStates) {
        noteLine = '<div><span class="il">Map note</span> ' + sectionStates + '</div>';
      } else {
        noteLine = '<div><span class="il">Map note</span> reading the world now…</div>';
      }

      var recentLine = '';
      if (ws && ws.recentActivity && ws.recentActivity.length) {
        var latest = ws.recentActivity[0];
        recentLine = '<div><span class="il">Recently</span> ' + esc(latest.summary || 'quiet') + '</div>';
      } else {
        recentLine = '<div><span class="il">Recently</span> ' + esc(current.activity || 'quiet') + '</div>';
      }

      info.innerHTML =
        noteLine +
        recentLine +
        '<div><span class="il">From</span> ' + esc(current.provenance || '—') + '</div>' +
        (current.rec ? '<div><span class="il">Suggests</span> ' + esc(current.rec) + '</div>' : '') +
        '<div><span class="il">Needs you here</span> ' + (needsWords || 'nothing in view') + '</div>';
    }
    if (dive) { dive.hidden = true; dive.innerHTML = ''; }

    // Constellations with dedicated pages — clicking navigates there
    // instead of drilling into the map. Nodes without pages keep the
    // drill-down behavior. Built from the shared sections config.
    var PAGES = {};
    (window.PW_SECTIONS || []).forEach(function (s) { PAGES[s.id] = s.href; });

    document.getElementById('sky-out').addEventListener('click', zoomOut);
    sky.querySelectorAll('.node').forEach(function (b) {
      b.addEventListener('click', function (e) {
        // Don't fire click if we just finished a drag
        if (b._dragMoved) { b._dragMoved = false; return; }
        var id = b.getAttribute('data-id');
        // Galaxy-level constellations with dedicated pages → navigate
        if (current.kind === 'galaxy' && PAGES[id]) {
          window.location.href = PAGES[id];
          return;
        }
        activate(id);
      });
      setupDrag(b);
    });

    // Keyboard nudge: arrow keys move focused node by 2%
    sky.addEventListener('keydown', function (e) {
      var focused = document.activeElement;
      if (!focused || !focused.classList.contains('node')) { return; }
      var id = focused.getAttribute('data-id');
      var drift = focused.closest('.drift');
      if (!drift || !id) { return; }
      var step = e.shiftKey ? 5 : 2;
      var dx = 0, dy = 0;
      if (e.key === 'ArrowLeft')  { dx = -step; }
      if (e.key === 'ArrowRight') { dx = step; }
      if (e.key === 'ArrowUp')    { dy = -step; }
      if (e.key === 'ArrowDown')  { dy = step; }
      if (!dx && !dy) { return; }
      e.preventDefault();
      var regionId = current.id;
      var pos = readPositions(regionId);
      var cur = pos[id] || organic(
        Array.from(current.children || []).findIndex(function(c){return c.id===id}),
        (current.children||[]).length, id);
      var nx = Math.max(5, Math.min(95, cur.x + dx));
      var ny = Math.max(5, Math.min(95, cur.y + dy));
      pos[id] = { x: nx, y: ny };
      writePositions(regionId, pos);
      drift.style.left = nx.toFixed(1) + '%';
      drift.style.top = ny.toFixed(1) + '%';
    });

    if (zoom) {
      sky.classList.remove('zooming');
      void sky.offsetWidth;
      sky.classList.add('zooming');
    }
    setMood();
  }

  /* ── Drag and drop for planets ──
     Pointer events for mouse + touch. A drag under 4px counts as a click.
     Positions saved per-region in localStorage. */
  function setupDrag(nodeBtn) {
    var drift = nodeBtn.closest('.drift');
    if (!drift) { return; }
    var startX, startY, startLeft, startTop, dragging = false;
    var SKY = sky;
    var DRAG_THRESHOLD = 4;

    function pctX(px) { return (px / SKY.offsetWidth) * 100; }
    function pctY(px) { return (px / SKY.offsetHeight) * 100; }

    nodeBtn.addEventListener('pointerdown', function (e) {
      // Only drag on the orb, not the label
      if (!e.target.closest('.node-orb')) { return; }
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(drift.style.left) || 50;
      startTop = parseFloat(drift.style.top) || 50;
      dragging = false;
      nodeBtn.setPointerCapture(e.pointerId);
      nodeBtn._dragMoved = false;
    });

    nodeBtn.addEventListener('pointermove', function (e) {
      if (startX === undefined) { return; }
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!dragging && (Math.abs(dx) + Math.abs(dy)) < DRAG_THRESHOLD) { return; }
      dragging = true;
      nodeBtn._dragMoved = true;
      e.preventDefault();
      var nx = Math.max(5, Math.min(95, startLeft + pctX(dx)));
      var ny = Math.max(5, Math.min(95, startTop + (e.clientY - startY) / SKY.offsetHeight * 100));
      drift.style.left = nx.toFixed(1) + '%';
      drift.style.top = ny.toFixed(1) + '%';
    });

    nodeBtn.addEventListener('pointerup', function (e) {
      if (startX === undefined) { return; }
      if (dragging) {
        // Save the new position
        var id = nodeBtn.getAttribute('data-id');
        var regionId = current.id;
        var pos = readPositions(regionId);
        pos[id] = {
          x: parseFloat(drift.style.left),
          y: parseFloat(drift.style.top)
        };
        writePositions(regionId, pos);
      }
      startX = undefined;
      dragging = false;
    });

    nodeBtn.addEventListener('pointercancel', function () {
      startX = undefined;
      dragging = false;
    });
  }

  function setMood() {
    try {
      if (localStorage.getItem('pw-station-mood') === 'off') { document.documentElement.removeAttribute('data-mood'); return; }
    } catch (e) {}
    if (!current || current.kind === 'galaxy') { document.documentElement.removeAttribute('data-mood'); }
    else { document.documentElement.setAttribute('data-mood', current.color || 'world'); }
  }

  function activate(id) {
    var target = null;
    (current.children || []).forEach(function (c) { if (c.id === id) { target = c; } });
    if (!target) { return; }
    var forceLeaf = (regionPrefs(current.id).depth === 1);
    if (target.children && !forceLeaf) {
      path.push(target.id);
      selectedCluster = null;
      render(true);
      sky.focus();
    } else {
      selectedCluster = target.id;
      render(false);
      openDive(target);
    }
  }

  function zoomOut() {
    if (selectedCluster) { selectedCluster = null; if (dive) { dive.hidden = true; } render(true); return; }
    if (!path.length) { return; }
    path.pop();
    selectedCluster = null;
    render(true);
    sky.focus();
  }

  function openDive(cluster) {
    if (!dive) { return; }
    var objs = cluster.objects || [];
    var subs = cluster.children || [];
    dive.hidden = false;

    /* Show real section status when available (from the world projection).
       Sections without pages (today, media, lab, vault) reach this path
       because PAGES[id] is null, so the click handler falls through to
       activate() → openDive(). Instead of a generic "quiet" message,
       show the honest status from the backend. */
    var secState = liveSectionState(cluster.id);
    var statusCopy = secState ? secState.statusLabel : null;
    var statusMood = secState ? secState.mood : '';

    var body;
    if (objs.length) {
      body = '<ul class="dive-list">' + objs.map(function (o) {
        return '<li><span class="t">' + esc(o.t) + '</span>' +
               '<span class="s">' + esc(o.src) + (o.when ? ' · ' + esc(o.when) : '') + '</span></li>';
      }).join('') + '</ul>';
    } else if (subs.length) {
      body = '<ul class="dive-list">' + subs.map(function (s) {
        return '<li><span class="t">' + esc(s.name) + '</span><span class="s">sub-region · enter from the map</span></li>';
      }).join('') + '</ul>';
    } else if (statusCopy) {
      /* Real status from the backend — honest about what this section is */
      body = '<div class="state"><div class="state-title">' + esc(cluster.name) + ': ' + esc(statusCopy) + '</div>' +
        '<p>' + diveStatusCopy(cluster.id, secState) + '</p></div>';
    } else {
      body = '<div class="state"><div class="state-title">This corner is quiet for now ✦</div>' +
        '<p>Add something when you are ready — or don\'t. Both are fine.</p></div>';
    }

    var metaText = objs.length ? objs.length + ' items'
      : subs.length ? subs.length + ' bodies in this region'
      : statusCopy || 'quiet';

    dive.innerHTML =
      '<div class="dive-head"><span class="dive-title">' + esc(cluster.name) + '</span>' +
      '<span class="dive-meta">' + esc(metaText) + '</span></div>' +
      body +
      '<details class="tech"><summary>technical · the command behind this</summary><div class="tech-body">' +
      '$ ' + esc(CMD[cluster.id] || CMD[current.id] || 'personal-world status') + '<br>' +
      'provenance: ' + esc(cluster.provenance || current.provenance || '—') + '<br>' +
      'activity: ' + esc(cluster.activity || '—') + '<br>' +
      'writes follow observe → diff → propose → approve → act → re-observe' +
      '</div></details>';
    dive.focus();
  }

  /* Warm, honest copy for sections that exist but aren't set up.
     Each section gets a brief, companion-voiced explanation of what
     it IS — not a technical error, just an honest absence. */
  function diveStatusCopy(id, secState) {
    var status = secState ? secState.status : null;
    var copies = {
      today: {
        healthy: 'Your day is here, and it\'s looking good. ✦',
        not_configured: 'Today is where your morning briefing will live — once a few more pieces are connected, it\'ll greet you here every day.',
        unavailable: 'Today can\'t reach its data source right now. It\'ll be back.',
        _default: 'Today is waking up. It\'ll be here soon.'
      },
      media: {
        healthy: 'Your library is here and ready to browse.',
        not_configured: 'Media is where your books, shows, and music will live. Connect a media source and this corner will come alive.',
        unavailable: 'Media can\'t reach its source right now. It\'ll be back.',
        _default: 'Media is resting. It\'ll wake up when you connect a source.'
      },
      lab: {
        healthy: 'Your lab is running and healthy.',
        not_configured: 'Lab is where your homelab and infrastructure live. Connect your services and this corner will show you how they\'re doing.',
        unavailable: 'Lab can\'t reach its data right now. It\'ll be back.',
        _default: 'Lab is quiet. It\'ll come alive when you connect your services.'
      },
      vault: {
        healthy: 'Your vault is sealed and healthy.',
        not_configured: 'Vault is where your secrets and credentials are stored safely. It\'ll show status once the vault is unlocked.',
        unavailable: 'Vault can\'t be reached right now. It\'ll be back.',
        _default: 'Vault is sealed. It\'ll open when you\'re ready.'
      },
      interests: {
        healthy: 'Your interests are here and being watched.',
        not_configured: 'Interests is where the things you follow live. Add something you\'re curious about — even a half-formed thought counts.',
        unavailable: 'Interests can\'t be checked right now. It\'ll be back.',
        _default: 'Interests is quiet. Add something when you\'re ready.'
      },
      journal: {
        healthy: 'Your journal is here with recent entries.',
        not_configured: 'Journal is where your history lives. Write something — or let the companion note things for you.',
        unavailable: 'Journal can\'t be read right now. It\'ll be back.',
        _default: 'Journal is quiet. Write when you\'re ready.'
      },
      projects: {
        healthy: 'Your repositories are here and healthy.',
        not_configured: 'Projects is where your source control lives. Point it at a repo and it\'ll show you what\'s happening.',
        unavailable: 'Projects can\'t check your repos right now. It\'ll be back.',
        _default: 'Projects is quiet. It\'ll show your repos when connected.'
      },
      chat: {
        healthy: 'Your companion is here and ready to talk.',
        not_configured: 'Chat is where you talk to your companion. Once a model is connected, it\'ll answer.',
        unavailable: 'Chat can\'t reach its model right now. It\'ll be back.',
        _default: 'Chat is resting. Your companion will be here when you\'re ready.'
      },
      settings: {
        healthy: 'Settings is here — your preferences are loaded.',
        _default: 'Settings is where you tune how this looks and feels.'
      }
    };
    var sectionCopy = copies[id];
    if (!sectionCopy) {
      return 'This corner of your world is quiet for now. ✦';
    }
    var copy = sectionCopy[status] || sectionCopy._default;
    return copy || 'This corner of your world is quiet for now. ✦';
  }

  sky.setAttribute('tabindex', '-1');
  render(false);
  window.addEventListener('pw:prefs', function () { setMood(); });
  /* Re-render when canonical sections or world state arrive late.
     The first render uses the sections.js fallback; when /api/sections
     answers, 'pw:sections-loaded' fires and the map rebuilds from the
     real registry. Same for world-state (attention/moods). Neither
     event is dispatched by render(), so no loop. */
  window.addEventListener('pw:sections-loaded', function () { render(false); });
  window.addEventListener('pw:world-state', function () { render(false); });
  window.PW_MAP_REFRESH = function () { render(true); };
  window.PW_MAP_API = { viewTree: viewTree, find: find, readStruct: readStruct, writeStruct: writeStruct, regionPrefs: regionPrefs };

  /* ambient companion egg: one per session, late, small, dismissible */
  (function ambient() {
    try {
      if (sessionStorage.getItem('pw-egg-shown')) { return; }
      if (localStorage.getItem('pw-station-companions') === 'off') { return; }
    } catch (e) { return; }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    setTimeout(function () {
      if (!sky || sky.querySelector('.egg-visit')) { return; }
      var who = ['mermaid', 'ratatoskr', 'robot', 'burrito'][Math.floor(Math.random() * 4)];
      var el = document.createElement('span');
      el.className = 'egg-visit';
      el.setAttribute('aria-hidden', 'true');
      el.style.left = (18 + Math.random() * 60).toFixed(0) + '%';
      el.style.top = (16 + Math.random() * 60).toFixed(0) + '%';
      el.innerHTML = '<svg><use href="chars.svg#char-' + who + '"/></svg>' +
                     '<button type="button" class="egg-shoo" tabindex="-1" aria-hidden="true">&times;</button>';
      sky.appendChild(el);
      try { sessionStorage.setItem('pw-egg-shown', '1'); } catch (e) {}
      var shoo = el.querySelector('.egg-shoo');
      if (shoo) { shoo.addEventListener('click', function () { el.remove(); }); }
      setTimeout(function () { if (el.isConnected) { el.remove(); } }, 14000);
    }, 45000);
  })();
})();
