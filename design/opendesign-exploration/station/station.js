/* Station shell — preferences + persistent accessibility chrome.
   Comfort layers ABOVE the accessibility floor; never a replacement for it.

   Preferences (persisted locally; in the product these bind to real APIs):
     density    → API-030 Reading & Interaction
     theme      → API-065 theme packs
     motion     → API-030 (OS prefers-reduced-motion always wins)
     companions → API-030 (ambient eggs + companion presence)
     demand     → API-030 (low-demand / Bad Day posture)

   Injected chrome (same place on every page, always reachable):
     - companion chip  (bottom-right) — a themed chat companion that travels with you
     - "Help & quiet mode" (topbar)     — the lowest-bandwidth escape hatch

   Compact density / low demand never drop a hit area below 44px, never drop
   contrast below WCAG AA, never remove a status text label, never reorder IA.
*/
(function () {
  'use strict';

  var root = document.documentElement;
  var PREFS = ['density', 'theme', 'motion', 'companions', 'mood', 'demand'];
  var KEY = function (n) { return 'pw-station-' + n; };

  function read(n) { try { return localStorage.getItem(KEY(n)); } catch (e) { return null; } }
  function write(n, v) {
    try { if (v) { localStorage.setItem(KEY(n), v); } else { localStorage.removeItem(KEY(n)); } } catch (e) {}
  }

  var COMPANIONS = {
    mermaid:   { color: 'var(--teal)',   label: 'Mermaid' },
    ratatoskr: { color: 'var(--green)',  label: 'Ratatoskr' },
    robot:     { color: 'var(--cream)',  label: 'Robot' },
    burrito:   { color: 'var(--coral)',  label: 'Burrito Journalism' }
  };

  function value(n) {
    var v = read(n);
    if (n === 'density') { return v || 'comfortable'; }
    if (n === 'motion') { return v || 'off'; }   /* ambient motion reduced by default */
    if (n === 'companions') { return v || 'on'; }
    if (n === 'mood') { return v || 'on'; }
    if (n === 'demand') { return v || 'normal'; }
    if (n === 'companion') { return v || 'mermaid'; }
    return v || '';
  }

  function apply() {
    PREFS.forEach(function (n) {
      var v = value(n);
      if (n === 'theme') {
        if (v) { root.setAttribute('data-theme', v); } else { root.removeAttribute('data-theme'); }
      } else {
        root.setAttribute('data-' + n, v);
      }
    });

    // reflect into controls
    document.querySelectorAll('[data-density-set],[data-motion-set],[data-companions-set],[data-demand-set],[data-mood-set]')
      .forEach(function (btn) {
        var kind = btn.hasAttribute('data-density-set') ? 'density'
          : btn.hasAttribute('data-motion-set') ? 'motion'
          : btn.hasAttribute('data-companions-set') ? 'companions'
          : btn.hasAttribute('data-mood-set') ? 'mood' : 'demand';
        var attr = 'data-' + kind + '-set';
        var cur = kind === 'mood' ? (read('mood') || 'on') : value(kind);
        btn.setAttribute('aria-pressed', String(btn.getAttribute(attr) === cur));
      });
    document.querySelectorAll('[data-theme-set]').forEach(function (sel) { sel.value = value('theme'); });
    document.querySelectorAll('[data-companion-set]').forEach(function (sel) { sel.value = value('companion'); });
    var orb = document.getElementById('companion-orb');
    if (orb) {
      var use = orb.querySelector('use');
      if (use) { use.setAttribute('href', 'chars.svg#char-' + value('companion')); }
      orb.setAttribute('aria-label', 'Open World assistant');
    }

    // companions off → drop any ambient egg currently showing
    if (value('companions') === 'off') {
      document.querySelectorAll('.egg-visit').forEach(function (e) { e.remove(); });
    }

    // let the map re-read prefs (mood) without a reload
    window.dispatchEvent(new CustomEvent('pw:prefs'));
  }

  /* ── persistent chrome ── */
  function injectChrome() {
    if (document.querySelector('.companion')) { return; }

    var who = (function () {
      try { return localStorage.getItem('pw-station-companion') || 'mermaid'; } catch (e) { return 'mermaid'; }
    })();
    var companion = document.createElement('button');
    companion.type = 'button';
    companion.className = 'companion';
    companion.id = 'companion-orb';
    companion.setAttribute('aria-label', 'Hail ' + companionName + ' — open World assistant');
    companion.title = 'Talk to your companion';
    companion.innerHTML =
      '<span class="c-sil" aria-hidden="true"><svg><use href="chars.svg#char-' + who + '"/></svg></span>' +
      '<span class="companion-sparkle" aria-hidden="true">✦</span>';
    var companionLabel = document.createElement('span');
    companionLabel.className = 'companion-label';
    companionLabel.setAttribute('aria-hidden', 'true');
    var companionName = (COMPANIONS[who] || COMPANIONS.mermaid).label;
    companionLabel.textContent = 'Hail ' + companionName;
    companion.appendChild(companionLabel);

    var dock = document.createElement('div');
    dock.className = 'chat-dock';
    dock.id = 'chat-dock';
    dock.setAttribute('role', 'dialog');
    dock.setAttribute('aria-label', 'Chat with your companion');
    dock.hidden = true;

    var dockClose = document.createElement('button');
    dockClose.type = 'button';
    dockClose.className = 'dock-close';
    dockClose.setAttribute('aria-label', 'Close chat');
    dockClose.textContent = '✕';
    dock.insertBefore(dockClose, dock.firstChild);
    dockClose.addEventListener('click', function() {
      dock.hidden = true;
      var o = document.getElementById('companion-orb');
      if (o) { o.setAttribute('aria-expanded', 'false'); o.focus(); }
    });

    var help = document.createElement('button');
    help.type = 'button';
    help.className = 'help-btn distress-call';
    help.id = 'help-btn';
    help.setAttribute('aria-haspopup', 'dialog');
    help.setAttribute('aria-expanded', 'false');
    help.setAttribute('aria-label', 'Help and quiet mode');
    help.innerHTML = '<span class="distress-badge" aria-hidden="true"></span>Cruising speed';

    var dialog = document.createElement('div');
    dialog.className = 'help-dialog';
    dialog.id = 'help-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'false');
    dialog.setAttribute('aria-labelledby', 'help-title');
    dialog.hidden = true;
    dialog.innerHTML =
      '<h2 id="help-title">Choose a quieter view</h2>' +
      '<p>Choose the smallest view that helps right now. This changes what the Station shows; it does not delete your world.</p>' +
      '<div class="help-actions">' +
        '<button type="button" data-help="needs">Show me only what needs me</button>' +
        '<button type="button" data-help="quiet">Make everything quieter</button>' +
        '<button type="button" data-help="restore">Restore the normal view</button>' +
        '<a href="settings.html" data-help="settings">How this looks &amp; feels</a>' +
        '<a href="chat.html" data-help="talk">Talk it out with a companion</a>' +
        '<button type="button" data-help="nothing">Nothing for now ✦</button>' +
      '</div>';

    document.body.appendChild(companion);
    document.body.appendChild(dialog);
    document.body.appendChild(dock);

    // Append help button to topbar
    var topbar = document.querySelector('.topbar');
    if (topbar) {
      topbar.appendChild(help);
    } else {
      document.body.appendChild(help);
    }

    function open() {
      dialog.hidden = false;
      help.setAttribute('aria-expanded', 'true');
      var first = dialog.querySelector('button, a');
      if (first) { first.focus(); }
    }
    function close() {
      dialog.hidden = true;
      help.setAttribute('aria-expanded', 'false');
      help.focus();
    }

    help.addEventListener('click', function () { dialog.hidden ? open() : close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !dialog.hidden) { close(); }
    });
    dialog.addEventListener('click', function (e) {
      var b = e.target.closest('[data-help]');
      if (!b) { return; }
      var kind = b.getAttribute('data-help');
      if (kind === 'needs') { write('demand', 'low'); apply(); close(); }
      if (kind === 'quiet') { write('demand', 'low'); write('motion', 'off'); apply(); close(); }
      if (kind === 'restore') { write('demand', ''); apply(); close(); }   /* demand only — motion preference is never silently flipped back on */
      if (kind === 'nothing') { close(); }
      if (kind === 'talk') { close(); }
    });
  }

  /* ── control wiring ── */
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || !el.closest) { return; }
    var btn = el.closest('[data-density-set],[data-motion-set],[data-companions-set],[data-demand-set],[data-mood-set]');
    if (!btn) { return; }
    var kind = btn.hasAttribute('data-density-set') ? 'density'
      : btn.hasAttribute('data-motion-set') ? 'motion'
      : btn.hasAttribute('data-companions-set') ? 'companions'
      : btn.hasAttribute('data-mood-set') ? 'mood' : 'demand';
    var v = btn.getAttribute('data-' + kind + '-set');
    // storing the default clears the override
    var isDefault = (kind === 'density' && v === 'comfortable') ||
                    (kind === 'motion' && v === 'off') ||
                    (kind === 'companions' && v === 'on') ||
                    (kind === 'mood' && v === 'on') ||
                    (kind === 'demand' && v === 'normal');
    write(kind, isDefault ? '' : v);
    apply();
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || !el.closest) { return; }
    var csel = el.closest('[data-companion-set]');
    if (csel) { write('companion', csel.value); apply(); return; }
    var sel = el.closest('[data-theme-set]');
    if (!sel) { return; }
    write('theme', sel.value);
    apply();
  });

  function celebrate(reason) {
    if (document.documentElement.getAttribute('data-motion') !== 'on') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var orb = document.getElementById('companion-orb');
    if (!orb) return;
    var sparkle = document.createElement('span');
    sparkle.className = 'companion-sparkle-celebrate';
    sparkle.setAttribute('aria-hidden', 'true');
    sparkle.textContent = '✦';
    orb.appendChild(sparkle);
    setTimeout(function() { sparkle.remove(); }, 600);
  }
  window.PW_CELEBRATE = celebrate;

  function boot() { injectChrome(); apply(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
