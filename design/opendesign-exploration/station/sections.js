/* Station sections — dynamic loader from the canonical backend registry.

   This file populates window.PW_SECTIONS from GET /api/sections,
   which is the authoritative source for section identity, status,
   and capability relationships.

   If the API is unreachable, a minimal fallback list is used so the
   UI doesn't break — but it's clearly marked as fallback.

   The map and the topbar both read from PW_SECTIONS. Adding a section
   on the backend makes it appear on both surfaces automatically.

   Personal layout (order, hidden, positions) is preserved separately
   in localStorage and the map's structure-patch system. */
(function () {
  'use strict';

  // Minimal fallback — only used if /api/sections is unreachable.
  // Clearly not canonical; the real list comes from the backend.
  var FALLBACK = [
    { id: 'interests', name: 'Interests', href: 'interests.html',
      color: 'var(--lavender)', colorKey: 'ai', icon: 'sparkle', egg: 'ratatoskr' },
    { id: 'journal',   name: 'Journal',   href: 'journal.html',
      color: 'var(--gold)',     colorKey: 'reading', icon: 'pen' },
    { id: 'projects',  name: 'Projects',  href: 'projects.html',
      color: 'var(--teal)',     colorKey: 'build', icon: 'wrench', egg: 'robot' },
    { id: 'chat',      name: 'Chat',      href: 'chat.html',
      color: 'var(--green)',    colorKey: 'creative', icon: 'heart', egg: 'mermaid' },
    { id: 'settings',  name: 'Settings',  href: 'settings.html',
      color: 'var(--cream)',    colorKey: 'world', icon: 'gear' }
  ];

  // Section → color/icon/egg mapping for visual identity.
  // These are presentation choices that stay on the client; the
  // canonical section identity comes from the backend.
  var VISUAL = {
    today:     { color: 'var(--amber)',    colorKey: 'world',     icon: 'sparkle', egg: null },
    interests: { color: 'var(--lavender)', colorKey: 'ai',        icon: 'sparkle', egg: 'ratatoskr' },
    media:     { color: 'var(--coral)',    colorKey: 'music',     icon: 'film',    egg: null },
    projects:  { color: 'var(--teal)',     colorKey: 'build',     icon: 'wrench',  egg: 'robot' },
    lab:       { color: 'var(--green)',    colorKey: 'creative', icon: 'flask',   egg: null },
    journal:   { color: 'var(--gold)',     colorKey: 'reading',  icon: 'pen',     egg: null },
    vault:     { color: 'var(--cream)',    colorKey: 'world',     icon: 'cloud',   egg: null },
    chat:      { color: 'var(--green)',    colorKey: 'creative', icon: 'heart',   egg: 'mermaid' },
    settings:  { color: 'var(--cream)',    colorKey: 'world',     icon: 'gear',    egg: null }
  };

  // Section → page href (null = no page yet, honest absence)
  var HREFS = {
    interests: 'interests.html',
    journal: 'journal.html',
    projects: 'projects.html',
    chat: 'chat.html',
    settings: 'settings.html'
    // today, media, lab, vault: no pages yet — clicking shows honest status
  };

  var loaded = false;
  var loadingPromise = null;

  function mapSection(s) {
    var v = VISUAL[s.id] || VISUAL.interests;
    return {
      id: s.id,
      name: s.label,
      href: HREFS[s.id] || null,
      color: v.color,
      colorKey: v.colorKey,
      icon: v.icon,
      egg: v.egg,
      // Canonical state from the backend
      status: s.status,
      statusLabel: s.status_label || null,
      configured: s.configured,
      pinned: s.pinned,
      kind: s.kind,
      visible: s.visible
    };
  }

  function loadFromAPI() {
    var API = window.PW_API;
    if (!API || typeof API.read !== 'function') {
      return null;
    }
    return API.read('/api/sections').then(function (env) {
      if (env && env.ok && env.data && Array.isArray(env.data.sections)) {
        return env.data.sections
          .filter(function (s) { return s.visible !== false; })
          .map(mapSection);
      }
      return null;
    }).catch(function () { return null; });
  }

  function loadFallback() {
    return FALLBACK.slice();
  }

  function init() {
    if (loaded) return;
    loaded = true;

    // Start with fallback immediately so the UI doesn't wait
    window.PW_SECTIONS = loadFallback();

    // The API client (api.js) loads after this file. Poll until it
    // exists, then upgrade to the canonical registry. Bounded retry
    // so a missing client never spins forever.
    var tries = 0;
    (function awaitAPI() {
      tries += 1;
      var p = loadFromAPI();
      if (p) {
        loadingPromise = p.then(function (sections) {
          if (sections && sections.length) {
            window.PW_SECTIONS = sections;
            // Notify listeners that sections updated
            window.dispatchEvent(new CustomEvent('pw:sections-loaded', {
              detail: { sections: sections, source: 'api' }
            }));
          }
          return sections;
        });
        return;
      }
      if (tries < 100) { setTimeout(awaitAPI, 100); }
    })();
  }

  // Boot when DOM is ready (or immediately)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for the map/topbar to await if they want canonical data
  window.PW_SECTIONS_READY = loadingPromise;
})();
