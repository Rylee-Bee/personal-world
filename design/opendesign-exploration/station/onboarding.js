/* ONBOARDING — a calm, honest first-run introduction to the systems map.
   Shown only when the pw-onboarded flag is absent. Three short steps:
     1. what the map is  ·  2. choose a companion  ·  3. set comfort defaults.
   "Skip for now", the × button, and Esc all close AND set the flag, so it
   never nags again — no guilt copy, no "are you sure". A quiet "Show me"
   control in the top bar clears the flag and replays it on demand.

   Comfort controls deliberately REUSE station.js: the density/motion/demand
   buttons carry the same data-*-set attributes the Settings page uses, and the
   companion picker drives a hidden [data-companion-set] bridge, so persistence
   + live re-apply are owned by one place. Nothing here re-implements prefs.

   Accessibility: role=dialog + aria-modal, focus trap, focus restore, Esc,
   inert background, per-step labelling, reduced-motion safe (onboarding.css).
   No fake data; the copy says plainly that the prototype is specimen content. */
(function () {
  'use strict';

  var FLAG = 'pw-onboarded';

  var COMPANIONS = [
    { id: 'mermaid',   label: 'Mermaid',            color: 'var(--teal)',   desc: 'Curious and lyrical; follows the current of your thought.' },
    { id: 'ratatoskr', label: 'Ratatoskr',          color: 'var(--green)',  desc: 'Quick and a little mischievous; carries messages between your ideas.' },
    { id: 'robot',     label: 'Robot',              color: 'var(--cream)',  desc: 'Plain and careful; allergic to shortcuts.' },
    { id: 'burrito',   label: 'Burrito Journalism', color: 'var(--coral)',  desc: 'Warm newsroom voice; background before breaking.' }
  ];
  var WORLDS = ['Today', 'Interests', 'Media', 'Projects', 'Lab', 'Journal', 'Vault', 'Chat', 'Settings'];

  /* ── storage + prefs (mirrors station.js keys/defaults) ── */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pref(name, def) { var v = lsGet('pw-station-' + name); return (v == null || v === '') ? def : v; }
  function flagged() { return lsGet(FLAG) === '1'; }
  function setFlag() { lsSet(FLAG, '1'); }
  function clearFlag() { lsDel(FLAG); }

  var overlay, dialog, againBtn, bridge;
  var stepEls = [], dots = [], stepText, backBtn, nextBtn;
  var lastFocus = null, step = 0, isOpen = false;
  var STEPS = 3;

  /* ── build the three steps ── */
  function stepWelcome() {
    return '' +
    '<section class="onb-step" data-step="0">' +
      '<h2 class="onb-title" id="onb-h-0" tabindex="-1">' +
        '<span class="sr-only">Step 1 of 3. </span>Welcome to your world ✦</h2>' +
      '<p class="onb-lede" id="onb-d-0">This is your <strong>systems map</strong> — not a dashboard, ' +
        'not a wall of notifications. It stays quiet until you move toward something.</p>' +
      '<ul class="onb-points">' +
        '<li>At rest it shows your nine worlds. Drift toward one and it opens into its clusters; ' +
          'open a cluster and its items appear. Depth arrives only because you approached it.</li>' +
        '<li>When nothing needs you, the map says so plainly. Quiet is a real state here, not an empty one.</li>' +
        '<li>The shape of the map is yours to change — add, rename, re-parent, or hide anything under ' +
          '“Shape this map”.</li>' +
      '</ul>' +
      '<p class="onb-worlds-label" id="onb-worlds-label">Your nine worlds at rest</p>' +
      '<ul class="onb-worlds" aria-labelledby="onb-worlds-label">' +
        WORLDS.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') +
      '</ul>' +
      '<p class="onb-specimen">This prototype is filled with sample content marked ' +
        '<span class="onb-tag">specimen</span> — none of it is your real data yet.</p>' +
    '</section>';
  }

  function stepCompanion() {
    var current = lsGet('pw-station-companion') || 'mermaid';
    var cards = COMPANIONS.map(function (c) {
      return '' +
      '<label class="onb-comp" style="--cc:' + c.color + '">' +
        '<input type="radio" name="onb-companion" value="' + esc(c.id) + '"' +
               (c.id === current ? ' checked' : '') + '>' +
        '<span class="onb-comp-sil" aria-hidden="true"><svg><use href="chars.svg#char-' + esc(c.id) + '"/></svg></span>' +
        '<span class="onb-comp-text">' +
          '<span class="onb-comp-name">' + esc(c.label) + '</span>' +
          '<span class="onb-comp-desc">' + esc(c.desc) + '</span>' +
        '</span>' +
      '</label>';
    }).join('');

    return '' +
    '<section class="onb-step" data-step="1" hidden>' +
      '<h2 class="onb-title" id="onb-h-1" tabindex="-1">' +
        '<span class="sr-only">Step 2 of 3. </span>Choose a companion</h2>' +
      '<p class="onb-lede" id="onb-d-1">A companion is a quiet presence in the corner — a silhouette, ' +
        'not a narrator. It travels with you and opens a small chat when you want one. ' +
        'You can change this, or switch companions off, at any time.</p>' +
      '<fieldset class="onb-fieldset">' +
        '<legend class="onb-fl">Pick who travels with you</legend>' +
        '<div class="onb-comp-grid">' + cards + '</div>' +
      '</fieldset>' +
      '<p class="onb-note-inline">Turning companions off removes no functionality — everything still works.</p>' +
    '</section>';
  }

  function seg(kind, labelId, label, hint, opts) {
    var buttons = opts.map(function (o) {
      return '<button type="button" data-' + kind + '-set="' + esc(o.v) + '" aria-pressed="false">' +
             esc(o.t) + '</button>';
    }).join('');
    return '' +
    '<div class="onb-field">' +
      '<span class="onb-fl" id="' + labelId + '">' + esc(label) + '</span>' +
      '<div class="seg" role="group" aria-labelledby="' + labelId + '">' + buttons + '</div>' +
      (hint ? '<span class="onb-hint">' + esc(hint) + '</span>' : '') +
    '</div>';
  }

  function stepComfort() {
    return '' +
    '<section class="onb-step" data-step="2" hidden>' +
      '<h2 class="onb-title" id="onb-h-2" tabindex="-1">' +
        '<span class="sr-only">Step 3 of 3. </span>Set how it feels</h2>' +
      '<p class="onb-lede" id="onb-d-2">A few comfort choices that sit <em>above</em> the accessibility ' +
        'floor. The defaults are already accessible — change only what you want, or change nothing.</p>' +
      seg('density', 'onb-l-density', 'Space between things', null,
          [{ v: 'comfortable', t: 'Roomy' }, { v: 'compact', t: 'Tight' }]) +
      seg('motion', 'onb-l-motion', 'Gentle motion',
          'Off by default. Your system’s reduce-motion setting always wins.',
          [{ v: 'off', t: 'Off' }, { v: 'on', t: 'On' }]) +
      seg('demand', 'onb-l-demand', 'How much it asks',
          'Low shows only what needs you; your world stays exactly where it is.',
          [{ v: 'normal', t: 'Normal' }, { v: 'low', t: 'Low' }]) +
      '<p class="onb-note-inline">You can fine-tune all of this later in Settings.</p>' +
    '</section>';
  }

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'onb-backdrop';
    overlay.id = 'onb-backdrop';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="onb-dialog" id="onb-dialog" role="dialog" aria-modal="true" ' +
           'aria-labelledby="onb-h-0" aria-describedby="onb-d-0" tabindex="-1">' +
        '<button type="button" class="onb-close" id="onb-close" aria-label="Close introduction">&times;</button>' +
        '<div class="onb-head">' +
          '<span class="onb-step-text" id="onb-step-text">Step 1 of 3</span>' +
          '<span class="onb-dots" aria-hidden="true">' +
            '<span class="onb-dot"></span><span class="onb-dot"></span><span class="onb-dot"></span>' +
          '</span>' +
        '</div>' +
        '<div class="onb-body">' + stepWelcome() + stepCompanion() + stepComfort() + '</div>' +
        '<div class="onb-foot">' +
          '<button type="button" class="onb-skip" id="onb-skip">Skip for now</button>' +
          '<span class="onb-spacer"></span>' +
          '<button type="button" class="onb-back" id="onb-back" hidden>Back</button>' +
          '<button type="button" class="onb-next" id="onb-next">Next</button>' +
        '</div>' +
        '<p class="onb-replay-note">You can replay this any time from "Show me" in the top bar.</p>' +
        // hidden persistence bridge: station.js listens for [data-companion-set] change
        '<select class="onb-bridge sr-only" data-companion-set tabindex="-1" aria-hidden="true">' +
          COMPANIONS.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>'; }).join('') +
        '</select>' +
      '</div>';
    document.body.appendChild(overlay);

    dialog = overlay.querySelector('#onb-dialog');
    bridge = overlay.querySelector('.onb-bridge');
    stepEls = Array.prototype.slice.call(overlay.querySelectorAll('.onb-step'));
    dots = Array.prototype.slice.call(overlay.querySelectorAll('.onb-dot'));
    stepText = overlay.querySelector('#onb-step-text');
    backBtn = overlay.querySelector('#onb-back');
    nextBtn = overlay.querySelector('#onb-next');

    // wire controls
    overlay.querySelector('#onb-close').addEventListener('click', close);
    overlay.querySelector('#onb-skip').addEventListener('click', close);
    backBtn.addEventListener('click', function () { showStep(step - 1); });
    nextBtn.addEventListener('click', function () {
      if (step === STEPS - 1) { close(); } else { showStep(step + 1); }
    });
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) { close(); } });
    dialog.addEventListener('keydown', onKeydown);

    // companion radios → persist + drive the bridge (station.js re-applies the orb)
    var radios = overlay.querySelectorAll('input[name="onb-companion"]');
    Array.prototype.forEach.call(radios, function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) { return; }
        lsSet('pw-station-companion', r.value);            // chat.js reads this directly
        if (bridge) {
          bridge.value = r.value;
          bridge.dispatchEvent(new Event('change', { bubbles: true }));  // station.js writes + applies
        }
      });
    });

    syncComfort();
  }

  /* reflect current prefs into the comfort buttons (station.js re-syncs on any change) */
  function syncComfort() {
    setPressed('density', pref('density', 'comfortable'));
    setPressed('motion', pref('motion', 'off'));
    setPressed('demand', pref('demand', 'normal'));
  }
  function setPressed(kind, val) {
    var btns = overlay.querySelectorAll('[data-' + kind + '-set]');
    Array.prototype.forEach.call(btns, function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-' + kind + '-set') === val));
    });
  }

  /* ── steps ── */
  function showStep(i) {
    step = Math.max(0, Math.min(STEPS - 1, i));
    stepEls.forEach(function (s, idx) { s.hidden = (idx !== step); });
    dots.forEach(function (d, idx) { d.classList.toggle('on', idx === step); });
    dialog.setAttribute('aria-labelledby', 'onb-h-' + step);
    dialog.setAttribute('aria-describedby', 'onb-d-' + step);
    stepText.textContent = 'Step ' + (step + 1) + ' of ' + STEPS;
    backBtn.hidden = (step === 0);
    nextBtn.textContent = (step === STEPS - 1) ? 'Done' : 'Next';
    var h = stepEls[step].querySelector('h2');
    if (h) { h.focus(); }
  }

  /* ── open / close ── */
  function openBackground(inertOn) {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el === overlay) { continue; }
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') { continue; }
      try { el.inert = inertOn; } catch (e) {}
    }
  }

  function open() {
    if (isOpen) { return; }
    isOpen = true;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    openBackground(true);
    showStep(0);
  }

  function close() {
    if (!isOpen) { return; }
    isOpen = false;
    setFlag();                       // any close ends the first run — never nags again
    overlay.hidden = true;
    openBackground(false);
    if (againBtn && againBtn.focus) { againBtn.focus(); }
    else if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  /* ── keyboard: Esc closes, Tab is trapped ── */
  function focusables() {
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
              'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var all = dialog.querySelectorAll(sel);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.getAttribute('tabindex') === '-1') { continue; }   // skip programmatic-only (e.g. the bridge)
      if (el.offsetWidth || el.offsetHeight || el.getClientRects().length) { out.push(el); }
    }
    return out;
  }
  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') { return; }
    var f = focusables();
    if (!f.length) { return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ── the quiet "Show me" reset, in the top bar ── */
  function buildAgainButton() {
    againBtn = document.createElement('button');
    againBtn.type = 'button';
    againBtn.className = 'onb-again';
    againBtn.id = 'onb-again';
    againBtn.textContent = 'Show me';
    againBtn.setAttribute('aria-label', 'Show the welcome introduction again');
    againBtn.title = 'Replay the introduction';
    againBtn.addEventListener('click', function () { clearFlag(); open(); });

    var topbar = document.querySelector('.topbar');
    if (topbar) {
      var anchor = topbar.querySelector('.help-btn') || topbar.querySelector('#topbar-region');
      if (anchor) { topbar.insertBefore(againBtn, anchor); } else { topbar.appendChild(againBtn); }
    } else {
      document.body.appendChild(againBtn);
    }
  }

  function boot() {
    if (document.getElementById('onb-backdrop')) { return; }  // already built
    buildAgainButton();
    build();
    if (!flagged()) { open(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
