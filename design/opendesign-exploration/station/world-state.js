/* ═══════════════════════════════════════════════════════
   WORLD STATE — the derived, read-only projection of the world.

   This is NOT canonical truth. It is a derived view assembled from
   authoritative API endpoints. It exists so that the map, the
   companion, and agents all read from the same honest picture
   of the world at a given moment.

   CONCEPTUAL MODEL (the stable surface):
     WorldProjection
       ├── SectionState[]      — identity, status, attention, activity
       ├── WorldSummary         — facts, intents, policies, lore counts
       ├── NeedsYouState        — what needs the person right now
       ├── RecentActivity[]     — latest journal events
       ├── SelectionContext     — current section + selected entity
       ├── Freshness            — when this was assembled, what's unchecked
       └── AvailableActions    — what an agent could do

   BROWSER ADAPTER:
     window.PW_WORLD_STATE     — the current projection (read-only)
     window.PW_SUGGEST(chan, c) — bounded, non-authoritative event channel
     window.PW_NAVIGATE(sec, e) — navigation request (not force)

   These are adapters over the conceptual model, not the model itself.
   Canonical truth lives in the backend data stores, never here.

   HONESTY RULES:
     - No specimen state presented as real.
     - Unknown stays unknown; never fabricated to look alive.
     - Freshness and unchecked sources are explicit.
     - The projection never writes; it only reads.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = window.PW_API;
  var state = null;
  var listeners = [];

  /* ── Section status → plain words + visual mood ──
     The map uses these to decide how a node looks.
     The words are what the person reads; the mood drives CSS. */
  var STATUS_VOICE = {
    healthy:         { word: 'all good',           mood: 'content'  },
    needs_attention: { word: 'needs you',          mood: 'reaching'  },
    unavailable:     { word: "can't reach right now", mood: 'sleeping' },
    stale:           { word: 'may be out of date',  mood: 'fading'   },
    unknown:         { word: 'not known yet',       mood: 'waking'   },
    not_configured:  { word: 'not set up yet',      mood: 'sleeping'  },
    disabled:        { word: 'off',                 mood: 'off'       },
    warning:         { word: 'needs you',            mood: 'reaching'  }
  };

  function voiceFor(status) {
    if (!status) return { word: 'here', mood: 'content' };
    return STATUS_VOICE[status] || { word: status, mood: 'waking' };
  }

  /* ── Derive current section from the URL ── */
  function currentSectionFromUrl() {
    var path = window.location.pathname;
    var file = path.substring(path.lastIndexOf('/') + 1);
    var base = file.replace(/\.html$/, '');
    if (base === 'index' || base === '') return 'world';
    return base;
  }

  /* ── Assemble the projection from real API reads ── */
  function assemble(sectionsEnv, statusEnv, proposalsEnv, remindersEnv, journalEnv) {
    var sections = [];
    var secData = (sectionsEnv && sectionsEnv.ok && sectionsEnv.data && sectionsEnv.data.sections) || [];

    secData.forEach(function (s) {
      var v = voiceFor(s.status);
      sections.push({
        id: s.id,
        label: s.label,
        icon: s.icon,
        status: s.status,
        statusLabel: s.status === null ? null : (STATUS_VOICE[s.status] || {}).word,
        mood: v.mood,
        configured: s.configured,
        attentionCount: 0,
        attentionItems: [],
        pinned: s.pinned,
        kind: s.kind,
        visible: s.visible,
        href: sectionHref(s.id)
      });
    });

    // World summary
    var world = {};
    if (statusEnv && statusEnv.ok && statusEnv.data && statusEnv.data.world) {
      world = {
        facts: statusEnv.data.world.facts || 0,
        intents: statusEnv.data.world.intents || 0,
        policies: statusEnv.data.world.policies || 0,
        cementedPolicies: statusEnv.data.world.cemented_policies || 0,
        lore: statusEnv.data.world.lore || {},
        providers: statusEnv.data.world.providers || 0,
        capabilities: statusEnv.data.world.declared_capabilities || 0
      };
    }

    // Needs-you
    var needsYou = { status: 'unknown', items: [], unchecked: [] };
    if (proposalsEnv && proposalsEnv.ok && Array.isArray(proposalsEnv.data)) {
      proposalsEnv.data.forEach(function (p) {
        if (p.status === 'pending') {
          needsYou.items.push({
            kind: 'proposal',
            title: p.text || p.key || 'a proposal',
            section: proposalSection(p),
            id: p.proposal_id || p.id
          });
        }
      });
    } else if (proposalsEnv && !proposalsEnv.ok) {
      needsYou.unchecked.push('proposals');
    }

    if (remindersEnv && remindersEnv.ok && Array.isArray(remindersEnv.data)) {
      remindersEnv.data.forEach(function (r) {
        if (r.enabled !== false) {
          needsYou.items.push({
            kind: 'reminder',
            title: r.text || 'a reminder',
            id: r.id
          });
        }
      });
    } else if (remindersEnv && !remindersEnv.ok) {
      needsYou.unchecked.push('reminders');
    }

    needsYou.count = needsYou.items.length;
    needsYou.status = needsYou.unchecked.length ? 'unknown'
      : (needsYou.count ? 'needs_attention' : 'healthy');

    // Attach attention to sections
    needsYou.items.forEach(function (item) {
      if (item.section) {
        var sec = sections.find(function (s) { return s.id === item.section; });
        if (sec) {
          sec.attentionCount += 1;
          sec.attentionItems.push(item);
        }
      }
    });

    // Recent activity (journal)
    var recent = [];
    if (journalEnv && journalEnv.ok && Array.isArray(journalEnv.data)) {
      recent = journalEnv.data.slice(0, 3).map(function (e) {
        return {
          ts: e.ts,
          kind: e.kind,
          summary: e.summary,
          source: e.provenance ? e.provenance.source : null
        };
      });
    }

    // Which sources couldn't be checked?
    var unchecked = [];
    if (!sectionsEnv || !sectionsEnv.ok) unchecked.push('sections');
    if (!statusEnv || !statusEnv.ok) unchecked.push('world-status');
    if (!proposalsEnv || !proposalsEnv.ok) unchecked.push('proposals');
    if (!remindersEnv || !remindersEnv.ok) unchecked.push('reminders');
    if (!journalEnv || !journalEnv.ok) unchecked.push('journal');

    return {
      sections: sections,
      worldSummary: world,
      needsYou: needsYou,
      recentActivity: recent,
      currentSection: currentSectionFromUrl(),
      selectedEntity: null,
      unchecked: unchecked,
      fetchedAt: new Date().toISOString(),
      // The conceptual model fields, for machine consumers
      _conceptual: {
        WorldProjection: true,
        SectionState: sections.length + ' sections',
        NeedsYouState: needsYou.count + ' items',
        SelectionContext: currentSectionFromUrl(),
        Freshness: new Date().toISOString(),
        AvailableActions: 'see /api/tools'
      }
    };
  }

  function sectionHref(id) {
    var known = {
      today: null,    // no page yet — honest
      interests: 'interests.html',
      media: null,    // no page yet
      projects: 'projects.html',
      lab: null,      // no page yet
      journal: 'journal.html',
      vault: null,    // no page yet
      chat: 'chat.html',
      settings: 'settings.html'
    };
    return known[id] || null;
  }

  function proposalSection(p) {
    if (!p) return null;
    if (p.type === 'journal_write') return 'journal';
    if (p.type === 'world_intent' || p.type === 'world_fact') return 'world';
    if (p.type === 'reminder') return 'today';
    return null;
  }

  /* ── Fetch everything in parallel ── */
  function fetch() {
    if (!API) {
      // No API client — return an honest empty state
      return Promise.resolve({
        sections: [],
        worldSummary: {},
        needsYou: { status: 'unknown', items: [], unchecked: ['api'], count: 0 },
        recentActivity: [],
        currentSection: currentSectionFromUrl(),
        selectedEntity: null,
        unchecked: ['api'],
        fetchedAt: new Date().toISOString()
      });
    }

    return Promise.all([
      API.read('/api/sections') || Promise.resolve({ ok: false }),
      API.read('API-003') || Promise.resolve({ ok: false }),
      API.read('PROP-list') || Promise.resolve({ ok: false }),
      API.read('API-067-get') || Promise.resolve({ ok: false }),
      API.read('API-005', { query: { n: 3 } }) || Promise.resolve({ ok: false })
    ]).then(function (results) {
      return assemble(results[0], results[1], results[2], results[3], results[4]);
    }).catch(function () {
      return {
        sections: [],
        worldSummary: {},
        needsYou: { status: 'unknown', items: [], unchecked: ['fetch-error'], count: 0 },
        recentActivity: [],
        currentSection: currentSectionFromUrl(),
        selectedEntity: null,
        unchecked: ['fetch-error'],
        fetchedAt: new Date().toISOString()
      };
    });
  }

  /* ── Public: load (or reload) the projection ── */
  function load() {
    return fetch().then(function (projection) {
      state = projection;
      listeners.forEach(function (fn) { try { fn(projection); } catch (e) {} });
      // Dispatch a DOM event for non-listener consumers
      window.dispatchEvent(new CustomEvent('pw:world-state', { detail: projection }));
      return projection;
    });
  }

  /* ── Public: get the current projection (synchronous) ── */
  function current() {
    return state;
  }

  /* ── Public: subscribe to changes ── */
  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (f) { return f !== fn; });
    };
  }

  /* ── Public: set selection context (called by section views) ── */
  function setSelection(section, entity) {
    if (state) {
      state.currentSection = section || currentSectionFromUrl();
      state.selectedEntity = entity || null;
      window.dispatchEvent(new CustomEvent('pw:selection', { detail: { section: state.currentSection, entity: entity } }));
    }
  }

  /* ── Agent participation channels ──

     These are ADAPTERS over the conceptual model:
       SuggestionEvent  → PW_SUGGEST
       NavigationIntent → PW_NAVIGATE

     They are non-authoritative. They dispatch events that the
     UI may choose to honor. They NEVER write to canonical state. */

  function suggest(channel, content) {
    if (!channel || !content) return;
    var event = {
      channel: channel,           // 'observation' | 'suggestion' | 'context'
      summary: content.summary || '',
      detail: content.detail || null,
      provenance: content.provenance || ('agent · ' + new Date().toISOString()),
      priority: content.priority || 'normal',
      // Never authoritative — always clearly a suggestion
      authoritative: false,
      // Attribution is preserved so multiple agents don't overwrite
      attributedTo: content.attributedTo || 'unknown-agent'
    };
    window.dispatchEvent(new CustomEvent('pw:suggest', { detail: event }));
    return event;
  }

  function navigate(sectionId, entityId) {
    var intent = {
      sectionId: sectionId,
      entityId: entityId || null,
      // This is a REQUEST, not a command. The UI honors it
      // only if the user is not mid-interaction.
      authoritative: false
    };
    window.dispatchEvent(new CustomEvent('pw:navigate', { detail: intent }));
    return intent;
  }

  /* ── Boot: load on DOM ready ── */
  function boot() {
    // Wait for PW_API to be ready
    if (!window.PW_API) {
      // Try again shortly — api.js loads with defer
      setTimeout(boot, 100);
      return;
    }
    API = window.PW_API;
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── Expose the adapter surface ── */
  window.PW_WORLD_STATE = {
    current: current,
    load: load,
    subscribe: subscribe,
    setSelection: setSelection,
    voiceFor: voiceFor,
    STATUS_VOICE: STATUS_VOICE,
    // The projection itself (once loaded)
    get data() { return state; }
  };

  // Agent participation channels
  window.PW_SUGGEST = suggest;
  window.PW_NAVIGATE = navigate;

})();
