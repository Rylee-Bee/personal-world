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

  var DEFAULT_TREE = {
    id: 'world', name: 'Systems Map', kind: 'galaxy',
    activity: 'nothing needs you; routine work is batched behind the glass',
    provenance: 'personal-world status',
    rec: 'start anywhere, or nowhere. Both are valid.',
    children: [
      { id: 'interests', name: 'Interests', color: 'ai', egg: 'ratatoskr', links: ['media', 'projects'],
        activity: 'last new thread 3 days ago', provenance: 'API-051 · API-016',
        rec: 'the World thinks "local-first" is a value, not a phase',
        children: [
          { id: 'ai', name: 'AI & local-first', color: 'ai', links: ['reading'],
            activity: '4 new items this month', provenance: 'API-051',
            rec: 'two unread sources match this closely',
            objects: [ O('Nothing here yet', 'real items arrive when a discovery source is connected', '') ] },
          { id: 'music', name: 'Music', color: 'music', links: ['media'],
            activity: 'an album you returned to 4x', provenance: 'API-051 · API-054',
            rec: 'adjacent artists you have not heard',
            objects: [ O('Nothing here yet', 'your listening history arrives when a music source is connected', '') ] },
          { id: 'reading', name: 'Reading', color: 'reading', links: ['ai'],
            activity: 'the seed of most of your projects', provenance: 'API-051',
            rec: 'one long-read held for you',
            objects: [ O('Nothing here yet', 'saved reads arrive when a reading source is connected', '') ] }
        ]},
      { id: 'projects', name: 'Projects', color: 'build', egg: 'robot', links: ['systems', 'journal'],
        activity: 'one repo with local work', provenance: 'API-079 · API-033',
        rec: 'nothing urgent; a dirty tree is information',
        children: [
          { id: 'pw', name: 'personal-world', color: 'build', links: ['systems'],
            activity: 'ahead of origin', provenance: 'API-033',
            rec: 'review diff, then approve a refresh',
            objects: [ O('Nothing charted yet', 'commits and branches arrive from source-control status', '') ] },
          { id: 'tools', name: 'Tools & models', color: 'build', links: [],
            activity: 'quiet', provenance: 'API-079', rec: '',
            objects: [ O('Nothing charted yet', 'tools arrive from the estate inventory', '') ] }
        ]},
      { id: 'journal', name: 'Journal', color: 'reading', links: ['people'],
        activity: 'you stopped mid-thought 4 days ago', provenance: 'API-005',
        rec: 'pick it up, or leave it; both are fine',
        children: [
          { id: 'entries', name: 'Entries', color: 'reading', links: [],
            activity: 'your words, as you wrote them', provenance: 'API-005', rec: '',
            objects: [ O('Nothing charted yet', 'your written entries arrive from the journal', '') ] },
          { id: 'running', name: 'Running threads', color: 'reading', links: ['interests'],
            activity: 'where you left off', provenance: 'API-005 · API-016', rec: '',
            objects: [ O('Nothing charted yet', 'running threads arrive from journal and memory', '') ] }
        ]},
      { id: 'people', name: 'People', color: 'creative', egg: 'mermaid', links: ['journal'],
        activity: 'companions present; humans as you add them', provenance: 'companion registry',
        rec: 'nobody needs you right now',
        children: [
          { id: 'companions', name: 'Companions', color: 'creative', links: [],
            activity: 'your chosen companion travels with you', provenance: 'companion registry', rec: '',
            objects: [ O('Mermaid', 'chat companion', 'now'), O('Ratatoskr', 'chat companion', 'recent'),
                       O('Robot', 'chat companion', 'recent'), O('Burrito Journalism', 'chat companion', 'sometimes') ] },
          { id: 'humans', name: 'Humans', color: 'creative', links: [],
            activity: 'empty until you say otherwise', provenance: 'API-014', rec: '',
            objects: [] }
        ]},
      { id: 'media', name: 'Media', color: 'music', egg: 'burrito', links: ['interests'],
        activity: 'no adapters connected — unknown, not broken', provenance: 'API-053..057',
        rec: 'connect a source and this fills with your library',
        children: [
          { id: 'albums', name: 'Albums', color: 'music', links: ['music'],
            activity: '—', provenance: 'API-054', rec: '', objects: [] },
          { id: 'watching', name: 'Watching', color: 'music', links: [],
            activity: '—', provenance: 'API-054', rec: '', objects: [] }
        ]},
      { id: 'systems', name: 'Systems', color: 'world', links: ['projects'],
        activity: 'routine work batched, nothing needs you', provenance: 'API-020 · API-058',
        rec: 'health on demand, never loud',
        children: [
          { id: 'capabilities', name: 'Capabilities', color: 'world', links: ['providers'],
            activity: 'mixed states, all honest', provenance: 'API-020', rec: '',
            objects: [ O('source_control', 'healthy', 'now'), O('discovery', 'not set up yet', 'now'),
                       O('media', 'not sure yet', 'now') ] },
          { id: 'providers', name: 'Providers', color: 'world', links: [],
            activity: 'machinery; replaceable', provenance: 'API-037..048', rec: '',
            objects: [ O('Nothing charted yet', 'providers arrive from the lab inventory', '') ] }
        ]},
      { id: 'places', name: 'Places', color: 'reading', links: [],
        activity: 'this Station, and anywhere you add', provenance: 'this Station',
        rec: 'places are presences; they speak up when needed',
        children: [
          { id: 'decks', name: 'Decks', color: 'reading', links: [],
            activity: 'quiet rooms you can duck into', provenance: 'this Station', rec: '',
            objects: [ O('Observation Deck', 'you are here', 'now'), O('Making', 'workshop.html', ''),
                       O('Under the hood', 'engine.html', ''), O('Care', 'medbay.html', '') ] }
        ]}
    ]
  };

  var COLORS = {
    ai: 'var(--lavender)', music: 'var(--coral)', build: 'var(--teal)',
    reading: 'var(--gold)', creative: 'var(--green)', world: 'var(--cream)'
  };
  var ICON = {
    interests: 'sparkle', projects: 'wrench', journal: 'pen', people: 'heart',
    media: 'film', systems: 'cloud', places: 'compass',
    ai: 'brain', music: 'music', reading: 'book', papers: 'book',
    pw: 'wrench', tools: 'gear', entries: 'pen', running: 'pen',
    companions: 'heart', humans: 'heart', albums: 'music', watching: 'film',
    capabilities: 'cloud', providers: 'cloud', decks: 'compass', care: 'leaf', rest: 'leaf'
  };
  var ATTN = { projects: 1, journal: 1, pw: 1, capabilities: 1 };
  var CMD = {
    world: 'personal-world status', interests: 'personal-world discovery interests',
    projects: 'personal-world repo status', journal: 'personal-world journal list',
    people: 'personal-world companions list', media: 'personal-world media status',
    systems: 'personal-world lab health', places: 'personal-world places',
    pw: 'personal-world repo diff  →  propose  →  approve  →  act  →  re-observe',
    tools: 'personal-world repo status', entries: 'personal-world journal list',
    running: 'personal-world memory search', companions: 'personal-world companions list',
    humans: 'personal-world actors', albums: 'personal-world media library',
    watching: 'personal-world media recent', capabilities: 'personal-world lab health',
    providers: 'personal-world lab inventory', decks: 'personal-world places'
  };

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
    var t = clone(DEFAULT_TREE);
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
  function organic(i, n, id) {
    var GA = 2.399963229728653;
    var theta = i * GA + (hash(id) % 100) / 100 * 0.6;
    var rr = Math.sqrt((i + 0.55) / n);
    var jx = ((hash(id + 'x') % 9) - 4);
    var jy = ((hash(id + 'y') % 9) - 4);
    return { x: 50 + Math.cos(theta) * rr * 38 + jx, y: 50 + Math.sin(theta) * rr * 33 + jy };
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
             (current.kind === 'galaxy' ? 'seven constellations' : kids.length + ' bodies in this region') +
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
      var attn = ATTN[k.id] || 0;
      var scale = (1 + Math.min(attn, 4) * 0.06).toFixed(2);
      html += '<span class="drift" style="left:' + pts[i].x.toFixed(1) + '%;top:' + pts[i].y.toFixed(1) +
              '%;--ddur:' + (20 + (hash(k.id) % 18)) + 's;--ddelay:-' + (hash(k.id + 'd') % 20) + 's">' +
              '<button type="button" class="node' + (isSel ? ' sel' : '') + (attn ? ' attn' : '') +
              (isDrill ? ' drill' : '') + '" data-id="' + esc(k.id) + '" ' +
              'style="--node-color:' + COLORS[k.color] + ';--nscale:' + scale + ';--orb:' + mass(k) + 'px" ' +
              'aria-label="' + esc(k.name) +
              (attn ? ', ' + attn + ' item' + (attn === 1 ? '' : 's') + ' need you,' : '') +
              (isDrill ? ' enter region' : ' show what is in it') + '">' +
              '<span class="node-orb" aria-hidden="true">' +
              '<svg class="node-ic" focusable="false"><use href="icons.svg#ic-' + (ICON[k.id] || 'sparkle') + '"/></svg>' +
              egg + '</span>' +
              '<span class="node-line"><span class="node-label">' + esc(k.name) + '</span></span>' +
              '</button></span>';
    });

    sky.innerHTML = html;

    // info strip: activity / provenance / suggestion / needs-you-IN-WORDS
    var needsWords = kids.filter(function (k) { return ATTN[k.id]; })
      .map(function (k) { return esc(k.name) + ' (' + ATTN[k.id] + ')'; }).join(', ');
    if (info) {
      info.innerHTML =
        '<div><span class="il">Map note</span> illustrative specimen data — real sources fill this in as they connect</div>' +
        '<div><span class="il">Recently</span> ' + esc(current.activity || 'quiet') + '</div>' +
        '<div><span class="il">From</span> ' + esc(current.provenance || '—') + '</div>' +
        (current.rec ? '<div><span class="il">Suggests</span> ' + esc(current.rec) + '</div>' : '') +
        '<div><span class="il">Needs you here</span> ' + (needsWords || 'nothing in view') + '</div>';
    }
    if (dive) { dive.hidden = true; dive.innerHTML = ''; }

    document.getElementById('sky-out').addEventListener('click', zoomOut);
    sky.querySelectorAll('.node').forEach(function (b) {
      b.addEventListener('click', function (e) {
        // Don't fire click if we just finished a drag
        if (b._dragMoved) { b._dragMoved = false; return; }
        activate(b.getAttribute('data-id'));
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
    var body = objs.length
      ? '<ul class="dive-list">' + objs.map(function (o) {
          return '<li><span class="t">' + esc(o.t) + '</span>' +
                 '<span class="s">' + esc(o.src) + (o.when ? ' · ' + esc(o.when) : '') + '</span></li>';
        }).join('') + '</ul>'
      : (subs.length
          ? '<ul class="dive-list">' + subs.map(function (s) {
              return '<li><span class="t">' + esc(s.name) + '</span><span class="s">sub-region · enter from the map</span></li>';
            }).join('') + '</ul>'
          : '<div class="state"><div class="state-title">This corner is quiet for now ✦</div>' +
            'Add something when you are ready — or don\'t. Both are fine.</div>');
    dive.innerHTML =
      '<div class="dive-head"><span class="dive-title">' + esc(cluster.name) + '</span>' +
      '<span class="dive-meta">' + esc(objs.length || subs.length) + ' items · specimen</span></div>' +
      body +
      '<details class="tech"><summary>technical · the command behind this</summary><div class="tech-body">' +
      '$ ' + esc(CMD[cluster.id] || CMD[current.id] || 'personal-world status') + '<br>' +
      'provenance: ' + esc(cluster.provenance || current.provenance || '—') + '<br>' +
      'activity: ' + esc(cluster.activity || '—') + '<br>' +
      'writes follow observe → diff → propose → approve → act → re-observe' +
      '</div></details>';
    dive.focus();
  }

  sky.setAttribute('tabindex', '-1');
  render(false);
  window.addEventListener('pw:prefs', function () { setMood(); });
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
