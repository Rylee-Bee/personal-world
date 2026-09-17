/* ═══════════════════════════════════════════════════════
   JOURNAL ENTRIES — content view (frontend-only)

   Renders a readable Journal entries surface below the map
   on journal.html: entry cards (date, title, body excerpt),
   an honest empty state, and a "Write an entry" affordance
   that hands off to the page's real local Write tab.

   HONESTY: no journal backend exists in this prototype.
   Every entry shown here is SPECIMEN — sample content that
   demonstrates the shape of the view, labelled as such on
   the surface and in the technical disclosure. Real binding:
   journal API-005 (see the <details class="tech"> block).

   ACCESSIBILITY: semantic list/articles, real <time> elements,
   44px controls, visible focus (content-views.css), no
   ambient motion, reduced-motion safe, status text never
   colour-alone.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MOUNT_ID = 'journal-view';

  /* ── SPECIMEN data. Illustrative only — not the user's words,
     not from any backend. Fixed dates (no fake "2 hours ago"). ── */
  var SPECIMEN_ENTRIES = [
    {
      iso: '2026-09-14T21:40',
      date: 'Mon 14 Sep 2026 · 21:40',
      title: 'Where I left off',
      excerpt: 'Stopped mid-thought again, and that is fine. The idea about keeping the map quiet unless something genuinely needs me — I want to write it down before it drifts. Quiet is not the same as empty; it is the sound of a world that is coping.'
    },
    {
      iso: '2026-09-11T08:05',
      date: 'Fri 11 Sep 2026 · 08:05',
      title: 'Morning pages, mostly weather',
      excerpt: 'Rain on the skylight, coffee too hot to rush. Three lines is still three lines. Future me will be glad the streak-less, guilt-free version of this journal exists — no badge for showing up, just the page.'
    },
    {
      iso: '2026-09-08T23:12',
      date: 'Tue 8 Sep 2026 · 23:12',
      title: 'A small win, written down',
      excerpt: 'Finished the thing I had been circling for a week. It was smaller than the dread suggested. Writing it here so the good ones get archived too, not only the open loops.'
    }
  ];

  var EMPTY_COPY = {
    heading: 'No entries yet — your words will appear here',
    body: 'Nothing is stored, nothing is waiting. When the journal is connected, every entry you write shows up exactly as you wrote it — nothing rewritten, nothing tidied.'
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── Renderers ── */

  function renderEntries() {
    var cards = SPECIMEN_ENTRIES.map(function (e) {
      return '<li>' +
        '<article class="cv-card">' +
          '<p class="cv-card-flag">specimen · sample entry</p>' +
          '<p class="cv-entry-date"><time datetime="' + esc(e.iso) + '">' + esc(e.date) + '</time></p>' +
          '<h3 class="cv-entry-title">' + esc(e.title) + '</h3>' +
          '<p class="cv-entry-excerpt">' + esc(e.excerpt) + '</p>' +
        '</article>' +
      '</li>';
    }).join('');

    return '<ul class="cv-list" aria-label="Journal entries (specimen samples)">' + cards + '</ul>';
  }

  function renderEmpty() {
    return '<div class="cv-state-box">' +
      '<span class="cv-state-label">empty</span>' +
      '<h3>' + esc(EMPTY_COPY.heading) + '</h3>' +
      '<p>' + esc(EMPTY_COPY.body) + '</p>' +
      '<button type="button" class="cv-btn cv-btn-keep" data-cv-write>' +
        'Write an entry ✦' +
      '</button>' +
    '</div>';
  }

  function renderBody(state) {
    return state === 'empty' ? renderEmpty() : renderEntries();
  }

  /* ── The view ── */

  function build(mount) {
    var state = 'entries';

    mount.innerHTML =
      '<div class="cv-head">' +
        '<h2>Journal entries</h2>' +
        '<span class="specimen-note">specimen view</span>' +
      '</div>' +

      '<p class="cv-intro">' +
        'No journal is connected yet, so this view is <strong>specimen</strong> — sample entries ' +
        'that show what reading your journal will feel like. None of these words are yours, and ' +
        'nothing here is stored anywhere. What you write yourself lives in the ' +
        '<strong>Your words</strong> section below, on this device only.' +
      '</p>' +

      '<fieldset class="cv-states">' +
        '<legend>Preview state · prototype control</legend>' +
        '<label class="cv-state-opt">' +
          '<input type="radio" name="cv-journal-state" value="entries" checked> ' +
          'With sample entries' +
        '</label>' +
        '<label class="cv-state-opt">' +
          '<input type="radio" name="cv-journal-state" value="empty"> ' +
          'Empty (nothing written yet)' +
        '</label>' +
      '</fieldset>' +

      '<div data-cv-body>' + renderBody(state) + '</div>' +

      '<p class="cv-status-line" role="status" aria-live="polite" data-cv-status></p>' +

      '<details class="tech">' +
        '<summary>technical · journal entries view</summary>' +
        '<div class="tech-body">' +
          'surface: journal entries list (read) + write affordance<br>' +
          'real binding: GET/POST /api/journal — <strong>API-005</strong> (read) / ' +
          '<strong>API-006</strong> (write); vault flag + resume point per the journal model<br>' +
          'states: populated · empty ("No entries yet — your words will appear here")<br>' +
          'current data: SPECIMEN — frontend-only, no backend exists; the sample list is static ' +
          'and nothing persists from it<br>' +
          'preview switcher: prototype control that demonstrates the honest empty state; it is ' +
          'not a product feature<br>' +
          '"Write an entry" opens the page\'s Write tab, which saves to localStorage on this ' +
          'device only (never sent anywhere)' +
        '</div>' +
      '</details>';

    var body = mount.querySelector('[data-cv-body]');
    var statusLine = mount.querySelector('[data-cv-status]');

    /* State switcher */
    mount.querySelectorAll('input[name="cv-journal-state"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        state = radio.value;
        body.innerHTML = renderBody(state);
        bindWriteButtons();
        statusLine.textContent = state === 'empty'
          ? 'Showing the empty state preview.'
          : 'Showing the specimen sample entries.';
      });
    });

    /* "Write an entry" → hand off to the real local Write tab on this page */
    function openWriteTab() {
      var writeTab = document.querySelector('[data-tab="write"]');
      var titleInput = document.getElementById('entry-title-input');
      if (writeTab) {
        writeTab.click();
        writeTab.scrollIntoView({ block: 'center' });
      }
      if (titleInput) { titleInput.focus(); }
      statusLine.textContent = 'Opened the Write tab — that one is real and saves on this device only.';
    }

    function bindWriteButtons() {
      mount.querySelectorAll('[data-cv-write]').forEach(function (btn) {
        btn.addEventListener('click', openWriteTab);
      });
    }
    bindWriteButtons();
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
