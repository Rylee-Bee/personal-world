/* ═══════════════════════════════════════════════════════
   REAL DATA — the provider layer between the Station and the API.

   Product decision #12: the Station map is the product frontend, and
   real data is what makes the world actually yours. Decision #3: no
   fake data — if real data is unavailable, show an honest
   empty / unavailable / not-set-up state.

   This file owns ONE job: turn endpoint envelopes (api.js) into
   normalized, render-ready shapes with an honest status attached, and
   render them into opt-in mounts. It deliberately does NOT rewrite the
   existing content views (journal-view.js, interests-view.js,
   projects-view.js): those keep their clearly-labelled specimen panels,
   and the functions below are what they — or a later pass — consume.

   WIRED TO REAL ENDPOINTS HERE
     Needs you      ← PROP-list   GET /api/proposals
                      API-067-get GET /api/reminders
     Journal        ← API-005     GET /api/journal
     Preferences    ← API-030-get GET /api/prefs
                      API-031     GET /api/prefs/schema

   ALSO REAL THROUGH THEIR OWN VIEWS (wired there, not here)
     Projects       ← API-033/034 (projects-view.js)
     Interests      ← API-051     (interests-view.js)

   STILL SPECIMEN (see SPECIMEN_REMAINING below, rendered in the
   technical disclosure rather than hidden)
     Media, the map's per-region activity/provenance/suggestion copy.

   WRITE SAFETY
     Every provider here is read-only. Nothing in this file mutates the
     world: it never calls PW_API.write(), never sends an elevation
     header, and never simulates an action. Approving a proposal or
     saving a preference is a gated write that belongs to a deliberate
     UI, not to a panel that renders on load.

   ACCESSIBILITY
     Status is always written in words next to any colour; lists are real
     lists; timestamps are real <time> elements; the only button (Retry)
     is 44px; live regions are polite; nothing animates.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = window.PW_API;

  /* ── Honesty register: what is still specimen, said out loud.
     Rendered into every real-data disclosure so a reader can never
     mistake a sample for their own data. ── */
  var SPECIMEN_REMAINING = [
    { surface: 'Media — library and recent activity', reason: 'API-054/055 exist; no Station surface consumes them yet', view: '—' },
    { surface: 'Map region copy (Recently / From / Suggests)', reason: 'no per-region endpoint exists', view: 'starmap.js' }
  ];

  /* ── Journal kinds → plain language (model.py JournalKind).
     The canonical word stays in the technical disclosure. ── */
  var KIND_WORDS = {
    observation: 'observed',
    health: 'health',
    drift: 'drift',
    recommendation: 'suggestion',
    approval: 'your approval',
    reconciliation: 'reconciliation',
    provider_action: 'action taken',
    failure: 'something failed',
    pack_change: 'pack change',
    settings_change: 'settings change',
    security: 'security',
    discovery: 'discovery'
  };

  /* ── Station control → API-030 preference key, verified against
     prefs.py (server vocabulary) and settings.html (station values).
     `binding` is the honest word for how far the two actually reach. ── */
  var PREF_BINDING = [
    {
      station: 'Space between things', stationKey: 'density',
      stationValues: 'comfortable · compact', serverKey: 'density',
      binding: 'exact',
      note: 'Same vocabulary on both sides — bindable today.'
    },
    {
      station: 'Gentle motion', stationKey: 'motion',
      stationValues: 'off · on', serverKey: 'motion',
      binding: 'partial',
      note: 'Server vocabulary is off · reduced · subtle. “off” maps exactly; the Station’s “on” has no server value (server “subtle” is the closest opt-in). Your OS reduced-motion setting always outranks both.'
    },
    {
      station: 'Your companion', stationKey: 'companion',
      stationValues: 'mermaid · ratatoskr · robot · burrito', serverKey: 'companion',
      binding: 'partial',
      note: 'Server values are personal-world · mermaid · robot · world-tree-squirrel · taco-news-truck. Mermaid and Robot match; Ratatoskr and Burrito Journalism are Station names for world-tree-squirrel and taco-news-truck.'
    },
    {
      station: 'Colours', stationKey: 'theme',
      stationValues: 'Station · ember · tide · moss', serverKey: 'accent',
      binding: 'none',
      note: 'Different concepts: server `accent` is world-keeper · rylee. Station atmosphere themes have no server key yet.'
    },
    {
      station: 'Companions around', stationKey: 'companions',
      stationValues: 'on · off', serverKey: null,
      binding: 'none',
      note: 'No server key. `companion` chooses who appears, not whether they do. Turning companions off removes no functionality.'
    },
    {
      station: 'Let the map set the mood', stationKey: 'mood',
      stationValues: 'on · off', serverKey: null,
      binding: 'none',
      note: 'No server key; device-only today.'
    },
    {
      station: 'Ask less of me', stationKey: 'demand',
      stationValues: 'normal · low', serverKey: null,
      binding: 'none',
      note: 'No server key. The Bad Day posture (decision #16) lives on this device for now.'
    },
    {
      station: null, stationKey: null, stationValues: null,
      serverKey: 'contrast', binding: 'server-only',
      note: 'comfortable · high. No Station control yet.'
    },
    {
      station: null, stationKey: null, stationValues: null,
      serverKey: 'text_scale', binding: 'server-only',
      note: '1 · 1.25 · 1.5. No Station control yet.'
    },
    {
      station: null, stationKey: null, stationValues: null,
      serverKey: 'target_size', binding: 'server-only',
      note: '44 · 56 px. The accessibility floor is 44 and the Station already meets it in CSS.'
    }
  ];

  /* ── small helpers ── */

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }

  function chip(status, text) {
    return '<span class="rd-chip" data-status="' + esc(status) + '">' +
      '<span class="rd-chip-text">' + esc(text || (API ? API.label(status) : status)) + '</span>' +
      '</span>';
  }

  function words(n, singular, plural) {
    return n + ' ' + (n === 1 ? singular : plural);
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

  function timeEl(iso, text) {
    if (!iso) { return esc(text || ''); }
    return '<time datetime="' + esc(iso) + '">' + esc(text || whenText(iso) || iso) + '</time>';
  }

  function sourceLine(envelopes) {
    return (envelopes || []).filter(Boolean).map(function (env) {
      var src = env.source || {};
      var id = src.id || '(uncurated)';
      var route = (src.method || '') + ' ' + (src.path || '');
      var via = src.via === 'embedded-fallback' ? ' · embedded fallback table' : '';
      return '<code>' + esc(id) + '</code> <code>' + esc(route) + '</code> — ' +
        esc(env.ok ? env.label : (env.error && env.error.message) || env.label) +
        esc(via);
    }).join('<br>');
  }

  /* Unique element ids: a page may carry two mounts of the same panel
     (the map page shows Needs-you twice, once per demand mode) and
     duplicate ids would break the aria-labelledby wiring. */
  var uidCounter = 0;
  function uid(prefix) {
    uidCounter += 1;
    return prefix + '-' + uidCounter;
  }

  /* A page that already carries its own section heading can point the
     panel at it (`data-rd-labelledby="h-needs"`) instead of getting a
     second one: heading hierarchy stays clean and there are no duplicate
     ids. Otherwise the panel renders its own. */
  function heading(mount, prefix, text) {
    var external = mount.getAttribute('data-rd-labelledby');
    var id = external || uid(prefix);
    return {
      id: id,
      html: external ? '' : '<h2 id="' + id + '">' + esc(text) + '</h2>'
    };
  }

  function stateBox(labelText, headingText, bodyHtml, retry) {
    return '<div class="rd-state">' +
      /* the label is optional: every panel already carries the status in
         words as a chip beside its heading, and saying the same word
         twice in a row reads as noise, not as emphasis */
      (labelText ? '<span class="rd-state-label">' + esc(labelText) + '</span>' : '') +
      '<h3>' + esc(headingText) + '</h3>' +
      bodyHtml +
      (retry ? '<button type="button" class="rd-btn" data-rd-retry>' + esc(retry) + '</button>' : '') +
      '</div>';
  }

  function failureBox(env, what, retryLabel) {
    var message = (env && env.error && env.error.message) || 'Could not load.';
    return stateBox('', what + ' could not be loaded',
      '<p>' + esc(message) + '</p>' +
      '<p>Nothing was guessed and nothing is hidden — this panel simply does not know yet.</p>',
      retryLabel || 'Try again');
  }

  /* ══════════════════════════════════════════════════════
     PROVIDER 1 — Needs you
     proposals awaiting a decision + reminders that are on.
     ══════════════════════════════════════════════════════ */

  function proposalItem(p) {
    var type = String(p.type || 'proposal');
    var status = String(p.status || 'unknown');
    var detail = [];
    /* type-specific fields only; never invent a description */
    if (p.text) { detail.push(p.text); }
    if (p.key) { detail.push('“' + p.key + '”' + (p.intent ? ' → ' + p.intent : '') + (p.fact ? ' → ' + p.fact : '')); }
    if (p.proposed_text) { detail.push(p.proposed_text); }
    if (p.entry_ts) { detail.push('corrects the entry of ' + p.entry_ts); }
    if (p.reason) { detail.push('reason: ' + p.reason); }
    if (p.service) { detail.push('service: ' + p.service); }
    return {
      id: String(p.proposal_id || p.id || ''),
      kind: 'proposal',
      kindWord: status === 'approved' ? 'approved, not yet run' : 'waiting for your decision',
      title: proposalTitle(type, status),
      detail: detail.join(' · '),
      status: 'needs_attention',
      iso: typeof p.created_at === 'number'
        ? new Date(p.created_at * 1000).toISOString() : null,
      raw: p
    };
  }

  /* Proposal `type` values, read from tool_registry.py's own propose
     calls: journal_write, world_intent, world_fact, reminder,
     reconciler_apply. An unknown type falls back to its own name rather
     than to invented copy. */
  function proposalTitle(type, status) {
    var words_ = {
      journal_write: 'A journal entry was drafted for you',
      world_intent: 'An intent was drafted for your world',
      world_fact: 'A fact was drafted for your world',
      reminder: 'A reminder was drafted for you',
      reconciler_apply: 'A settings reconciliation was drafted'
    };
    var base = words_[type] || ('A ' + type.replace(/_/g, ' ') + ' was drafted');
    return status === 'approved' ? base + ' — approved, waiting to run' : base;
  }

  function scheduleText(r) {
    var bits = [];
    if (r.cron_day) { bits.push(String(r.cron_day)); }
    if (r.cron_hour !== null && r.cron_hour !== undefined) {
      var hour = String(r.cron_hour).padStart(2, '0');
      var minute = String(r.cron_minute === null || r.cron_minute === undefined
        ? 0 : r.cron_minute).padStart(2, '0');
      bits.push('at ' + hour + ':' + minute);
    }
    if (!bits.length) { return 'no schedule set'; }
    return bits.join(' ');
  }

  function reminderItem(r) {
    return {
      id: String(r.id || ''),
      kind: 'reminder',
      kindWord: 'reminder',
      title: String(r.text || '(no text)'),
      detail: scheduleText(r),
      status: 'healthy',
      iso: typeof r.created_at === 'number'
        ? new Date(r.created_at * 1000).toISOString() : null,
      raw: r
    };
  }

  /* One fetch per page load, however many mounts ask: the low-demand
     block and the Needs-you section on the map page both render this,
     and they must agree. `needsYou({fresh:true})` forces a re-read. */
  var needsCache = null;

  function needsYou(options) {
    if (!API) { return Promise.resolve(noClient()); }
    if (needsCache && !(options && options.fresh)) { return needsCache; }
    needsCache = Promise.all([
      API.read('PROP-list'),
      API.read('API-067-get')
    ]).then(function (res) {
      var proposals = res[0];
      var reminders = res[1];
      var items = [];
      var counts = { proposals: 0, pending: 0, approved: 0, reminders: 0, activeReminders: 0 };

      if (proposals.ok && Array.isArray(proposals.data)) {
        counts.proposals = proposals.data.length;
        proposals.data.forEach(function (p) {
          if (!p || typeof p !== 'object') { return; }
          if (p.status === 'pending') { counts.pending += 1; items.push(proposalItem(p)); }
          else if (p.status === 'approved') { counts.approved += 1; items.push(proposalItem(p)); }
          /* rejected / executed are history, not a demand on you */
        });
      }
      if (reminders.ok && Array.isArray(reminders.data)) {
        counts.reminders = reminders.data.length;
        reminders.data.forEach(function (r) {
          if (!r || typeof r !== 'object') { return; }
          if (r.enabled !== false) { counts.activeReminders += 1; items.push(reminderItem(r)); }
        });
      }

      var failed = [proposals, reminders].filter(function (e) { return !e.ok; });
      var status;
      if (failed.length) {
        /* NEVER claim "all quiet" while a source could not be checked. */
        status = API.worst([proposals.status, reminders.status]);
      } else {
        status = items.some(function (i) { return i.kind === 'proposal'; })
          ? 'needs_attention' : 'healthy';
      }

      return {
        state: failed.length ? 'error' : (items.length ? 'ok' : 'empty'),
        ok: failed.length === 0,
        status: status,
        label: API.label(status),
        items: items,
        counts: counts,
        partial: failed.length > 0 && failed.length < 2,
        error: failed.length
          ? (failed[0].error || { code: 'source_failed', message: 'A source could not be read.' })
          : null,
        unchecked: failed.map(function (e) {
          return (e.source && (e.source.id || e.source.path)) || 'a source';
        }),
        envelopes: [proposals, reminders],
        fetchedAt: new Date().toISOString()
      };
    }).catch(function (err) {
      return broken('Needs you', err);
    }).then(function (result) {
      /* never cache a failure: a retry has to actually retry */
      if (!result.ok) { needsCache = null; }
      return result;
    });
    return needsCache;
  }

  /* ══════════════════════════════════════════════════════
     PROVIDER 2 — Journal entries (API-005)
     ══════════════════════════════════════════════════════ */

  function journalEntries(options) {
    if (!API) { return Promise.resolve(noClient()); }
    var limit = (options && options.limit) || 12;
    return API.read('API-005', { query: { n: limit } }).then(function (env) {
      if (!env.ok) {
        return {
          state: env.state, ok: false, status: env.status, label: env.label,
          entries: [], count: 0, envelope: env,
          error: env.error, fetchedAt: env.fetchedAt
        };
      }
      var rows = Array.isArray(env.data) ? env.data : [];
      var entries = rows.map(function (e) {
        var prov = (e && e.provenance) || {};
        return {
          iso: e && e.ts ? String(e.ts) : null,
          when: whenText(e && e.ts),
          kind: e && e.kind ? String(e.kind) : 'unknown',
          kindWord: KIND_WORDS[e && e.kind] || String(e && e.kind || 'entry'),
          summary: e && e.summary ? String(e.summary) : '(no text)',
          source: prov.source ? String(prov.source) : null,
          classification: e && e.classification ? String(e.classification) : null,
          corrects: e && e.supersedes ? String(e.supersedes) : null,
          correctionReason: e && e.supersede_reason ? String(e.supersede_reason) : null,
          raw: e
        };
      });
      return {
        state: entries.length ? 'ok' : 'empty',
        ok: true,
        status: env.status,
        label: env.label,
        entries: entries,
        count: entries.length,
        requested: limit,
        envelope: env,
        error: null,
        fetchedAt: env.fetchedAt
      };
    }).catch(function (err) {
      return broken('Journal', err);
    });
  }

  /* ══════════════════════════════════════════════════════
     PROVIDER 3 — Preferences (API-030 + API-031)
     ══════════════════════════════════════════════════════ */

  function preferences() {
    if (!API) { return Promise.resolve(noClient()); }
    return Promise.all([
      API.read('API-030-get'),
      API.read('API-031')
    ]).then(function (res) {
      var prefsEnv = res[0];
      var schemaEnv = res[1];
      return {
        state: prefsEnv.ok ? (prefsEnv.state === 'empty' ? 'empty' : 'ok') : prefsEnv.state,
        ok: prefsEnv.ok,
        /* A preferences object carries no status field of its own, so the
           generic mapper honestly says `unknown` ("this payload makes no
           health claim"). Here the domain knows better: a successful read
           means the preferences ARE known. That is a provider decision,
           not a transport one — which is why this layer exists. */
        status: prefsEnv.ok ? 'healthy' : prefsEnv.status,
        label: prefsEnv.ok ? 'loaded' : prefsEnv.label,
        prefs: prefsEnv.ok && prefsEnv.data && typeof prefsEnv.data === 'object'
          ? prefsEnv.data : null,
        schema: schemaEnv.ok && schemaEnv.data && typeof schemaEnv.data === 'object'
          ? schemaEnv.data : null,
        schemaAvailable: schemaEnv.ok,
        binding: PREF_BINDING,
        envelopes: [prefsEnv, schemaEnv],
        error: prefsEnv.error,
        fetchedAt: prefsEnv.fetchedAt
      };
    }).catch(function (err) {
      return broken('Preferences', err);
    });
  }

  /* ── shared failure shapes ── */

  function noClient() {
    return {
      state: 'error', ok: false, status: 'unavailable',
      label: 'can’t reach it',
      items: [], entries: [], count: 0, prefs: null,
      error: { code: 'no_client', message: 'api.js did not load, so nothing could be fetched.' },
      fetchedAt: new Date().toISOString()
    };
  }

  function broken(what, err) {
    return {
      state: 'error', ok: false, status: 'unavailable',
      label: 'can’t reach it',
      items: [], entries: [], count: 0, prefs: null,
      error: { code: 'unexpected', message: what + ' failed: ' + ((err && err.message) || String(err)) },
      fetchedAt: new Date().toISOString()
    };
  }

  /* ══════════════════════════════════════════════════════
     RENDERERS — opt-in mounts, never a rewrite of a view
     ══════════════════════════════════════════════════════ */

  function disclosure(title, bodyHtml) {
    return '<details class="tech rd-disclosure">' +
      '<summary>' + esc(title) + '</summary>' +
      '<div class="tech-body">' + bodyHtml + '</div>' +
      '</details>';
  }

  function specimenRegisterHtml() {
    var rows = SPECIMEN_REMAINING.map(function (s) {
      return '<li><strong>' + esc(s.surface) + '</strong> — specimen, because ' +
        esc(s.reason) + (s.view && s.view !== '—' ? ' (<code>' + esc(s.view) + '</code>)' : '') + '</li>';
    }).join('');
    return '<p>Still specimen on purpose, and labelled where it appears:</p><ul>' + rows + '</ul>';
  }

  /* ── Needs you ── */

  function renderNeedsYou(mount) {
    if (!mount) { return; }
    mount.classList.add('rd');
    /* The low-demand block asks for less chrome: same truth, shorter. */
    var quiet = mount.getAttribute('data-rd-variant') === 'quiet';
    var title = heading(mount, 'rd-needs', 'Needs you');
    mount.innerHTML = '<p class="rd-loading" role="status">Checking what needs you…</p>';

    function paint(result) {
      var head = '<div class="rd-head">' + title.html +
        chip(result.status, result.label) +
        '</div>';

      if (!result.ok) {
        var partialNote = result.partial
          ? '<p>Part of this could not be checked (' + esc((result.unchecked || []).join(', ')) +
            '), so “all quiet” would be a guess. It is not shown.</p>'
          : '';
        mount.innerHTML = head +
          stateBox('',
            result.partial ? 'Some of this could not be checked' : 'This could not be checked',
            partialNote +
            '<p>' + esc((result.error && result.error.message) ||
              (result.envelopes || []).map(function (e) {
                return e.ok ? '' : ((e.error && e.error.message) || 'unavailable');
              }).filter(Boolean).join(' · ') || 'Could not reach the server.') + '</p>',
            'Try again');
        wireRetry(mount, renderNeedsYou);
        return;
      }

      if (!result.items.length) {
        mount.innerHTML = head +
          '<p class="rd-lede">Nothing needs you right now. Both sources were checked ' +
          'just now — this is verified, not assumed.</p>' +
          (quiet ? '' : disclosure('technical · needs you',
            'sources: ' + sourceLine(result.envelopes) + '<br>' +
            'proposals: ' + result.counts.proposals +
            ' (' + result.counts.pending + ' waiting, ' + result.counts.approved + ' approved)<br>' +
            'reminders: ' + result.counts.reminders +
            ' (' + result.counts.activeReminders + ' on)<br>' +
            'read-only: this panel never approves, rejects, runs or schedules anything.'));
        return;
      }

      var proposals = result.items.filter(function (i) { return i.kind === 'proposal'; });
      var reminders = result.items.filter(function (i) { return i.kind === 'reminder'; });
      var lede = proposals.length
        ? words(proposals.length, 'thing is waiting for your decision', 'things are waiting for your decision') +
          (reminders.length ? ', and ' + words(reminders.length, 'reminder is on', 'reminders are on') + '.' : '.')
        : words(reminders.length, 'reminder is on', 'reminders are on') + '. Nothing is waiting for a decision.';

      if (quiet) {
        /* Low-demand mode should ask for LESS, not more. The full list is
           already on this page below, so this block says what needs you in
           words and does not repeat every item — a second copy would put
           each entry in the reading order twice. */
        mount.innerHTML = head +
          '<p class="rd-lede">' + esc(lede) + '</p>' +
          '<p class="rd-lede">The details are just below, on this same page. ' +
          'Asking for less hides nothing.</p>';
        return;
      }

      var list = result.items.map(function (item) {
        return '<li class="rd-item">' +
          '<p class="rd-item-kind">' + esc(item.kindWord) + '</p>' +
          '<h3 class="rd-item-title">' + esc(item.title) + '</h3>' +
          (item.detail ? '<p class="rd-item-detail">' + esc(item.detail) + '</p>' : '') +
          '<p class="rd-item-meta">' +
          (item.iso ? timeEl(item.iso) + ' · ' : '') +
          esc(item.kind === 'proposal'
            ? 'nothing changes until you approve it — this panel is read-only'
            : 'reminders are read here; changing them is a gated write') +
          '</p>' +
          '</li>';
      }).join('');

      mount.innerHTML = head +
        '<p class="rd-lede">' + esc(lede) + '</p>' +
        '<ul class="rd-list" aria-labelledby="' + title.id + '">' + list + '</ul>' +
        (quiet ? '' : disclosure('technical · needs you',
          'sources: ' + sourceLine(result.envelopes) + '<br>' +
          'proposals: ' + result.counts.proposals +
          ' (' + result.counts.pending + ' waiting, ' + result.counts.approved + ' approved)<br>' +
          'reminders: ' + result.counts.reminders +
          ' (' + result.counts.activeReminders + ' on)<br>' +
          'approve / reject / run are <code>gate: step-up</code> and ' +
          '<code>gate: proposal</code> writes (PROP-approve, PROP-reject, PROP-execute); ' +
          'this panel performs none of them.<br>' +
          specimenRegisterHtml()));
    }

    needsYou().then(paint);
  }

  /* ── Journal ── */

  function renderJournal(mount, options) {
    if (!mount) { return; }
    mount.classList.add('rd');
    var title = heading(mount, 'rd-journal', 'Your journal');
    mount.innerHTML = '<p class="rd-loading" role="status">Loading your journal…</p>';

    function paint(result) {
      var head = '<div class="rd-head">' + title.html +
        chip(result.status, result.label) +
        '</div>';

      if (!result.ok) {
        mount.innerHTML = head + failureBox(result, 'Your journal', 'Try again');
        wireRetry(mount, function (m) { renderJournal(m, options); });
        return;
      }

      if (!result.entries.length) {
        mount.innerHTML = head +
          '<p class="rd-lede">No journal entries yet. This is your real journal, read ' +
          'from the server — it is genuinely empty, not sample content.</p>' +
          disclosure('technical · your journal',
            'source: ' + sourceLine([result.envelope]) + '<br>' +
            'writing an entry is <code>API-006 POST /api/journal</code> (gate: none, ' +
            'authenticated); correcting one is <code>API-007</code> (gate: step-up). ' +
            'This panel does neither.');
        return;
      }

      var cards = result.entries.map(function (e) {
        return '<li class="rd-item">' +
          '<p class="rd-item-kind">' + esc(e.kindWord) +
          (e.classification === 'private' ? ' · private' : '') + '</p>' +
          '<h3 class="rd-item-title">' + esc(e.summary) + '</h3>' +
          '<p class="rd-item-meta">' +
          (e.iso ? timeEl(e.iso, e.when) : 'undated') +
          (e.source ? ' · from ' + esc(e.source) : '') +
          (e.corrects ? ' · corrects an earlier entry' +
            (e.correctionReason ? ' (' + esc(e.correctionReason) + ')' : '') : '') +
          '</p>' +
          '</li>';
      }).join('');

      mount.innerHTML = head +
        '<p class="rd-lede">' +
        esc(words(result.count, 'real entry', 'real entries')) +
        ', newest first. Nothing here is sample content.</p>' +
        '<ul class="rd-list" aria-labelledby="' + title.id + '">' + cards + '</ul>' +
        disclosure('technical · your journal',
          'source: ' + sourceLine([result.envelope]) + '<br>' +
          'requested: ' + result.requested + ' entries · returned: ' + result.count + '<br>' +
          'kinds use the server’s journal vocabulary (observation, health, drift, ' +
          'recommendation, approval, reconciliation, provider_action, failure, ' +
          'pack_change, settings_change, security, discovery); the plain word above ' +
          'is a label, the canonical kind stays in the payload.<br>' +
          'the specimen panel on this page is a design sample and is labelled as such — ' +
          'this list is your data.<br>' +
          specimenRegisterHtml());
    }

    journalEntries(options).then(paint);
  }

  /* ── Preferences ── */

  function renderPreferences(mount) {
    if (!mount) { return; }
    mount.classList.add('rd');
    var title = heading(mount, 'rd-prefs', 'What the server knows about how this feels');
    mount.innerHTML = '<p class="rd-loading" role="status">Loading your preferences…</p>';

    function bindingWord(binding) {
      return { exact: 'bindable', partial: 'partial', none: 'device-only', 'server-only': 'server-only' }[binding] || binding;
    }

    function paint(result) {
      var head = '<div class="rd-head">' + title.html +
        chip(result.status, result.label) +
        '</div>';

      if (!result.ok) {
        mount.innerHTML = head + failureBox(result, 'Your preferences', 'Try again');
        wireRetry(mount, renderPreferences);
        return;
      }

      var prefs = result.prefs || {};
      var schema = result.schema || {};

      var rows = PREF_BINDING.map(function (row) {
        var serverKey = row.serverKey;
        var value = serverKey && prefs ? prefs[serverKey] : undefined;
        var allowed = serverKey && schema[serverKey] && Array.isArray(schema[serverKey].allowed)
          ? schema[serverKey].allowed.join(' · ') : null;
        return '<tr>' +
          '<th scope="row">' + esc(row.station || '—') + '</th>' +
          '<td>' + (row.stationValues ? esc(row.stationValues) : '<span class="rd-none">no control</span>') + '</td>' +
          '<td>' + (serverKey ? '<code>' + esc(serverKey) + '</code>' : '<span class="rd-none">no server key</span>') +
          (value !== undefined && value !== null
            ? '<br>set to <code>' + esc(value) + '</code>'
            : (serverKey ? '<br><span class="rd-none">not set</span>' : '')) +
          (allowed ? '<br>allowed: ' + esc(allowed) : '') + '</td>' +
          '<td>' + esc(bindingWord(row.binding)) + '<br>' + esc(row.note) + '</td>' +
          '</tr>';
      }).join('');

      mount.innerHTML = head +
        '<p class="rd-lede">These are your real stored preferences, read from the server. ' +
        'The controls above still write to this device only — the table says exactly how ' +
        'far each one reaches, and nothing is claimed that is not true.</p>' +
        '<table class="rd-table">' +
        '<caption>Station control → server preference (API-030). ' +
        'Vocabulary from the server’s own schema (API-031), so this table cannot ' +
        'offer a value the server would reject.</caption>' +
        '<thead><tr><th scope="col">Station control</th><th scope="col">Its values here</th>' +
        '<th scope="col">Server key and value</th><th scope="col">How far it reaches</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table>' +
        disclosure('technical · preferences',
          'sources: ' + sourceLine(result.envelopes) + '<br>' +
          'reading is <code>gate: none</code>; saving is ' +
          '<code>API-030-put PUT /api/prefs</code>, <code>gate: step-up</code>. ' +
          'This panel is read-only on purpose: a preference that changes how the whole ' +
          'Station feels should be a deliberate act, not a side effect of opening a page.<br>' +
          'the accessibility floor lives in the server preference schema ' +
          '(<code>target_size</code> floor 44px, <code>motion</code> floor off, ' +
          '<code>contrast</code> floor comfortable); your OS reduced-motion setting ' +
          'outranks every application preference.');
    }

    preferences().then(paint);
  }

  /* ── retry wiring (one handler shape for every mount) ── */

  function wireRetry(mount, renderFn) {
    var btn = mount.querySelector('[data-rd-retry]');
    if (!btn) { return; }
    btn.addEventListener('click', function () { renderFn(mount); });
  }

  /* ── opt-in auto-mount ─────────────────────────────────
     A page opts in by carrying the attribute; nothing is injected into
     a page that did not ask for it. */
  function autoMount() {
    document.querySelectorAll('[data-rd-needs-you]').forEach(function (m) { renderNeedsYou(m); });
    document.querySelectorAll('[data-rd-journal]').forEach(function (m) {
      var limit = parseInt(m.getAttribute('data-rd-journal'), 10);
      renderJournal(m, { limit: isNaN(limit) ? 12 : limit });
    });
    document.querySelectorAll('[data-rd-prefs]').forEach(function (m) { renderPreferences(m); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  /* ── the public surface: what a content view consumes ── */
  window.PW_REAL_DATA = {
    /* providers — normalized, honest, read-only */
    needsYou: needsYou,
    journalEntries: journalEntries,
    preferences: preferences,
    /* renderers — call these from a view instead of re-fetching */
    renderNeedsYou: renderNeedsYou,
    renderJournal: renderJournal,
    renderPreferences: renderPreferences,
    /* reference data a view may need */
    specimenRemaining: SPECIMEN_REMAINING,
    prefBinding: PREF_BINDING,
    kindWords: KIND_WORDS,
    specimenRegisterHtml: specimenRegisterHtml,
    /* helpers shared with views so wording stays consistent */
    chip: chip,
    esc: esc,
    whenText: whenText,
    timeEl: timeEl,
    stateBox: stateBox,
    failureBox: failureBox,
    sourceLine: sourceLine
  };
})();
