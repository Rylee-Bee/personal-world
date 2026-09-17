/* ═══════════════════════════════════════════════════════
   DISCOVERIES — content view for Interests (frontend-only)

   Renders a Discoveries surface below the map on
   interests.html. Each card shows:
     - a headline
     - WHY it is here (the matched interest, in plain words)
     - source + timestamp (provenance)
     - keep / dismiss actions (page-local only)

   HONESTY: no discovery backend exists in this prototype.
   Every card is SPECIMEN — labelled on the surface and in
   the technical disclosure. Real bindings: interests API-051
   (the graph that drives matching) and discovery API-052
   (the feed itself). Honest empty and not_configured states
   are first-class and previewable.

   ACCESSIBILITY: semantic list/articles, real <time>
   elements, 44px controls, visible focus
   (content-views.css), aria-live feedback for keep/dismiss,
   no ambient motion, status never colour-alone.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MOUNT_ID = 'interests-view';

  /* ── SPECIMEN data. Illustrative only — not a real feed.
     Fixed dates (no manufactured freshness or urgency). ── */
  var SPECIMEN_DISCOVERIES = [
    {
      id: 'd1',
      headline: 'The case for local-first software, five years on',
      match: 'local-first software',
      why: 'an essay arguing that ownership of your data outlives any service — a thread you keep returning to.',
      source: 'specimen feed · long-read essay',
      iso: '2026-09-12T14:02',
      when: 'Sat 12 Sep 2026 · 14:02'
    },
    {
      id: 'd2',
      headline: 'A generative ambient set recorded with tape loops',
      match: 'ambient music',
      why: 'new work from a corner of ambient you follow — slow, textured, no drops.',
      source: 'specimen feed · album premiere',
      iso: '2026-09-11T09:15',
      when: 'Fri 11 Sep 2026 · 09:15'
    },
    {
      id: 'd3',
      headline: 'Tiny tools: composable CLIs for personal systems',
      match: 'personal tooling',
      why: 'small single-purpose utilities in the spirit of the ones you build for yourself.',
      source: 'specimen feed · repository collection',
      iso: '2026-09-09T18:47',
      when: 'Wed 9 Sep 2026 · 18:47'
    }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── Renderers ── */

  function renderCard(item) {
    var actions = item.kept
      ? '<div class="cv-card-actions">' +
          '<span class="cv-kept-chip" tabindex="-1" data-cv-kept="' + esc(item.id) + '">' +
            'Kept ✦ — marked as yours (specimen; this page only)' +
          '</span>' +
        '</div>'
      : '<div class="cv-card-actions">' +
          '<button type="button" class="cv-btn cv-btn-keep" data-cv-keep="' + esc(item.id) + '" ' +
            'aria-label="Keep: ' + esc(item.headline) + '">Keep ✦</button>' +
          '<button type="button" class="cv-btn cv-btn-quiet" data-cv-dismiss="' + esc(item.id) + '" ' +
            'aria-label="Dismiss: ' + esc(item.headline) + '">Dismiss</button>' +
        '</div>';

    return '<li data-cv-item="' + esc(item.id) + '">' +
      '<article class="cv-card">' +
        '<p class="cv-card-flag">specimen · sample discovery</p>' +
        '<h3 class="cv-disc-headline">' + esc(item.headline) + '</h3>' +
        '<p class="cv-why">' +
          '<strong>Why this is here:</strong> it matches ' +
          '<span class="cv-match">' + esc(item.match) + '</span> — ' + esc(item.why) +
        '</p>' +
        '<p class="cv-prov">' +
          'source: ' + esc(item.source) + ' · ' +
          '<time datetime="' + esc(item.iso) + '">' + esc(item.when) + '</time>' +
        '</p>' +
        actions +
      '</article>' +
    '</li>';
  }

  function renderFeed(items) {
    if (!items.length) { return renderEmpty(true); }
    return '<ul class="cv-list" aria-label="Discoveries (specimen samples)">' +
      items.map(renderCard).join('') + '</ul>';
  }

  /* allDismissed: distinguishes "quiet feed" from "you cleared the samples" */
  function renderEmpty(allDismissed) {
    return '<div class="cv-state-box">' +
      '<span class="cv-state-label">empty</span>' +
      '<h3>Nothing new right now</h3>' +
      '<p>' + (allDismissed
        ? 'You dismissed every sample on this page. This removes the sample from this page only. It will return after a reload. Quiet is a valid state.'
        : 'No discoveries are waiting. The feed stays quiet until something genuinely matches what you follow — it never refills just to have something to show.') +
      '</p>' +
    '</div>';
  }

  function renderNotConfigured() {
    return '<div class="cv-state-box">' +
      '<span class="cv-state-label">not set up yet</span>' +
      '<h3>Discoveries are not set up yet</h3>' +
      '<p>No sources are connected, so there is nothing to match against what you follow. ' +
      'This view stays quiet and says so, instead of guessing or padding with filler.</p>' +
      '<p>When you are ready, connecting a source is a Settings decision — never a surprise.</p>' +
    '</div>';
  }

  function renderBody(state, items) {
    if (state === 'not_configured') { return renderNotConfigured(); }
    if (state === 'empty') { return renderEmpty(false); }
    return renderFeed(items);
  }

  /* ── The view ── */

  function build(mount) {
    var state = 'feed';
    /* working copy — keep/dismiss act on this page load only */
    var items = SPECIMEN_DISCOVERIES.slice();

    mount.innerHTML =
      '<div class="cv-head">' +
        '<h2>Discoveries</h2>' +
        '<span class="specimen-note">specimen view</span>' +
      '</div>' +

      '<p class="cv-intro">' +
        'No discovery sources are connected, so this view is <strong>specimen</strong> — sample ' +
        'cards that show how surfaced things will explain themselves: what it is, <strong>why it ' +
        'is here</strong>, and where it came from. Keep / dismiss work on this page only; nothing ' +
        'is stored or sent.' +
      '</p>' +

      '<fieldset class="cv-states">' +
        '<legend>Preview state · prototype control</legend>' +
        '<label class="cv-state-opt">' +
          '<input type="radio" name="cv-discoveries-state" value="feed" checked> ' +
          'With sample discoveries' +
        '</label>' +
        '<label class="cv-state-opt">' +
          '<input type="radio" name="cv-discoveries-state" value="empty"> ' +
          'Empty (nothing new)' +
        '</label>' +
        '<label class="cv-state-opt">' +
          '<input type="radio" name="cv-discoveries-state" value="not_configured"> ' +
          'Not set up yet' +
        '</label>' +
      '</fieldset>' +

      '<div data-cv-body>' + renderBody(state, items) + '</div>' +

      '<p class="cv-status-line" role="status" aria-live="polite" tabindex="-1" data-cv-status></p>' +

      '<details class="tech">' +
        '<summary>technical · discoveries view</summary>' +
        '<div class="tech-body">' +
          'surface: discovery feed cards — headline, matched interest (why), source + timestamp ' +
          '(provenance), keep/dismiss<br>' +
          'real bindings: <strong>API-051</strong> (interests — the graph of what you follow, ' +
          'drives matching) · <strong>API-052</strong> (discovery — the feed items themselves); ' +
          'the target design writes keep/dismiss back through API-051/052 — not in this specimen<br>' +
          'states: populated · empty · <code>not_configured</code> (no sources connected — quiet, ' +
          'never faked)<br>' +
          'current data: SPECIMEN — frontend-only, no backend exists; keep/dismiss mutate this ' +
          'page load only and nothing persists<br>' +
          'preview switcher: prototype control demonstrating the honest empty and ' +
          '<code>not_configured</code> states; not a product feature' +
        '</div>' +
      '</details>';

    var body = mount.querySelector('[data-cv-body]');
    var statusLine = mount.querySelector('[data-cv-status]');

    function rerender() {
      body.innerHTML = renderBody(state, items);
    }

    /* State switcher */
    mount.querySelectorAll('input[name="cv-discoveries-state"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        state = radio.value;
        rerender();
        statusLine.textContent = state === 'feed'
          ? 'Showing the specimen sample discoveries.'
          : state === 'empty'
            ? 'Showing the empty state preview.'
            : 'Showing the not-set-up state preview.';
      });
    });

    /* Keep / dismiss — delegated, survive re-renders */
    body.addEventListener('click', function (ev) {
      var keepBtn = ev.target.closest('[data-cv-keep]');
      var dismissBtn = ev.target.closest('[data-cv-dismiss]');
      if (!keepBtn && !dismissBtn) { return; }

      var id = keepBtn ? keepBtn.getAttribute('data-cv-keep') : dismissBtn.getAttribute('data-cv-dismiss');
      var idx = items.findIndex(function (it) { return it.id === id; });
      if (idx === -1) { return; }
      var item = items[idx];

      if (keepBtn) {
        /* Keep: card stays visible with an explicit text status chip */
        item.kept = true;
        rerender();
        var chip = body.querySelector('[data-cv-kept="' + id + '"]');
        if (chip) { chip.focus(); }
        statusLine.textContent = 'Kept: ' + item.headline + '. Nothing was sent anywhere — prototype only.';
      } else {
        items.splice(idx, 1);
        rerender();
        statusLine.textContent = items.length
          ? 'Dismissed: ' + item.headline + '. It will not come back on this page.'
          : 'Dismissed: ' + item.headline + '. That is everything — the feed is quiet now.';
        statusLine.focus();
      }
    });
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
