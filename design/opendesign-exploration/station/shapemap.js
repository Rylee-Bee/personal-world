/* SHAPE THIS MAP — the taxonomy is user data, not product law.
   Add clusters, rename them, re-parent them (merge books+audio under Media,
   or split Music into twenty bands), hide defaults, and nest to any depth.
   Also sets how many levels a region reveals at once.

   Stored as a structure patch (pw-map-structure) + per-region prefs
   (pw-region-<id>); the map re-renders from the patched view. Nothing here
   touches real domain data — it only shapes how YOUR map is organised.
*/
(function () {
  'use strict';

  var host = document.getElementById('shape-map');
  if (!host || !window.PW_MAP_API) { return; }
  var API = window.PW_MAP_API;

  var scope = host.getAttribute('data-region') || 'world';

  function flatten(node, depth, out, parentId) {
    out.push({ id: node.id, name: node.name, depth: depth, parent: parentId,
               custom: !!node.custom, kids: !!(node.children && node.children.length) });
    (node.children || []).forEach(function (c) { flatten(c, depth + 1, out, node.id); });
    return out;
  }
  function descendants(node, acc) {
    acc = acc || [];
    (node.children || []).forEach(function (c) { acc.push(c.id); descendants(c, acc); });
    return acc;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render() {
    var tree = API.viewTree();
    var nodes = flatten(tree, 0, [], null);
    var ids = nodes.map(function (n) { return n.id; });

    var rows = nodes.map(function (n) {
      var indent = n.depth * 14;
      return '<div class="shape-row" data-id="' + esc(n.id) + '">' +
        '<span class="nm" style="padding-left:' + indent + 'px">' +
          '<span class="d">' + (n.depth ? '└ ' : '') + '</span>' + esc(n.name) +
          (n.custom ? ' <em style="color:var(--text-faint)">(yours)</em>' : '') + '</span>' +
        '<button type="button" data-act="rename">rename</button>' +
        '<select data-act="move" aria-label="Move ' + esc(n.name) + ' under">' +
          '<option value="">move…</option>' +
          ids.filter(function (id) {
            if (id === n.id) { return false; }
            var f = API.find(tree, n.id, null);
            return f && descendants(f.node).indexOf(id) === -1;
          }).map(function (id) { return '<option value="' + esc(id) + '">' + esc(id) + '</option>'; }).join('') +
        '</select>' +
        (n.custom
          ? '<button type="button" data-act="del">remove</button>'
          : '<span style="min-width:52px"></span>') +
        '</div>';
    }).join('');

    host.innerHTML =
      '<p style="font-size:var(--fs-small);color:var(--text-soft);line-height:1.6;margin-bottom:var(--s3)">' +
        'This map is yours to organise. Add a cluster, rename one, tuck something under a ' +
        'different parent, or hide a default. Changes apply to the chart immediately and are ' +
        'remembered on this device.' +
      '</p>' +
      '<div class="shape-add">' +
        '<input type="text" id="shape-name" placeholder="New cluster name (e.g. Synthwave, Bandcamp)" ' +
               'aria-label="New cluster name">' +
        '<select id="shape-parent" aria-label="Parent for new cluster">' +
          ids.map(function (id) { return '<option value="' + esc(id) + '">' + esc(id) + '</option>'; }).join('') +
        '</select>' +
        '<button type="button" data-act="add">Add</button>' +
      '</div>' +
      '<div style="margin-top:var(--s4)">' + rows + '</div>' +
      '<div class="shape-add" style="align-items:center">' +
        '<span style="font-size:var(--fs-small);color:var(--text-soft)">Levels revealed in ' +
        esc(scope === 'world' ? 'each region' : scope) + ':</span>' +
        '<select id="shape-depth" aria-label="Levels revealed">' +
          '<option value="">auto (drill as deep as it goes)</option>' +
          '<option value="1">one level (clusters open straight to their items)</option>' +
        '</select>' +
      '</div>' +
      '<div class="shape-add" style="align-items:center;margin-top:var(--s2)">' +
        '<span style="font-size:var(--fs-small);color:var(--text-soft)">' +
          'Drag planets to rearrange them. Use arrow keys to nudge a focused planet.' +
        '</span>' +
        '<button type="button" data-act="reset-positions" style="margin-left:auto">Reset layout</button>' +
      '</div>';

    var rp = API.regionPrefs(scope);
    var depthSel = host.querySelector('#shape-depth');
    if (depthSel) { depthSel.value = rp.depth === 1 ? '1' : ''; }
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('n' + Date.now());
  }

  host.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) { return; }
    var act = btn.getAttribute('data-act');
    var row = btn.closest('.shape-row');
    var id = row ? row.getAttribute('data-id') : null;
    var s = API.readStruct();
    s.rename = s.rename || {}; s.move = s.move || {}; s.hide = s.hide || []; s.add = s.add || [];

    if (act === 'add') {
      var name = (host.querySelector('#shape-name').value || '').trim();
      var parent = host.querySelector('#shape-parent').value;
      if (!name) { return; }
      s.add.push({ id: slug(name), name: name, parent: parent, color: 'world' });
    }
    if (act === 'del' && id) {
      s.add = s.add.filter(function (a) { return a.id !== id; });
      s.hide.push(id);
    }
    if (act === 'reset-positions') {
      try { localStorage.removeItem('pw-positions-' + scope); } catch (err) {}
      window.PW_MAP_REFRESH();
      render();
      return;
    }
    if (act === 'rename' && id) {
      var nm = row.querySelector('.nm');
      var cur = nm.textContent.replace('└ ', '').replace('(yours)', '').trim();
      nm.innerHTML = '<input type="text" data-rename-input value="' + esc(cur) + '" aria-label="New name">';
      var inp = nm.querySelector('input');
      inp.focus();
      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { commitRename(id, inp.value); }
      });
      return;
    }
    API.writeStruct(s);
    window.PW_MAP_REFRESH();
    render();
  });

  function commitRename(id, val) {
    val = (val || '').trim();
    if (!val) { return; }
    var s = API.readStruct();
    s.rename = s.rename || {};
    s.rename[id] = val;
    API.writeStruct(s);
    window.PW_MAP_REFRESH();
    render();
  }

  host.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'shape-depth') {
      try {
        var key = 'pw-region-' + scope;
        var rp = JSON.parse(localStorage.getItem(key) || '{}');
        if (el.value === '1') { rp.depth = 1; } else { delete rp.depth; }
        localStorage.setItem(key, JSON.stringify(rp));
      } catch (err) {}
      window.PW_MAP_REFRESH();
      return;
    }
    if (el.getAttribute('data-act') === 'move') {
      var row = el.closest('.shape-row');
      var id = row.getAttribute('data-id');
      var target = el.value;
      if (!target) { return; }
      var s = API.readStruct();
      s.move = s.move || {};
      s.move[id] = target;
      API.writeStruct(s);
      window.PW_MAP_REFRESH();
      render();
    }
  });

  render();
})();
