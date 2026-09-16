/* CHAT — one component, two sizes.
   The corner orb opens a MINI dock; the Talk page mounts the same component
   full-size. Transcript is shared locally so both agree.

   Templates dictate PERSONALITY, and templates attach to companions:
   picking a companion surfaces that companion's templates. More templates
   per character get added here as they are made.

   HONESTY: this prototype keeps your messages locally and does NOT invent
   companion replies. In the product, send binds to the real chat capability
   (API-010..012); until then it says so instead of faking an answer.
*/
(function () {
  'use strict';

  var COMPANIONS = {
    mermaid:   { label: 'Mermaid',            color: 'var(--teal)',
      greeting: "I've been floating here, thinking about nothing in particular. What's on your mind?" },
    ratatoskr: { label: 'Ratatoskr',          color: 'var(--green)',
      greeting: "Psst — I noticed some threads connecting lately. Want me to show you?" },
    robot:     { label: 'Robot',              color: 'var(--cream)',
      greeting: "Systems nominal. Ready when you are." },
    burrito:   { label: 'Burrito Journalism', color: 'var(--coral)',
      greeting: "Got a fresh edition brewing. What's the story?" }
  };

  var TEMPLATES = [
    { id: 'dive',     companion: 'mermaid',   label: 'Dive deep',
      personality: 'Curious and lyrical; follows the current of your thought.',
      prompt: 'Tell me more about what I have been circling lately.' },
    { id: 'checkin',  companion: 'mermaid',   label: 'Gentle check-in',
      personality: 'Soft and unhurried. Never tells you how to feel.',
      prompt: 'How does today look, without any pressure?' },
    { id: 'threads',  companion: 'ratatoskr', label: 'Connect threads',
      personality: 'Quick and a little mischievous; carries messages between your ideas.',
      prompt: 'What two things of mine are secretly related?' },
    { id: 'remind',   companion: 'ratatoskr', label: 'Remind me',
      personality: 'Brisk and faithful; writes things down so you do not have to.',
      prompt: 'What did I leave unfinished?' },
    { id: 'fix',      companion: 'robot',     label: 'Fix it properly',
      personality: 'Plain and careful; allergic to shortcuts.',
      prompt: 'What is actually broken, and what is the proper fix?' },
    { id: 'status',   companion: 'robot',     label: 'Status, plainly',
      personality: 'Terse factual reporting. No cheerleading.',
      prompt: 'Give me the state of my projects in three lines.' },
    { id: 'context',  companion: 'burrito',   label: 'Context, not urgency',
      personality: 'Warm newsroom voice; background before breaking.',
      prompt: 'What is the story behind this week’s noise?' },
    { id: 'clippings',companion: 'burrito',   label: 'Clippings',
      personality: 'Collects the good bits for tomorrow’s paper.',
      prompt: 'What is worth keeping from what I found recently?' }
  ];

  var LOG_KEY = 'pw-chat-log';

  function readLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeLog(log) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-50))); } catch (e) {}
  }
  function companion() {
    try { return localStorage.getItem('pw-station-companion') || 'mermaid'; } catch (e) { return 'mermaid'; }
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mount(root, opts) {
    opts = opts || {};
    var who = companion();
    var meta = COMPANIONS[who] || COMPANIONS.mermaid;
    var templates = TEMPLATES.filter(function (t) { return t.companion === who; });

    // Build template cards (visible, not hidden in a select)
    var templateCards = templates.map(function (t) {
      return '<button type="button" class="chat-tpl" data-tpl="' + esc(t.id) + '" ' +
             'aria-label="' + esc(t.label) + ': ' + esc(t.personality) + '">' +
               '<span class="tpl-label">' + esc(t.label) + '</span>' +
               '<span class="tpl-desc">' + esc(t.personality) + '</span>' +
             '</button>';
    }).join('');

    root.innerHTML =
      '<div class="chat-head" style="--cc:' + meta.color + '">' +
        '<span class="chat-ava" aria-hidden="true"><svg><use href="chars.svg#char-' + esc(who) + '"/></svg></span>' +
        '<span class="chat-who">' + esc(meta.label) + '</span>' +
        '<span class="chat-pers" id="chat-pers-' + root.id + '">' +
          'Pick a mood, or just talk.' +
        '</span>' +
      '</div>' +
      '<div class="chat-templates" role="group" aria-label="Conversation templates">' +
        '<span class="chat-tl">Set the mood</span>' +
        templateCards +
      '</div>' +
      '<div class="chat-log" id="chat-log-' + root.id + '" aria-live="polite" aria-label="Conversation"></div>' +
      '<form class="chat-form">' +
        '<label class="sr-only" for="chat-in-' + root.id + '">Message ' + esc(meta.label) + '</label>' +
        '<textarea id="chat-in-' + root.id + '" class="chat-in" rows="2" ' +
          'placeholder="Say anything…"></textarea>' +
        '<button type="submit" class="chat-send">Send ✦</button>' +
      '</form>' +
      (opts.mini ? '<a class="chat-full" href="chat.html">Open the full room ↗</a>' : '');

    var log = root.querySelector('.chat-log');
    var pers = root.querySelector('.chat-pers');
    var input = root.querySelector('.chat-in');

    function renderLog() {
      var items = readLog();
      if (items.length) {
        log.innerHTML = items.map(function (m) {
          return '<div class="msg ' + esc(m.role) + '"><span class="msg-t">' + esc(m.text) + '</span></div>';
        }).join('');
      } else {
        // Cute empty state — companion presence + starter chips
        var starterChips = templates.slice(0, 3).map(function (t) {
          return '<button type="button" class="empty-chip" data-tpl="' + esc(t.id) + '" ' +
                 'aria-label="Start with: ' + esc(t.label) + '">' + esc(t.label) + '</button>';
        }).join('');

        log.innerHTML =
          '<div class="chat-empty" style="--cc:' + meta.color + '">' +
            '<div class="empty-orb" aria-hidden="true"><svg><use href="chars.svg#char-' + esc(who) + '"/></svg></div>' +
            '<div class="empty-greeting">' + esc(meta.greeting) + '</div>' +
            '<div class="empty-sub">' +
              'Everything you say stays on this device. ' + esc(meta.label) + ' hears you, but replies come from the real capability — nothing invented here.' +
            '</div>' +
            (starterChips ? '<div class="empty-chips">' + starterChips + '</div>' : '') +
          '</div>';
      }
      log.scrollTop = log.scrollHeight;
    }

    // Template card / chip click handler
    function handleTplClick(id) {
      var t = null;
      TEMPLATES.forEach(function (x) { if (x.id === id) { t = x; } });
      if (t) {
        pers.textContent = t.personality;
        input.value = t.prompt;
        input.focus();
        // Highlight the selected card
        root.querySelectorAll('.chat-tpl, .empty-chip').forEach(function (el) {
          el.setAttribute('aria-pressed', el.getAttribute('data-tpl') === id ? 'true' : 'false');
          if (el.getAttribute('data-tpl') === id) {
            el.style.borderColor = 'var(--accent, var(--amber))';
            el.style.background = 'var(--accent-soft, var(--amber-soft))';
          } else {
            el.style.borderColor = '';
            el.style.background = '';
          }
        });
      }
    }

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tpl]');
      if (btn) { handleTplClick(btn.getAttribute('data-tpl')); }
    });

    root.querySelector('.chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) { return; }
      var items = readLog();
      items.push({ role: 'you', text: text });
      items.push({ role: 'sys', text: meta.label + ' heard you. Replies bind to the real ' +
                   'chat capability (API-010) — nothing is invented here.' });
      writeLog(items);
      input.value = '';
      pers.textContent = 'Pick a mood, or just talk.';
      // Clear template selection
      root.querySelectorAll('.chat-tpl, .empty-chip').forEach(function (el) {
        el.setAttribute('aria-pressed', 'false');
        el.style.borderColor = '';
        el.style.background = '';
      });
      renderLog();
    });

    renderLog();
  }

  /* ── mount: full page ── */
  var page = document.getElementById('chat-root');
  if (page) { mount(page, { mini: false }); }

  /* ── mount: mini dock off the orb ── */
  var orb = document.getElementById('companion-orb');
  var dock = document.getElementById('chat-dock');
  if (orb && dock) {
    var mounted = false;
    orb.removeAttribute('href');
    orb.setAttribute('role', 'button');
    orb.setAttribute('aria-haspopup', 'dialog');
    orb.setAttribute('aria-expanded', 'false');
    orb.setAttribute('aria-controls', 'chat-dock');
    orb.addEventListener('click', function (e) {
      e.preventDefault();
      var open = dock.hidden;
      dock.hidden = !open;
      orb.setAttribute('aria-expanded', String(open));
      if (open && !mounted) { mount(dock, { mini: true }); mounted = true; }
      if (open) { var i = dock.querySelector('.chat-in'); if (i) { i.focus(); } }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !dock.hidden) {
        dock.hidden = true;
        orb.setAttribute('aria-expanded', 'false');
        orb.focus();
      }
    });
  }

  window.PW_CHAT = { mount: mount, TEMPLATES: TEMPLATES, COMPANIONS: COMPANIONS };
})();
