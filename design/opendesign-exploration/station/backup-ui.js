/* ═══════════════════════════════════════════════════════
   BACKUP / RESTORE — "Back up my world" SOS panel

   Mount: add <div id="settings-backup"></div> to
   settings.html and load this file after station.css.
   This hook does NOT wire itself into any page — the
   orchestrator decides when to mount it.

   WHAT IT DOES
     - Backup: asks for a passphrase (client-side only),
       POSTs /api/worlds/backup, then offers a ONE-TIME
       download of the encrypted archive.
     - Restore: file picker + passphrase → POST
       /api/worlds/restore, then an honest per-file report
       (restored / skipped / refused).

   HONESTY
     - The routes are step-up gated and may not be wired in
       this build: 404/405/501 renders a plain "not
       available in this build" state — never a fake
       success, never a spinner that lies.
     - Every failure shows the server's reason verbatim.
     - The archive is encrypted server-side; this panel
       never sees, stores, or logs plaintext world data.

   SECRETS
     - The passphrase travels in the request BODY only
       (never a URL, never localStorage, never console).
       It is cleared from the input on completion and is
       never written to any log line this file produces.

   ACCESSIBILITY (station floor)
     - All controls ≥ 44px tall, real <label>s, visible
       focus ring, aria-live="polite" status region,
       status never colour-alone (icon + text), no motion
       by default; any transition honours
       prefers-reduced-motion. Contrast uses station.css
       tokens that hold AA on --panel.
     - Zero dependencies. No framework, no network libs.
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MOUNT_ID = 'settings-backup';

  function mount() { return document.getElementById(MOUNT_ID); }
  if (!mount()) { return; }

  /* ── tiny DOM helpers (no innerHTML with dynamic data) ── */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') { node.className = attrs[k]; }
        else if (k === 'text') { node.textContent = attrs[k]; }
        else { node.setAttribute(k, attrs[k]); }
      });
    }
    (children || []).forEach(function (c) { if (c) { node.appendChild(c); } });
    return node;
  }

  var CSS = [
    '.pwbu { background: var(--panel, #1E2636);',
    '  border: 1px solid var(--border-warm, rgba(212,160,87,.22));',
    '  border-radius: 12px; padding: var(--s5, 24px);',
    '  color: var(--text, #EDE7DB); max-width: 46rem; }',
    '.pwbu h2 { font-family: var(--font-serif, Georgia, serif);',
    '  font-size: 22px; margin: 0 0 var(--s2, 8px); color: var(--cream, #E8DCC8); }',
    '.pwbu p.lede { margin: 0 0 var(--s4, 16px); color: var(--text-soft, #CDC6B8);',
    '  font-size: var(--fs-small, 14px); line-height: 1.5; }',
    '.pwbu label { display: block; font-size: var(--fs-label, 12.5px);',
    '  letter-spacing: .08em; text-transform: uppercase;',
    '  color: var(--text-faint, #A29A8C); margin: var(--s3, 12px) 0 var(--s1, 4px); }',
    '.pwbu input[type=password], .pwbu input[type=file] {',
    '  min-height: 44px; width: 100%; box-sizing: border-box;',
    '  background: var(--space, #080B14); color: var(--text, #EDE7DB);',
    '  border: 1px solid var(--border, rgba(232,220,200,.10));',
    '  border-radius: 8px; padding: 0 var(--s3, 12px);',
    '  font-size: 16px; font-family: var(--font-sans, system-ui, sans-serif); }',
    '.pwbu input[type=file] { padding: var(--s2, 8px); }',
    '.pwbu input:focus-visible, .pwbu button:focus-visible,',
    '.pwbu a:focus-visible { outline: 3px solid var(--amber, #D4A057);',
    '  outline-offset: 2px; }',
    '.pwbu .row { display: flex; flex-wrap: wrap; gap: var(--s3, 12px);',
    '  align-items: center; margin-top: var(--s4, 16px); }',
    '.pwbu button, .pwbu a.pwbu-dl { min-height: 44px; min-width: 44px;',
    '  display: inline-flex; align-items: center; justify-content: center;',
    '  gap: var(--s2, 8px); padding: 0 var(--s4, 16px); border-radius: 8px;',
    '  border: 1px solid var(--border-warm, rgba(212,160,87,.22));',
    '  background: var(--amber-soft, rgba(212,160,87,.16));',
    '  color: var(--cream, #E8DCC8); font-size: 16px; cursor: pointer;',
    '  text-decoration: none; font-family: inherit; }',
    '.pwbu button:hover:not(:disabled) { border-color: var(--amber, #D4A057); }',
    '.pwbu button:disabled { opacity: .55; cursor: progress; }',
    '.pwbu .check { display: flex; align-items: center; gap: var(--s2, 8px);',
    '  min-height: 44px; font-size: var(--fs-small, 14px);',
    '  color: var(--text-soft, #CDC6B8); }',
    '.pwbu .check input { width: 20px; height: 20px; accent-color: var(--amber, #D4A057); }',
    '.pwbu .status { margin-top: var(--s4, 16px); font-size: var(--fs-small, 14px);',
    '  line-height: 1.55; border-radius: 8px; padding: var(--s3, 12px);',
    '  border: 1px solid var(--border, rgba(232,220,200,.10)); }',
    '.pwbu .status[hidden] { display: none; }',
    '.pwbu .status.ok { border-color: rgba(106,154,102,.5);',
    '  background: var(--green-soft, rgba(106,154,102,.16)); }',
    '.pwbu .status.err { border-color: rgba(196,125,109,.5);',
    '  background: var(--coral-soft, rgba(196,125,109,.14)); }',
    '.pwbu .status.na { border-color: var(--border-warm, rgba(212,160,87,.22));',
    '  background: var(--cream-soft, rgba(232,220,200,.10)); }',
    '.pwbu ul.report { margin: var(--s2, 8px) 0 0; padding-left: 1.2em; }',
    '.pwbu hr { border: 0; border-top: 1px solid var(--border, rgba(232,220,200,.10));',
    '  margin: var(--s5, 24px) 0; }',
    /* Motion is opt-in and always yields to prefers-reduced-motion. */
    '@media (prefers-reduced-motion: no-preference) {',
    '  .pwbu button, .pwbu a.pwbu-dl { transition: border-color 120ms ease; } }',
    '@media (prefers-reduced-motion: reduce) {',
    '  .pwbu * { transition: none !important; animation: none !important; } }'
  ].join('\n');

  /* ── fetch with honest status classification ── */
  function call(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json()
        .catch(function () { return null; })
        .then(function (data) { return { status: res.status, data: data }; });
    }).catch(function () {
      return { status: 0, data: null }; /* network failure */
    });
  }

  function failureMessage(r) {
    if (r.status === 0) { return 'Could not reach the app server. Nothing was saved.'; }
    if (r.status === 404 || r.status === 405 || r.status === 501) {
      return 'Backup/restore is not available in this build (the API route is not wired). ' +
        'Use the CLI instead: personal-world worlds backup <file>';
    }
    if (r.status === 401 || r.status === 403) {
      var d = r.data && r.data.detail;
      return 'Refused: ' + (Array.isArray(d) ? d.join('; ') : (d ||
        'this action needs step-up authentication — sign in again, then retry.'));
    }
    var det = r.data && r.data.detail;
    return 'Failed (' + r.status + '): ' + (Array.isArray(det) ? det.join('; ') :
      (det || 'unknown error'));
  }

  function buildPanel(root) {
    var style = el('style', { text: CSS });
    var panel = el('section', { class: 'pwbu', 'aria-labelledby': 'pwbu-h' });

    /* ── BACKUP half ── */
    var bStatus = el('div', { class: 'status', role: 'status', 'aria-live': 'polite', hidden: 'hidden' });
    var bPassId = 'pwbu-backup-pass';
    var bPass = el('input', {
      type: 'password', id: bPassId, autocomplete: 'new-password',
      minlength: '8', required: 'required', 'aria-describedby': 'pwbu-backup-help'
    });
    var bVault = el('input', { type: 'checkbox', id: 'pwbu-vault' });
    var bBtn = el('button', { type: 'button', text: '⬇ Create encrypted backup' });
    var dlRow = el('div', { class: 'row', hidden: 'hidden' });

    function status(node, kind, msg) {
      node.className = 'status ' + kind;
      node.textContent = msg;
      node.hidden = false;
    }
    function busy(node, on, label) {
      node.disabled = on;
      if (on) { node.textContent = label; }
    }

    bBtn.addEventListener('click', function () {
      var pass = bPass.value;
      if (!pass) {
        status(bStatus, 'err', 'Enter a passphrase first. It encrypts the archive and is never stored — if you lose it, the backup cannot be opened.');
        bPass.focus();
        return;
      }
      dlRow.hidden = true;
      busy(bBtn, true, '⏳ Encrypting your world…');
      status(bStatus, 'na', 'Working: collecting the restore boundary and encrypting it. This may take a few seconds.');
      call('/api/worlds/backup', { passphrase: pass, include_vault: bVault.checked })
        .then(function (r) {
          busy(bBtn, false, '⬇ Create encrypted backup');
          bPass.value = ''; /* never linger in the DOM */
          if (r.status !== 200 || !r.data || !r.data.download) {
            status(bStatus, r.status === 404 || r.status === 405 || r.status === 501 ? 'na' : 'err', failureMessage(r));
            return;
          }
          status(bStatus, 'ok', 'Backup created — encrypted with your passphrase. ' +
            (r.data.vault_included ? 'Includes the secret vault. ' : 'Secret vault NOT included (default). ') +
            'The download link below works ONCE, then expires.');
          dlRow.hidden = false;
          dlRow.textContent = '';
          dlRow.appendChild(el('a', {
            class: 'pwbu-dl', href: r.data.download,
            text: '⬇ Download encrypted archive (one-time link)',
            download: 'personal-worlds-backup.pwbackup'
          }));
          dlRow.appendChild(el('span', {
            text: ' Copy it somewhere safe OFF this machine, and remember the passphrase.',
            style: 'font-size:14px;color:var(--text-soft,#CDC6B8)'
          }));
        });
    });

    panel.appendChild(el('h2', { id: 'pwbu-h', text: 'Back up my world' }));
    panel.appendChild(el('p', {
      class: 'lede', id: 'pwbu-backup-help',
      text: 'Creates ONE encrypted file with everything needed to rebuild this ' +
        'instance on a fresh machine: your world, journal, per-person trees, ' +
        'reminders, proposals, app + identity config, interests, and theme packs. ' +
        'It never contains active sessions or the search index (both rebuild ' +
        'themselves). The passphrase is the only key — it is never stored or ' +
        'recoverable, so write it down somewhere safe.'
    }));
    panel.appendChild(el('label', { for: bPassId, text: 'Backup passphrase' }));
    panel.appendChild(bPass);
    panel.appendChild(el('div', { class: 'check' }, [
      bVault,
      el('label', { for: 'pwbu-vault', style: 'margin:0;text-transform:none;letter-spacing:0;font-size:14px', text: 'Include the encrypted secret vault (vault.enc) — off by default' })
    ]));
    panel.appendChild(el('div', { class: 'row' }, [bBtn]));
    panel.appendChild(bStatus);
    panel.appendChild(dlRow);

    /* ── RESTORE half ── */
    panel.appendChild(el('hr'));
    var rStatus = el('div', { class: 'status', role: 'status', 'aria-live': 'polite', hidden: 'hidden' });
    var rPassId = 'pwbu-restore-pass';
    var rFile = el('input', { type: 'file', id: 'pwbu-restore-file', accept: '.pwbackup,application/octet-stream' });
    var rPass = el('input', { type: 'password', id: rPassId, autocomplete: 'current-password', required: 'required' });
    var rOver = el('input', { type: 'checkbox', id: 'pwbu-overwrite' });
    var rBtn = el('button', { type: 'button', text: '⬆ Restore from archive…' });

    rBtn.addEventListener('click', function () {
      var file = rFile.files && rFile.files[0];
      if (!file) {
        status(rStatus, 'err', 'Choose a backup archive first.');
        return;
      }
      if (!rPass.value) {
        status(rStatus, 'err', 'Enter the passphrase this archive was created with.');
        rPass.focus();
        return;
      }
      busy(rBtn, true, '⏳ Verifying and decrypting…');
      status(rStatus, 'na', 'Working: the archive is authenticated BEFORE anything is written. A wrong passphrase changes nothing.');
      file.arrayBuffer().then(function (buf) {
        var bytes = new Uint8Array(buf);
        var bin = '';
        var CHUNK = 0x8000;
        for (var i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        return call('/api/worlds/restore', {
          passphrase: rPass.value,
          archive_b64: btoa(bin),
          overwrite: rOver.checked
        });
      }).then(function (r) {
        busy(rBtn, false, '⬆ Restore from archive…');
        rPass.value = '';
        if (r.status !== 200 || !r.data) {
          status(rStatus, r.status === 404 || r.status === 405 || r.status === 501 ? 'na' : 'err', failureMessage(r));
          return;
        }
        var rep = r.data;
        rStatus.className = 'status ok';
        rStatus.textContent = '';
        rStatus.appendChild(el('div', {
          text: '✓ Restore finished: ' + (rep.restored || []).length + ' restored, ' +
            (rep.skipped || []).length + ' skipped (already present), ' +
            (rep.refused || []).length + ' refused.'
        }));
        [['Restored', rep.restored], ['Skipped', rep.skipped], ['Refused', rep.refused]].forEach(function (pair) {
          if (pair[1] && pair[1].length) {
            var list = el('ul', { class: 'report' });
            pair[1].forEach(function (item) { list.appendChild(el('li', { text: String(item) })); });
            rStatus.appendChild(el('div', { text: pair[0] + ':' }));
            rStatus.appendChild(list);
          }
        });
        rStatus.hidden = false;
      });
    });

    panel.appendChild(el('h2', { text: 'Restore my world' }));
    panel.appendChild(el('p', {
      class: 'lede',
      text: 'Import a backup archive into this instance. By default it only fills ' +
        'in files that are missing — nothing you already have is touched. ' +
        'Overwrite replaces existing files and is refused-per-file, honestly reported.'
    }));
    panel.appendChild(el('label', { for: 'pwbu-restore-file', text: 'Backup archive (.pwbackup)' }));
    panel.appendChild(rFile);
    panel.appendChild(el('label', { for: rPassId, text: 'Archive passphrase' }));
    panel.appendChild(rPass);
    panel.appendChild(el('div', { class: 'check' }, [
      rOver,
      el('label', { for: 'pwbu-overwrite', style: 'margin:0;text-transform:none;letter-spacing:0;font-size:14px', text: 'Overwrite files that already exist here' })
    ]));
    panel.appendChild(el('div', { class: 'row' }, [rBtn]));
    panel.appendChild(rStatus);

    root.textContent = '';
    root.appendChild(style);
    root.appendChild(panel);
  }

  function init() {
    var root = mount();
    if (!root) { return; }
    try {
      buildPanel(root);
    } catch (err) {
      /* Honest degraded state — never a broken silent mount. */
      root.textContent = '';
      root.appendChild(el('p', {
        text: 'Backup panel failed to load in this browser. The CLI path still works: ' +
          'personal-world worlds backup <file> — ' + (err && err.message ? err.message : 'unknown error')
      }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
