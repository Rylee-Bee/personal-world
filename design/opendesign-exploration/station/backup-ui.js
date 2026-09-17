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
     - Failure copy leads with what happened and what did
       NOT change; the server's own reason stays behind a
       "Technical details" disclosure (LANG-036/037).
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
    '.pwbu .pwbu-more summary { margin: var(--s2, 8px) 0 0; min-height: 44px;',
    '  display: flex; align-items: center; cursor: pointer;',
    '  color: var(--text-faint, #A29A8C); font-size: 13px; }',
    '.pwbu .pwbu-more summary:hover { color: var(--text, #EDE7DB); }',
    '.pwbu .pwbu-more pre { margin: 0 0 var(--s2, 8px); padding: var(--s2, 8px) var(--s3, 12px);',
    '  border-radius: 8px; background: var(--space, #080B14); overflow-x: auto;',
    '  color: var(--text-faint, #A29A8C); font-size: 13px; }',
    '.pwbu hr { border: 0; border-top: 1px solid var(--border, rgba(232,220,200,.10));',
    '  margin: var(--s5, 24px) 0; }',
    /* Motion is opt-in and always yields to prefers-reduced-motion. */
    '@media (prefers-reduced-motion: no-preference) {',
    '  .pwbu button, .pwbu a.pwbu-dl { transition: border-color 120ms ease; } }',
    /* Modal: no animation at all — reduced-motion-safe by construction. */
    '.pwbu-modal { position: fixed; inset: 0; z-index: 60;',
    '  display: grid; place-items: center; padding: 24px;',
    '  background: rgba(4,6,12,.7); }',
    '.pwbu-modal[hidden] { display: none; }',
    '.pwbu-modal-box { background: var(--panel, #1E2636);',
    '  border: 1px solid var(--border-warm, rgba(212,160,87,.3));',
    '  border-radius: 12px; padding: var(--s5, 24px); max-width: 34rem; }',
    '.pwbu-modal-box h3 { margin: 0 0 var(--s2, 8px);',
    '  font-family: var(--font-serif, Georgia, serif); font-size: 20px;',
    '  color: var(--cream, #E8DCC8); }',
    '.pwbu-modal-box p, .pwbu-note { margin: 0 0 var(--s3, 12px);',
    '  font-size: var(--fs-small, 14px); line-height: 1.55;',
    '  color: var(--text-soft, #CDC6B8); }',
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

  /* Presentation map. The server keeps its own machine-facing strings;
     only what this panel shows a person is mapped. Raw detail stays
     available behind a "Technical details" disclosure. (LANG-036/045/
     049-cousin-restore-unauthorized) */
  var CLI_BACKUP = 'personal-world worlds backup <file>';
  var CLI_RESTORE = 'personal-world worlds restore <file> [--overwrite]';

  function serverDetail(r) {
    var d = r.data && r.data.detail;
    if (Array.isArray(d)) { return d.join('; '); }
    return typeof d === 'string' ? d : (d ? JSON.stringify(d) : null);
  }

  function failureCopy(r) {
    if (r.status === 0) {
      return { text: 'Can’t connect to Project Worlds right now. Nothing was saved or changed. Check the connection and try again.', kind: 'err' };
    }
    if (r.status === 404 || r.status === 405 || r.status === 501) {
      return { text: 'Backups are not available in this interface on this build.', kind: 'na' };
    }
    if (r.status === 401 || r.status === 403) {
      var det0 = serverDetail(r);
      /* Wrong passphrase on restore: the archive failed authentication
         before anything was written. */
      if (/decryption failed authentication|wrong passphrase/i.test(det0 || '')) {
        return { text: 'The archive could not be unlocked. The passphrase may not match, or the file may be damaged. Your world was not changed.', kind: 'err' };
      }
      /* LANG-036 + LANG-045: the step-up this build supports is the
         instance access code; signing in again with an OIDC provider
         cannot confirm the action, so the limit is stated honestly. */
      return { text: 'Confirm it’s you before creating or restoring a backup. Nothing was changed. ' +
        'This action needs an access code — signing in again with your provider cannot confirm it yet.', kind: 'err' };
    }
    var det = serverDetail(r);
    if (r.status === 503 && /not installed|cryptography/i.test(det || '')) {
      return { text: 'Backups are not available on this server: the encryption support is missing. ' +
        'Whoever runs this instance can add it (see the technical details).', kind: 'na' };
    }
    return { text: 'That didn’t work. Nothing was changed.', kind: 'err', detail: det || ('status ' + r.status) };
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
    /* Failure rendering: human copy in the live region, the server's own
       strings behind a disclosure (or the CLI path when the surface is
       simply absent). (LANG-037) */
    function showFailure(node, r, cli) {
      var f = failureCopy(r);
      status(node, f.kind, f.text);
      if (f.kind === 'na') {
        node.appendChild(el('details', { class: 'pwbu-more' }, [
          el('summary', { text: 'Show command-line instructions' }),
          el('pre', { text: cli.join('\n') })
        ]));
      } else if (serverDetail(r)) {
        node.appendChild(el('details', { class: 'pwbu-more' }, [
          el('summary', { text: 'Technical details' }),
          el('pre', { text: serverDetail(r) })
        ]));
      }
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
      status(bStatus, 'na', 'Working: Collecting your world data and encrypting the backup. This may take a few seconds.');
      call('/api/worlds/backup', { passphrase: pass, include_vault: bVault.checked })
        .then(function (r) {
          busy(bBtn, false, '⬇ Create encrypted backup');
          bPass.value = ''; /* never linger in the DOM */
          if (r.status !== 200 || !r.data || !r.data.download) {
            showFailure(bStatus, r, [CLI_BACKUP]);
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
            text: ' Save a copy on another device and keep the passphrase somewhere you can recover it.',
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
    var rBtn = el('button', { type: 'button', text: '⬆ Restore missing files' });

    /* Truthful scope of restore, derived from what the restore path
       actually archives/overwrites (worlds_backup.py restore boundary).
       The archive itself cannot be enumerated before the server unlocks
       it, so the preview states the categories — not a per-file count
       that is not provable here. */
    var REPLACE_SCOPE =
      'Restore only ever touches these categories: instance data (world, ' +
      'journal, users, per-person profiles, reminders, apps, proposals, chat ' +
      'history), app and identity configuration, and discovery/reconciler ' +
      'saved state. Nothing outside them changes, and no backup file is ' +
      'edited. Replaced files are not kept and cannot be undone.';
    var RESTORE_HELP =
      'Import a backup archive into this instance. By default it only fills ' +
      'in files that are missing — nothing you already have is touched. ' +
      '"Replace existing files during restore" replaces what you already ' +
      'have in the categories above and always asks you to confirm first.';

    function updateRestoreLabel() {
      rBtn.textContent = rOver.checked
        ? '⬆ Review files to replace'
        : '⬆ Restore missing files';
    }
    rOver.addEventListener('change', updateRestoreLabel);

    /* LANG-042: a real destructive confirmation. Focus starts on
       Cancel, Tab is trapped inside, Escape cancels, and nothing
       animates (prefers-reduced-motion yields). */
    var lastFocus = null;
    var modal = el('div', {
      role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'pwbu-confirm-h', 'aria-describedby': 'pwbu-confirm-desc',
      hidden: 'hidden',
      class: 'pwbu-modal'
    });

    function closeModal() {
      modal.hidden = true;
      if (lastFocus) { lastFocus.focus(); }
    }

    function confirmModal(run) {
      lastFocus = document.activeElement;
      modal.textContent = '';
      modal.appendChild(el('div', { class: 'pwbu-modal-box' }, [
        el('h3', { id: 'pwbu-confirm-h', text: 'Replace existing files?' }),
        el('p', { id: 'pwbu-confirm-desc', text: RESTORE_HELP }),
        el('p', { text: REPLACE_SCOPE }),
        el('p', {
          class: 'pwbu-note',
          text: 'A wrong passphrase changes nothing: the whole archive is checked before any file is written.'
        }),
        el('div', { class: 'row' }, [
          el('button', { type: 'button', id: 'pwbu-confirm-cancel', text: 'Cancel' }),
          el('button', { type: 'button', id: 'pwbu-confirm-go', text: 'Replace existing files and restore' })
        ])
      ]));
      modal.hidden = false;
      document.getElementById('pwbu-confirm-cancel').focus();
      document.getElementById('pwbu-confirm-cancel').addEventListener('click', closeModal);
      document.getElementById('pwbu-confirm-go').addEventListener('click', function () {
        modal.hidden = true;
        run();
        if (lastFocus) { lastFocus.focus(); }
      });
      modal.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); closeModal(); return; }
        if (ev.key !== 'Tab') { return; }
        var focusables = modal.querySelectorAll('button, summary');
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault(); last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault(); first.focus();
        }
      });
    }

    function beginRestore() {
      busy(rBtn, true, '⏳ Verifying and decrypting…');
      status(rStatus, 'na', 'Working: Checking the archive before changing anything. A wrong passphrase will not change your world.');
      (rFile.files && rFile.files[0] ? rFile.files[0].arrayBuffer() : Promise.reject(new Error('no file')))
        .then(function (buf) {
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
          busy(rBtn, false, rOver.checked ? '⬆ Review files to replace' : '⬆ Restore missing files');
          rPass.value = '';
          if (r.status !== 200 || !r.data) {
            showFailure(rStatus, r, [CLI_RESTORE]);
            return;
          }
          var rep = r.data;
          rStatus.className = 'status ok';
          rStatus.textContent = '';
          rStatus.appendChild(el('div', {
            text: 'Restore finished: ' + (rep.restored || []).length + ' restored, ' +
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
    }

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
      if (rOver.checked) { confirmModal(beginRestore); return; }
      beginRestore();
    });

    panel.appendChild(el('h2', { text: 'Restore my world' }));
    panel.appendChild(el('p', { class: 'lede', text: RESTORE_HELP }));
    panel.appendChild(el('label', { for: 'pwbu-restore-file', text: 'Backup archive (.pwbackup)' }));
    panel.appendChild(rFile);
    panel.appendChild(el('label', { for: rPassId, text: 'Archive passphrase' }));
    panel.appendChild(rPass);
    panel.appendChild(el('div', { class: 'check' }, [
      rOver,
      el('label', { for: 'pwbu-overwrite', style: 'margin:0;text-transform:none;letter-spacing:0;font-size:14px', text: 'Replace existing files during restore' })
    ]));
    panel.appendChild(el('p', { class: 'pwbu-note', text: REPLACE_SCOPE }));
    panel.appendChild(el('div', { class: 'row' }, [rBtn]));
    panel.appendChild(rStatus);

    root.textContent = '';
    root.appendChild(style);
    root.appendChild(panel);
    root.appendChild(modal);
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
        text: 'Backup panel failed to load in this browser. Nothing was changed — the command-line path still works.'
      }));
      root.appendChild(el('details', null, [
        el('summary', { text: 'Show command-line instructions' }),
        el('pre', { text: CLI_BACKUP + '\n' + CLI_RESTORE })
      ]));
      if (err && err.message) {
        root.appendChild(el('details', null, [
          el('summary', { text: 'Technical details' }),
          el('pre', { text: err.message })
        ]));
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
