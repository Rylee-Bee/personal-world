/* ═════════════════════════════════════════════════════
   INTERESTS — real discovery read, honest states.

   Rendered into #interests-view, below the systems map, on
   interests.html. Reads the real interests list from the server:

      API-051 GET /api/discovery/interests

   HONESTY CONTRACT:
   · There is NO specimen feed on this surface. The former sample
     cards and the state-preview switcher were removed from the
     product route (LANG-022): a normal reader can never mistake a
     sample for their own data, because no sample is shown.
   · Real states only: the server's interests list, an honest empty
     state, and an honest not set up / couldn't-check state.
   · This view performs READS ONLY. Adding an interest is a
     step-up write (API-051-add) and is never called here.

   ACCESSIBILITY: semantic list, real <time> elements, visible
   states in words, 44px retry control (content guide + A11y §2.1).
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

  /* ── the view ── */
  function build(mount) {
    mount.innerHTML =
      '<div class="cv-head">' +
        '<h2>Your interests</h2>' +
      '</div>' +
      '<p class="rd-loading cv-intro" role="status">Checking your interests…</p>' +
      '<p class="cv-status-line" role="status" aria-live="polite" tabindex="-1" data-cv-status></p>';
    var API_ = API();
    if (!API_) {
      paintUnavailable(mount,
        'The page could not talk to the server just now, so your interests could not be read. ' +
        'Nothing was changed. Try again below.');
      return;
    }
    API_.read('API-051-get').then(function (env) { paint(mount, env); });
  }

  function paint(mount, env) {
    var head =
      '<div class="cv-head">' +
        '<h2>Your interests</h2>' +
      '</div>';

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
            '<p>Interests can be added through the server’s discovery settings.</p>' +
          '</div>' +
          technical(env);
        return;
      }
      paintUnavailable(mount, (message ||
        'Your interests could not be read. Nothing was changed. Try again below.'));
      return;
    }

    var interests = (env && env.ok && env.data && Array.isArray(env.data.interests))
      ? env.data.interests : [];

    if (!interests.length) {
      mount.innerHTML = head +
        '<div class="cv-state-box">' +
          '<span class="cv-state-label">empty</span>' +
          '<h3>No interests yet</h3>' +
          '<p>This is your real interests list, read from the server — it is ' +
          'genuinely empty, not sample content. Add an interest through the ' +
          'server’s discovery settings and it will appear here on the next check.</p>' +
        '</div>' +
        technical(env);
      return;
    }

    var rows = interests.map(function (i) {
      var bits = [];
      if (i && i.category) { bits.push('category: ' + i.category); }
      if (i && i.created_at) { bits.push('followed since ' + timeEl(i.created_at)); }
      return '<li class="rd-item">' +
        '<h3 class="rd-item-title">' + esc(i && i.name ? i.name : '(unnamed)') + '</h3>' +
        (bits.length ? '<p class="rd-item-meta">' + esc(bits.join(' · ')) + '</p>' : '') +
        '</li>';
    }).join('');

    mount.innerHTML = head +
      '<p class="cv-intro">' + esc(interests.length + (interests.length === 1 ? ' interest' : ' interests')) +
      ' — read from the server just now.</p>' +
      '<ul class="rd-list" aria-label="Your interests">' + rows + '</ul>' +
      technical(env);
  }

  function paintUnavailable(mount, message) {
    mount.innerHTML =
      '<div class="cv-head"><h2>Your interests</h2></div>' +
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
        'this view is read-only; adding an interest is <strong>API-051-add</strong> ' +
        '(POST /api/discovery/interests, gate: step-up) and is a deliberate action, not a side effect of opening this page<br>' +
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
