/* ═══════════════════════════════════════════════════════
   API CLIENT — one door to the whole Lego box.

   Product decision #17: the API is a fully-exposed, safely-gated Lego
   box, and every surface composes against it. This file is the Station's
   single client. It:

   • loads GET /api/manifest and builds its call table from the server's
     own curated endpoint list (so a new backend capability is callable
     here without editing this file);
   • falls back to a small EMBEDDED table of the endpoints the Station
     already uses when the manifest cannot be reached. The fallback is a
     subset, it says so, and every envelope records which source it came
     from (`source.via`) — a fallback answer is never presented as the
     full box;
   • sends same-origin credentials (the pw_session cookie), so there is
     no CORS anywhere and no token in localStorage;
   • maps EVERY response onto the canonical status vocabulary
     (src/personal_world/status.py) plus explicit loading/error states,
     and never invents data to fill a gap.

   WRITE SAFETY (never bypassed):
   • `read()` only ever calls endpoints the manifest marks kind:"read".
   • `write()` refuses, locally and before any request, unless the
     endpoint's gate is satisfied. A gate of "step-up" or "proposal"
     needs a real elevation; this client will NOT fake one. It never
     sends the delegated `X-PW-StepUp` proxy header from a browser — that
     header means "a trusted proxy already authenticated this caller",
     and a page asserting it about itself would be self-elevation.
     Instead `elevate(token)` performs the real credential event
     (POST /api/auth/step-up) and only then retries the write. Without a
     credential the caller gets an honest `blocked` envelope explaining
     what is missing.

   HONESTY:
   • a failure is a status, not silence: unavailable / not_configured /
     unknown, with the reason in plain language;
   • an empty list is `ok` + `empty`, never an error and never padded;
   • `stale` is only claimed when the payload itself carries an
     observation timestamp we can compare.

   ACCESSIBILITY: this module renders nothing. It returns envelopes that
   carry a plain-language `label` for every status, so a view can always
   put the state into words rather than into colour alone.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MANIFEST_PATH = '/api/manifest';

  /* Canonical vocabulary — mirrors src/personal_world/status.py.
     `warning` exists in the code too; it is kept so a provider status is
     never silently rewritten into something it is not. */
  var STATUS = [
    'healthy', 'needs_attention', 'unavailable', 'stale',
    'unknown', 'not_configured', 'disabled', 'warning'
  ];

  /* Plain-language surface copy (the Station's own disclosure wording).
     Status is never colour-alone: this label is the carrier. */
  var LABELS = {
    healthy: 'all good',
    needs_attention: 'needs you',
    warning: 'worth a look',
    unavailable: 'can’t connect right now',
    stale: 'may be out of date',
    unknown: 'not known yet',
    not_configured: 'not set up yet',
    disabled: 'off'
  };

  /* Ranking mirrors status.py RANK so a roll-up here agrees with a
     roll-up on the server. Higher = more deserving of attention. */
  var RANK = {
    healthy: 0, warning: 1, unknown: 2, needs_attention: 3,
    unavailable: 4, stale: 5, disabled: 6, not_configured: 7
  };

  /* How old a payload's own observation timestamp may be before we call
     it stale. Only applied when the payload carries one. */
  var STALE_AFTER_MS = 6 * 60 * 60 * 1000;
  var STALE_FIELDS = ['observed_at', 'generated_at', 'checked_at', 'updated_at'];

  /* ── Embedded fallback ─────────────────────────────────────────────
     A SUBSET, used only when /api/manifest cannot be reached. Gates here
     are copied from the server's curated table; if they ever disagree,
     the server wins and `refreshManifest()` picks that up. */
  var FALLBACK = [
    ['AUTH-009-session', 'GET', '/api/auth/session', 'auth', 'read', 'none'],
    ['AUTH-009-step-up', 'POST', '/api/auth/step-up', 'auth', 'write', 'none'],
    ['API-003', 'GET', '/api/status', 'world', 'read', 'none'],
    ['API-015', 'GET', '/api/manifest', 'manifest', 'read', 'none'],
    ['API-020', 'GET', '/api/connections/overview', 'connections', 'read', 'none'],
    ['API-005', 'GET', '/api/journal', 'journal', 'read', 'none'],
    ['API-006', 'POST', '/api/journal', 'journal', 'write', 'none'],
    ['API-030-get', 'GET', '/api/prefs', 'prefs', 'read', 'none'],
    ['API-030-put', 'PUT', '/api/prefs', 'prefs', 'write', 'step-up'],
    ['API-031', 'GET', '/api/prefs/schema', 'prefs', 'read', 'none'],
    ['API-033', 'GET', '/api/source-control/status', 'source_control', 'read', 'none'],
    ['API-049', 'GET', '/api/discovery/status', 'discovery', 'read', 'none'],
    ['API-051-get', 'GET', '/api/discovery/interests', 'discovery', 'read', 'none'],
    ['API-054', 'GET', '/api/media/library', 'media', 'read', 'none'],
    ['API-067-get', 'GET', '/api/reminders', 'reminders', 'read', 'none'],
    ['API-079', 'GET', '/api/projects/status', 'projects', 'read', 'none'],
    ['PROP-list', 'GET', '/api/proposals', 'proposals', 'read', 'none'],
    ['PROP-approve', 'POST', '/api/proposals/{proposal_id}/approve', 'proposals', 'write', 'step-up'],
    ['PROP-reject', 'POST', '/api/proposals/{proposal_id}/reject', 'proposals', 'write', 'step-up'],
    ['PROP-execute', 'POST', '/api/proposals/{proposal_id}/execute', 'proposals', 'write', 'proposal']
  ].map(function (r) {
    return { id: r[0], method: r[1], path: r[2], capability: r[3], kind: r[4], gate: r[5] };
  });

  var byId = {};
  var byRoute = {};
  var box = null;            /* the loaded manifest payload */
  var boxSource = 'none';    /* 'manifest' | 'embedded-fallback' | 'none' */
  var boxReason = null;
  var pending = null;

  function indexEndpoints(list) {
    byId = {};
    byRoute = {};
    (list || []).forEach(function (ep) {
      if (!ep || !ep.path) { return; }
      var norm = normalize(ep);
      if (norm.id) { byId[norm.id] = norm; }
      byRoute[norm.method + ' ' + norm.path] = norm;
    });
  }

  function normalize(ep) {
    return {
      id: ep.id || null,
      method: String(ep.method || 'GET').toUpperCase(),
      path: ep.path,
      capability: ep.capability || 'uncurated',
      kind: ep.kind === 'write' ? 'write' : 'read',
      gate: ep.gate || 'none',
      auth: ep.auth || 'authenticated',
      present: ep.present !== false,
      note: ep.note || null
    };
  }

  function useFallback(reason) {
    boxSource = 'embedded-fallback';
    boxReason = reason;
    box = {
      endpoints: FALLBACK,
      coverage: {
        complete: false,
        partial: true,
        curated: FALLBACK.length,
        uncurated: 0
      },
      writes_without_elevation: [],
      curated_but_not_registered: []
    };
    indexEndpoints(FALLBACK);
  }

  /* ── Manifest loading ─────────────────────────────────────────── */

  function loadManifest() {
    if (pending) { return pending; }
    pending = fetch(MANIFEST_PATH, {
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) { throw { code: 'http_' + res.status, message: 'manifest request failed (' + res.status + ')' }; }
      return res.json();
    }).then(function (json) {
      var payload = json && json.endpoints;
      if (!payload || !Array.isArray(payload.endpoints)) {
        throw { code: 'shape', message: 'manifest did not carry an endpoint list' };
      }
      box = payload;
      boxSource = 'manifest';
      boxReason = null;
      /* curated rows first, then anything the server reports but has not
         curated yet — both are callable, the label differs */
      indexEndpoints((payload.endpoints || []).concat(payload.uncurated || []));
      return boxInfo();
    }).catch(function (err) {
      useFallback(err && err.message ? err.message : String(err));
      return boxInfo();
    }).then(function (info) {
      pending = null;
      return info;
    });
    return pending;
  }

  function boxInfo() {
    return {
      source: boxSource,
      reason: boxReason,
      complete: !!(box && box.coverage && box.coverage.complete),
      counts: box && box.coverage ? {
        curated: box.coverage.curated || 0,
        uncurated: box.coverage.uncurated || 0
      } : { curated: FALLBACK.length, uncurated: 0 },
      writesWithoutElevation: (box && box.writes_without_elevation) || [],
      notRegistered: (box && box.curated_but_not_registered) || []
    };
  }

  /* ── Lookup ───────────────────────────────────────────────────── */

  /* Accepts an id ("API-005"), a path ("/api/journal"), or a route
     ("GET /api/journal"). Returns null when the box has no such call —
     callers must say so plainly rather than guess a URL. */
  function describe(key) {
    if (!key) { return null; }
    if (byId[key]) { return byId[key]; }
    var trimmed = String(key).trim();
    if (trimmed.indexOf('/') === 0) {
      /* a bare path: prefer GET, otherwise the only verb we know */
      var get = byRoute['GET ' + trimmed];
      if (get) { return get; }
      var hits = Object.keys(byRoute).filter(function (k) {
        return k.slice(k.indexOf(' ') + 1) === trimmed;
      });
      return hits.length === 1 ? byRoute[hits[0]] : null;
    }
    return byRoute[trimmed.toUpperCase()] || null;
  }

  function endpoints() {
    return Object.keys(byRoute).map(function (k) { return byRoute[k]; });
  }

  function fillPath(ep, params) {
    var missing = [];
    var path = ep.path.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_m, name) {
      var value = params ? params[name] : undefined;
      if (value === undefined || value === null || value === '') {
        missing.push(name);
        return '';
      }
      return encodeURIComponent(String(value));
    });
    return missing.length ? { error: missing } : { path: path };
  }

  function buildUrl(ep, opts) {
    var filled = fillPath(ep, opts && opts.params);
    if (filled.error) { return filled; }
    var url = filled.path;
    var query = opts && opts.query;
    if (query) {
      var parts = [];
      Object.keys(query).forEach(function (k) {
        var v = query[k];
        if (v === undefined || v === null) { return; }
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
      });
      if (parts.length) { url += (url.indexOf('?') === -1 ? '?' : '&') + parts.join('&'); }
    }
    return { url: url };
  }

  /* ── Status mapping ───────────────────────────────────────────── */

  function isStatus(value) {
    return typeof value === 'string' && STATUS.indexOf(value) !== -1;
  }

  function worst(statuses) {
    var best = null;
    (statuses || []).forEach(function (s) {
      if (!isStatus(s)) { return; }
      if (best === null || (RANK[s] || 0) > (RANK[best] || 0)) { best = s; }
    });
    return best || 'healthy';
  }

  function label(status, fallbackText) {
    return LABELS[status] || fallbackText || status;
  }

  function firstTimestamp(data) {
    if (!data || typeof data !== 'object') { return null; }
    for (var i = 0; i < STALE_FIELDS.length; i++) {
      var raw = data[STALE_FIELDS[i]];
      if (typeof raw !== 'string' || !raw) { continue; }
      var when = Date.parse(raw);
      if (!isNaN(when)) { return when; }
    }
    return null;
  }

  /* Roll a payload up to one canonical status. This is TRANSPORT/PROVIDER
     health, not meaning: an empty proposal list is a healthy call, and it
     is the view's job to say "nothing needs you".
     Precedence: an explicit canonical `status` in the payload wins (the
     server owns its own truth); otherwise a list is healthy; a map of
     member statuses rolls up with the server's own ranking; anything else
     is honestly `unknown` — never a guessed "healthy". */
  function statusOf(data) {
    if (data === null || data === undefined) { return 'unknown'; }
    if (typeof data === 'string') {
      return isStatus(data) ? data : 'unknown';
    }
    if (Array.isArray(data)) { return 'healthy'; }
    if (typeof data !== 'object') { return 'unknown'; }
    if (isStatus(data.status)) { return data.status; }

    var members = [];
    var sawMember = false;
    Object.keys(data).forEach(function (key) {
      var value = data[key];
      if (isStatus(value)) {
        sawMember = true;
        members.push(value);
        return;
      }
      if (!value || typeof value !== 'object') { return; }
      if (isStatus(value.status)) {
        sawMember = true;
        members.push(value.status);
        return;
      }
      /* one level deeper, so a payload shaped like
         {capabilities:{memory:{status:"healthy"}, …}} rolls up the way
         the server's own worst() would */
      Object.keys(value).forEach(function (inner) {
        var nested = value[inner];
        if (isStatus(nested)) { sawMember = true; members.push(nested); }
        else if (nested && typeof nested === 'object' && isStatus(nested.status)) {
          sawMember = true;
          members.push(nested.status);
        }
      });
    });
    if (sawMember) { return worst(members); }
    return 'unknown';
  }

  function envelope(fields) {
    var out = {
      state: 'ok',
      ok: true,
      status: 'unknown',
      label: LABELS.unknown,
      data: null,
      warnings: [],
      error: null,
      source: null,
      fetchedAt: new Date().toISOString()
    };
    Object.keys(fields || {}).forEach(function (k) { out[k] = fields[k]; });
    if (out.status) { out.label = label(out.status, out.label); }
    return out;
  }

  function sourceOf(ep) {
    if (!ep) { return { via: boxSource, id: null, method: null, path: null }; }
    return {
      via: boxSource,
      id: ep.id,
      method: ep.method,
      path: ep.path,
      capability: ep.capability,
      kind: ep.kind,
      gate: ep.gate,
      auth: ep.auth,
      note: ep.note
    };
  }

  function failEnvelope(ep, state, status, message, code, httpStatus) {
    return envelope({
      state: state,
      ok: false,
      status: status,
      data: null,
      error: { code: code || state, message: message, httpStatus: httpStatus || null },
      source: sourceOf(ep)
    });
  }

  /* A loading envelope, so a view can render "checking…" from the same
     shape it renders everything else (no bespoke loading vocabulary). */
  function loading(key) {
    var ep = describe(key);
    return envelope({
      state: 'loading',
      ok: false,
      status: 'unknown',
      label: 'checking…',
      data: null,
      source: sourceOf(ep)
    });
  }

  function detailOf(body, res) {
    if (body && typeof body === 'object') {
      if (typeof body.detail === 'string' && body.detail) { return body.detail; }
      if (Array.isArray(body.warnings) && typeof body.warnings[0] === 'string') {
        return body.warnings[0];
      }
    }
    return 'request failed (' + res.status + ')';
  }

  /* Presentation mappings for known server detail values. The API
     keeps its original machine-facing strings; only what a person is
     shown through this client is mapped here. (LANG-046/047/058) */
  var DETAIL_PRESENTATION = {
    "no session": 'Your sign-in expired. Sign in again.',
    "step-up credential invalid": 'That access code did not match. Nothing was changed.',
    "auth not configured": 'Sign-in is not set up.',
    "no source_control search paths configured": 'Source control is not set up.'
  };

  function presentDetail(body, res) {
    var raw = detailOf(body, res);
    return (raw && Object.prototype.hasOwnProperty.call(DETAIL_PRESENTATION, raw))
      ? DETAIL_PRESENTATION[raw] : raw;
  }

  function httpFailure(ep, res, body) {
    /* 401/403: the caller is not allowed to know — say so, and never
       dress it up as an empty list. */
    if (res.status === 401 || res.status === 403) {
      return failEnvelope(ep, 'unauthenticated', 'unavailable',
        res.status === 403
          ? ((body && body.detail === 'step-up credential invalid')
            ? DETAIL_PRESENTATION['step-up credential invalid']
            : 'That needs an elevation this session does not have.')
          : ((body && body.detail === 'no session')
            ? DETAIL_PRESENTATION['no session']
            : 'Sign in to see this.'), 'http_' + res.status, res.status);
    }
    /* 503 is the server's own "not configured yet" answer. */
    if (res.status === 503) {
      return failEnvelope(ep, 'not_configured', 'not_configured',
        presentDetail(body, res), 'http_503', 503);
    }
    if (res.status === 404) {
      return failEnvelope(ep, 'error', 'unknown', detailOf(body, res),
        'http_404', 404);
    }
    return failEnvelope(ep, 'error', 'unavailable', detailOf(body, res),
      'http_' + res.status, res.status);
  }

  /* ── The one request path ─────────────────────────────────────── */

  function request(ep, opts) {
    opts = opts || {};
    var built = buildUrl(ep, opts);
    if (built.error) {
      return Promise.resolve(failEnvelope(ep, 'error', 'unknown',
        'Missing path value(s): ' + built.error.join(', ') + '.', 'missing_param'));
    }
    var init = {
      method: ep.method,
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    };
    if (opts.body !== undefined && opts.body !== null) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch(built.url, init).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok) { return httpFailure(ep, res, body); }

        var payload = body && typeof body === 'object' && 'data' in body
          ? body.data : body;
        var warnings = (body && Array.isArray(body.warnings)) ? body.warnings : [];
        var explicitOk = body && typeof body === 'object' && 'ok' in body
          ? !!body.ok : true;

        if (!explicitOk) {
          /* The server said "not ok" with its own status word. Keep it. */
          var toldStatus = (body && isStatus(body.status)) ? body.status : 'needs_attention';
          return envelope({
            state: 'error',
            ok: false,
            status: toldStatus,
            data: payload === undefined ? null : payload,
            warnings: warnings,
            error: {
              code: 'not_ok',
              message: presentDetail(body, res),
              httpStatus: res.status
            },
            source: sourceOf(ep)
          });
        }

        var status = statusOf(payload);
        var empty = Array.isArray(payload) ? payload.length === 0
          : (payload === null || payload === undefined);
        var sawAt = firstTimestamp(payload);
        var isStale = sawAt !== null && (Date.now() - sawAt) > (opts.staleAfterMs || STALE_AFTER_MS);

        return envelope({
          state: empty ? 'empty' : 'ok',
          ok: true,
          /* a payload that reports its own bad status is not "ok" for the
             reader, even though the HTTP call succeeded */
          status: isStale && RANK[status] <= RANK.healthy ? 'stale' : status,
          data: payload === undefined ? null : payload,
          warnings: warnings,
          observedAt: sawAt === null ? null : new Date(sawAt).toISOString(),
          source: sourceOf(ep)
        });
      });
    }).catch(function (err) {
      if (err && err.state) { return err; }   /* already an envelope */
      return failEnvelope(ep, 'error', 'unavailable',
        'Could not reach the server.', 'network');
    });
  }

  /* ── Public helpers ───────────────────────────────────────────── */

  function ready() {
    return box ? Promise.resolve(boxInfo()) : loadManifest();
  }

  function refreshManifest() {
    pending = null;
    box = null;
    return loadManifest();
  }

  function read(key, opts) {
    return ready().then(function () {
      var ep = describe(key);
      if (!ep) {
        return failEnvelope(null, 'error', 'unknown',
          'No endpoint called “' + key + '” is in the API manifest.',
          'unknown_endpoint');
      }
      if (ep.kind !== 'read') {
        return failEnvelope(ep, 'blocked', 'unknown',
          ep.method + ' ' + ep.path + ' is a write. Use PW_API.write() so the ' +
          'gate is checked.', 'read_of_write');
      }
      if (ep.present === false) {
        return failEnvelope(ep, 'error', 'unavailable',
          'The manifest lists this endpoint but it is not registered on this ' +
          'server.', 'not_registered');
      }
      return request(ep, opts);
    });
  }

  function write(key, body, opts) {
    opts = opts || {};
    return ready().then(function () {
      var ep = describe(key);
      if (!ep) {
        return failEnvelope(null, 'error', 'unknown',
          'No endpoint called “' + key + '” is in the API manifest.',
          'unknown_endpoint');
      }
      if (ep.present === false) {
        return failEnvelope(ep, 'error', 'unavailable',
          'The manifest lists this endpoint but it is not registered on this ' +
          'server.', 'not_registered');
      }
      if (ep.gate === 'proposal') {
        return failEnvelope(ep, 'blocked', 'unknown',
          'This write only runs an already-approved proposal. Approve it ' +
          'first (PROP-approve); it cannot be called directly.',
          'proposal_required');
      }
      if (ep.gate === 'step-up' && !opts.assumeElevated) {
        if (!opts.credential) {
          return failEnvelope(ep, 'blocked', 'unknown',
            'This write needs an elevation (step-up). PW_API.elevate(token) ' +
            'performs the real credential event first — this client will not ' +
            'fake one.', 'step_up_required');
        }
        return elevate(opts.credential).then(function (grant) {
          if (!grant.ok) { return grant; }
          return request(ep, Object.assign({}, opts, { body: body, assumeElevated: true }));
        });
      }
      return request(ep, Object.assign({}, opts, { body: body }));
    });
  }

  /* The real step-up credential event: POST /api/auth/step-up with a
     token the person supplies. Nothing is stored here. */
  function elevate(token) {
    return ready().then(function () {
      var ep = describe('AUTH-009-step-up') || describe('POST /api/auth/step-up');
      if (!ep) {
        return failEnvelope(null, 'error', 'unknown',
          'This server does not expose a step-up route.', 'unknown_endpoint');
      }
      if (!token || !String(token).trim()) {
        return failEnvelope(ep, 'blocked', 'unknown',
          'An elevation needs your access code.', 'missing_credential');
      }
      return request(ep, { body: { token: String(token).trim() } });
    });
  }

  /* Who am I, and is an elevation live? Read-only, never a provider call. */
  function session() {
    return read('AUTH-009-session').then(function (env) {
      /* GET /api/auth/session answers {ok:false,status:"unauthenticated"}
         by design, so an envelope error here is information, not failure. */
      var data = env.data || {};
      return {
        authenticated: env.ok === true,
        hasStepUp: !!data.has_step_up,
        authMethod: data.auth_method || null,
        principalId: data.principal_id || null,
        envelope: env
      };
    });
  }

  /* Boot the box as early as possible so the first view is not waiting
     on a serial manifest fetch. Failures are already handled inside. */
  var boot = loadManifest();

  window.PW_API = {
    STATUS: STATUS,
    LABELS: LABELS,
    RANK: RANK,
    ready: function () { return boot.then(boxInfo); },
    info: boxInfo,
    refreshManifest: refreshManifest,
    endpoints: endpoints,
    describe: describe,
    read: read,
    write: write,
    elevate: elevate,
    session: session,
    loading: loading,
    worst: worst,
    isStatus: isStatus,
    label: label,
    statusOf: statusOf
  };
})();
