/* ═════════════════════════════════════════════════════
   INTERESTS — real discovery read, honest states, native clusters.

   Rendered into #interests-view on interests.html. Reads the real
   interests list from the server:

      API-051-get GET /api/discovery/interests

   NATIVE MODEL (backend: native_discovery.py Interest):
      { id, name, category, weight, created_at }
   There is no note, no type — the UI does not pretend otherwise.

   CLUSTERS: interests are grouped by their server category.
   Each category is a cluster — the constellation idea. Ungrouped
   interests (no category) live under "Following".

   FOCUS: clicking a card opens a focus drawer (Level 3) with the
   interest's full detail, provenance, and weight. Non-modal,
   Escape closes, focus returns (accessibility contract §3.4).

   HONESTY CONTRACT:
   · No specimen feed. Real states only.
   · This view performs READS ONLY. Adding is API-051-add
     (step-up) via the page's add bar, never here.

   ACCESSIBILITY: semantic lists, real <time> elements, visible
   states in words, 44px controls.
   ═════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MOUNT_ID = 'interests-view';

  function API() { return window.PW_API; }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

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

  /* Weight → plain words. Weight is follow strength (backend float).
     The words carry meaning; any glow is redundant decoration. */
  function weightWord(w) {
    var n = parseFloat(w);
    if (isNaN(n)) return 'following';
    if (n < 0.75) return 'lightly following';
    if (n > 1.5) return 'closely following';
    return 'following';
  }

  /* ── the view ── */
  function build(mount) {
    mount.innerHTML =
      '<div class="cv-head">' +
        '<h2>Your interests</h2>' +
      '</div>' +
      '<p class="rd-loading cv-intro" role="status">Checking your interests…</p>' +
      '<div data-iv-drawer></div>';
    var API_ = API();
    if (!API_) {
      paintUnavailable(mount,
        'The page could not talk to the server just now, so your interests could not be read. ' +
        'Nothing was changed. Try again below.');
      return;
    }
    API_.read('API-051-get').then(function (env) { paint(mount, env); });
  }

  function groupByCategory(interests) {
    var groups = {};
    var order = [];
    interests.forEach(function (i) {
      var cat = (i && i.category) ? String(i.category) : 'Following';
      if (!groups[cat]) { groups[cat] = []; order.push(cat); }
      groups[cat].push(i);
    });
    // "Following" (uncategorized) last; rest alphabetical
    order.sort(function (a, b) {
      if (a === 'Following') return 1;
      if (b === 'Following') return -1;
      return a.localeCompare(b);
    });
    return order.map(function (cat) { return { category: cat, items: groups[cat] }; });
  }

  function paint(mount, env) {
    var head =
      '<div class="cv-head">' +
        '<h2>Your interests</h2>' +
      '</div>' +
      '<div data-iv-drawer></div>';

    if (env && env.ok === false) {
      var message = env.error && env.error.message;
      var isNotSetup = env.status === 'not_configured';
      if (isNotSetup) {
        mount.innerHTML = head +
          '<div class="cv-state-box">' +
            '<span class="cv-state-label">not set up yet</span>' +
            '<h3>Interests are not set up yet</h3>' +
            '<p>Interests are stored in this server’s own discovery settings. ' +
            'Nothing was found there, so there is nothing to show — and nothing ' +
            'is substituted with sample content.</p>' +
            '<p>Follow something using the form below — it will be saved to your world.</p>' +
          '</div>' +
          technical(env);
        wireDrawer(mount, []);
        // Expose categories (none yet) for the add-bar datalist
        updateCategoryList([]);
        return;
      }
      paintUnavailable(mount, (message ||
        'Your interests could not be read. Nothing was changed. Try again below.'));
      return;
    }

    var interests = (env && env.ok && env.data && Array.isArray(env.data.interests))
      ? env.data.interests : [];

    // Expose categories for the add-bar datalist
    updateCategoryList(interests);

    if (!interests.length) {
      mount.innerHTML = head +
        '<div class="cv-state-box">' +
          '<span class="cv-state-label">empty</span>' +
          '<h3>No interests yet</h3>' +
          '<p>This is your real interests list, read from the server — it is ' +
          'genuinely empty, not sample content. Follow something below — ' +
          'even a half-formed question counts.</p>' +
        '</div>' +
        technical(env);
      wireDrawer(mount, []);
      return;
    }

    var groups = groupByCategory(interests);
    var html = head +
      '<p class="cv-intro">' + esc(interests.length + (interests.length === 1 ? ' interest' : ' interests')) +
      ' in ' + esc(groups.length + (groups.length === 1 ? ' cluster' : ' clusters')) +
      ' — read from the server just now.</p>';

    groups.forEach(function (g) {
      var cards = g.items.map(function (i) {
        var id = i && i.id ? String(i.id) : '';
        var name = i && i.name ? String(i.name) : '(unnamed)';
        var w = weightWord(i && i.weight);
        return '<li>' +
          '<button type="button" class="interest-card iv-card" data-iv-id="' + esc(id) + '" ' +
          'aria-label="' + esc(name) + ', ' + esc(w) + (i && i.created_at ? ', followed since ' + esc(whenText(i.created_at) || '') : '') + '">' +
          '<span class="card-name">' + esc(name) + '</span>' +
          '<span class="card-source">' + esc(w) +
          (i && i.created_at ? ' · followed since ' + timeEl(i.created_at) : '') + '</span>' +
          '</button></li>';
      }).join('');
      html += '<div class="section-divider">' + esc(g.category) + '</div>' +
        '<ul class="interest-grid iv-cluster" aria-label="' + esc(g.category) + '">' + cards + '</ul>';
    });

    html += technical(env);
    mount.innerHTML = html;
    wireDrawer(mount, interests);
  }

  /* ── Focus drawer (Level 3): one interest in depth ── */
  function wireDrawer(mount, interests) {
    var drawerHost = mount.querySelector('[data-iv-drawer]');
    if (!drawerHost) return;
    var byId = {};
    interests.forEach(function (i) { if (i && i.id) byId[String(i.id)] = i; });

    mount.addEventListener('click', function (e) {
      var card = e.target.closest('[data-iv-id]');
      if (!card || !mount.contains(card)) return;
      var item = byId[card.getAttribute('data-iv-id')];
      if (item) openDrawer(drawerHost, item, card);
    });
  }

  function openDrawer(host, item, returnTo) {
    var name = item.name || '(unnamed)';
    var cat = item.category || 'Following';
    host.innerHTML =
      '<div class="iv-focus" role="dialog" aria-modal="false" aria-labelledby="iv-focus-title" tabindex="-1">' +
        '<div class="iv-focus-head">' +
          '<span class="card-type">' + esc(cat) + ' · ' + esc(weightWord(item.weight)) + '</span>' +
          '<h3 id="iv-focus-title" class="card-name" style="font-size:22px">' + esc(name) + '</h3>' +
        '</div>' +
        '<p class="card-source">followed since ' + timeEl(item.created_at) + '</p>' +
        (item.weight !== undefined && item.weight !== null
          ? '<p class="card-note">follow strength: ' + esc(String(item.weight)) + '</p>' : '') +
        '<p class="card-source">id: <code>' + esc(String(item.id)) + '</code></p>' +
        '<div class="iv-focus-actions">' +
          '<button type="button" class="btn-save-draft" data-iv-close>Back to clusters</button>' +
        '</div>' +
        '<details class="tech"><summary>technical · this interest</summary><div class="tech-body">' +
          'source: <strong>API-051</strong> GET /api/discovery/interests<br>' +
          'removing an interest is not wired in this UI yet — it stays until then' +
        '</div></details>' +
      '</div>';
    var dlg = host.querySelector('.iv-focus');
    if (dlg) dlg.focus();
    var close = host.querySelector('[data-iv-close]');
    function doClose() {
      host.innerHTML = '';
      if (returnTo && returnTo.focus) returnTo.focus();
    }
    if (close) close.addEventListener('click', doClose);
    host.onkeydown = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); doClose(); }
    };
    // Tell the world-state which entity is selected (for chat context)
    if (window.PW_WORLD_STATE && window.PW_WORLD_STATE.setSelection) {
      window.PW_WORLD_STATE.setSelection('interests', String(item.id));
    }
  }

  /* ── Share categories with the page add-bar datalist ── */
  function updateCategoryList(interests) {
    var list = document.getElementById('iv-category-list');
    if (!list) return;
    var cats = {};
    interests.forEach(function (i) { if (i && i.category) cats[String(i.category)] = true; });
    list.innerHTML = Object.keys(cats).sort().map(function (c) {
      return '<option value="' + esc(c) + '">';
    }).join('');
    // Also update the world-state selection context baseline
    if (window.PW_WORLD_STATE && window.PW_WORLD_STATE.setSelection) {
      // Don't override an active focus selection; just ensure section is known
    }
  }

  function paintUnavailable(mount, message) {
    mount.innerHTML =
      '<div class="cv-head"><h2>Your interests</h2></div>' +
      '<div data-iv-drawer></div>' +
      '<div class="cv-state-box">' +
        '<span class="cv-state-label">can’t connect right now</span>' +
        '<h3>Couldn’t check your interests</h3>' +
        '<p>' + esc(message || '') + '</p>' +
        '<button type="button" class="cv-btn cv-btn-keep" data-cv-retry>Try again</button>' +
      '</div>';
    var retry = mount.querySelector('[data-cv-retry]');
    if (retry) { retry.addEventListener('click', function () { build(mount); }); }
  }

  function technical(env) {
    var n = env && env.data && env.data.interests ? env.data.interests.length : 0;
    return '<details class="tech">' +
      '<summary>technical · interests view</summary>' +
      '<div class="tech-body">' +
        'source: <strong>API-051</strong> GET /api/discovery/interests — the server’s ' +
        'real interests list (' + esc(String(n)) + ' returned)<br>' +
        'this view is read-only; following something is <strong>API-051-add</strong> ' +
        '(POST /api/discovery/interests, gate: step-up) via the form on this page<br>' +
        'the discovery feed itself (API-052) is not consumed on this surface yet<br>' +
        'checked just now — no sample content is shown on this page' +
      '</div>' +
    '</details>';
  }

  function init() {
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) { return; }
    build(mount);
  }

  /* Public refresh: called by the page add-bar after a successful write,
     so the new interest appears immediately instead of on next load. */
  window.PW_INTERESTS_REFRESH = function () {
    var mount = document.getElementById(MOUNT_ID);
    if (mount) build(mount);
    // Also refresh the world projection so the map picks up any change
    if (window.PW_WORLD_STATE && window.PW_WORLD_STATE.load) {
      window.PW_WORLD_STATE.load();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
