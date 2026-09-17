/* Project Worlds — first-run setup wizard (dependency-free).
   Plain ES2017+, progressive enhancement over the static HTML:
   every step is a real <section> with a heading; navigation moves
   focus to the heading and announces through the live region. */
(function () {
  "use strict";

  var STEPS = [
    { id: "step-welcome", label: "Welcome" },
    { id: "step-preparing", label: "Getting things ready" },
    { id: "step-auth", label: "Sign-in" },
    { id: "step-comfort", label: "Comfort" },
    { id: "step-finish", label: "Finish" }
  ];
  var current = 0;
  var provisioned = false;
  var provisioning = false;

  function $(id) { return document.getElementById(id); }

  function showStep(index) {
    current = index;
    STEPS.forEach(function (step, i) {
      var el = $(step.id);
      if (el) { el.hidden = i !== index; }
    });
    var stepInfo = STEPS[index];
    $("progress").textContent =
      "Step " + (index + 1) + " of " + STEPS.length + ": " + stepInfo.label;
    $("live").textContent = stepInfo.label + ", step " + (index + 1) +
      " of " + STEPS.length;
    var heading = document.querySelector("#" + stepInfo.id + " h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (resp) {
      return resp.json().catch(function () { return {}; }).then(function (data) {
        return { status: resp.status, data: data };
      });
    });
  }

  function joinWarnings(data) {
    var w = (data && data.warnings) || [];
    var detail = (data && data.detail) || "";
    if (detail && w.indexOf(detail) === -1) { w = [detail].concat(w); }
    return w;
  }

  /* ── Step 2: invisible provisioning ── */

  function runProvision() {
    if (provisioning || provisioned) { return; }
    provisioning = true;
    $("prepare-error").hidden = true;
    $("prepare-status").hidden = false;
    postJSON("/api/setup-wizard/provision", {}).then(function (r) {
      provisioning = false;
      if (r.status === 404) {
        // Setup finished elsewhere (or FORCE_SETUP was turned off):
        // honest redirect instead of a dead end.
        window.location.href = "/";
        return;
      }
      if (r.status === 200 && r.data && r.data.ok) {
        provisioned = true;
        $("prepare-status").hidden = true;
        showStep(2);
        return;
      }
      var lines = joinWarnings(r.data);
      $("prepare-status").hidden = true;
      $("prepare-error").hidden = false;
      $("prepare-error-detail").textContent = lines.length
        ? lines.join(" ")
        : "The app could not finish preparing itself. Press Retry; if it " +
          "keeps failing, check that the server's data folder is " +
          "writable, then reload this page.";
    }).catch(function () {
      provisioning = false;
      $("prepare-status").hidden = true;
      $("prepare-error").hidden = false;
      $("prepare-error-detail").textContent =
        "This page could not talk to the server (network problem or the " +
        "server restarted). Press Retry, or reload the page.";
    });
  }

  /* ── Step 3: auth choice ── */

  function selectedAuth() {
    var radios = document.getElementsByName("auth-choice");
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) { return radios[i].value; }
    }
    return "local";
  }

  function syncAuthFields() {
    $("oidc-fields").hidden = selectedAuth() !== "oidc";
    if ($("oidc-fields").hidden) {
      $("oidc-test-result").hidden = true;
    }
  }

  function showAuthWarnings(warnings) {
    var box = $("auth-warnings");
    var list = $("auth-warnings-list");
    list.textContent = "";
    if (!warnings || !warnings.length) {
      box.hidden = true;
      return;
    }
    warnings.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
    box.hidden = false;
  }

  function runTestConnection() {
    var issuer = $("oidc-issuer").value;
    var box = $("oidc-test-result");
    var button = $("btn-test-oidc");
    box.hidden = false;
    box.className = "test-result testing";
    box.textContent = "";
    var p = document.createElement("p");
    p.className = "verdict";
    p.textContent = "Testing… contacting the sign-in server.";
    box.appendChild(p);
    button.disabled = true;
    postJSON("/api/setup-wizard/test-oidc", { issuer_url: issuer })
      .then(function (r) {
        button.disabled = false;
        var data = (r.data && r.data.data) || {};
        var status = data.status || "unreachable";
        box.className = "test-result " + status;
        box.textContent = "";
        var verdict = document.createElement("p");
        verdict.className = "verdict";
        var labels = {
          reachable: "✓ Success",
          unreachable: "✗ Could not reach it",
          bad_config: "✗ That does not look right"
        };
        verdict.textContent = labels[status] || "✗ Test failed";
        var detail = document.createElement("p");
        detail.textContent = data.detail ||
          "The test did not return a result. Check the address and try again.";
        box.appendChild(verdict);
        box.appendChild(detail);
        $("live").textContent = verdict.textContent + ". " + detail.textContent;
      })
      .catch(function () {
        button.disabled = false;
        box.className = "test-result unreachable";
        box.textContent = "";
        var verdict = document.createElement("p");
        verdict.className = "verdict";
        verdict.textContent = "✗ Test could not run";
        var detail = document.createElement("p");
        detail.textContent =
          "This page could not talk to the Project Worlds server. " +
          "Reload the page and try again.";
        box.appendChild(verdict);
        box.appendChild(detail);
      });
  }

  function submitAuthChoice() {
    var body = { choice: selectedAuth() };
    if (body.choice === "oidc") {
      body.issuer_url = $("oidc-issuer").value;
      body.client_id = $("oidc-client-id").value;
      body.client_secret_env = $("oidc-secret-env").value;
    }
    $("btn-auth-next").disabled = true;
    postJSON("/api/setup-wizard/auth-choice", body).then(function (r) {
      $("btn-auth-next").disabled = false;
      if (r.status === 200 && r.data && r.data.ok) {
        showAuthWarnings(r.data.warnings);
        if (r.data.warnings && r.data.warnings.length) {
          // Surface the honest notes, but keep moving: none of them
          // block setup (e.g. the secret env var can be set later).
          $("live").textContent = "Saved. Notes: " + r.data.warnings.join(" ");
        }
        showStep(3);
        return;
      }
      if (r.status === 404) { window.location.href = "/"; return; }
      var lines = joinWarnings(r.data);
      showAuthWarnings(lines.length ? lines : [
        "Your choice could not be saved. Check the fields and try again."
      ]);
    }).catch(function () {
      $("btn-auth-next").disabled = false;
      showAuthWarnings([
        "This page could not talk to the server. Try again in a moment."
      ]);
    });
  }

  /* ── Step 4: comfort ── */

  function submitComfort() {
    $("btn-comfort-next").disabled = true;
    postJSON("/api/setup-wizard/comfort", {
      larger_text: $("comfort-larger-text").checked,
      gentle_animations: $("comfort-gentle-motion").checked
    }).then(function (r) {
      $("btn-comfort-next").disabled = false;
      if (r.status === 200 && r.data && r.data.ok) {
        updateSummary();
        showStep(4);
        return;
      }
      if (r.status === 404) { window.location.href = "/"; return; }
      var lines = joinWarnings(r.data);
      window.alert(lines.join("\n") ||
        "Comfort settings could not be saved. Try again.");
    }).catch(function () {
      $("btn-comfort-next").disabled = false;
      window.alert("This page could not talk to the server. Try again.");
    });
  }

  function updateSummary() {
    $("summary-auth").textContent = selectedAuth() === "oidc"
      ? "My own SSO (" + ($("oidc-issuer").value || "sign-in server") + ")"
      : "Just me on this device";
    $("summary-text").textContent =
      $("comfort-larger-text").checked ? "Larger" : "Normal";
    $("summary-motion").textContent =
      $("comfort-gentle-motion").checked
        ? "Gentle animation"
        : "Calm (no animation)";
  }

  /* ── Step 5: finish ── */

  function runFinish() {
    $("finish-actions").hidden = true;
    $("finish-error").hidden = true;
    $("finish-status").hidden = false;
    postJSON("/api/setup-wizard/finish", {}).then(function (r) {
      if (r.status === 200 && r.data && r.data.ok) {
        $("finish-status").textContent =
          "✓ Setup complete. Opening your world…";
        var target = (r.data.data && r.data.data.redirect) || "/";
        window.location.href = target;
        return;
      }
      $("finish-status").hidden = true;
      $("finish-actions").hidden = false;
      $("finish-error").hidden = false;
      var lines = joinWarnings(r.data);
      $("finish-error-detail").textContent = lines.join(" ") ||
        "The server could not complete setup. Press 'Try again'; if it " +
        "keeps failing, restart the container and reopen this page.";
    }).catch(function () {
      $("finish-status").hidden = true;
      $("finish-actions").hidden = false;
      $("finish-error").hidden = false;
      $("finish-error-detail").textContent =
        "This page could not talk to the server. Press 'Try again'.";
    });
  }

  /* ── wiring ── */

  function init() {
    $("btn-start").addEventListener("click", function () {
      showStep(1);
      runProvision();
    });
    $("btn-retry-prepare").addEventListener("click", runProvision);

    var radios = document.getElementsByName("auth-choice");
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener("change", syncAuthFields);
    }
    syncAuthFields();
    $("btn-test-oidc").addEventListener("click", runTestConnection);
    $("btn-auth-back").addEventListener("click", function () { showStep(0); });
    $("btn-auth-next").addEventListener("click", submitAuthChoice);

    $("btn-comfort-back").addEventListener("click", function () { showStep(2); });
    $("btn-comfort-next").addEventListener("click", submitComfort);

    $("btn-finish-back").addEventListener("click", function () { showStep(3); });
    $("btn-finish").addEventListener("click", runFinish);
    $("btn-retry-finish").addEventListener("click", runFinish);

    // Restore progress after a refresh: ask the server what already
    // happened and resume at the right step.
    fetch("/api/setup-wizard/state").then(function (r) {
      if (r.status === 404) { window.location.href = "/"; return null; }
      return r.json();
    }).then(function (body) {
      if (!body || !body.data) { return; }
      var choices = body.data.choices || {};
      if (choices.auth_choice === "oidc" && choices.oidc) {
        $("auth-oidc").checked = true;
        $("oidc-issuer").value = choices.oidc.issuer || "";
        $("oidc-client-id").value = choices.oidc.client_id || "";
        $("oidc-secret-env").value = choices.oidc.client_secret_env || "";
        syncAuthFields();
      } else if (choices.auth_choice === "local") {
        $("auth-local").checked = true;
      }
      if (choices.comfort) {
        $("comfort-larger-text").checked = !!choices.comfort.larger_text;
        $("comfort-gentle-motion").checked = !!choices.comfort.gentle_animations;
      }
    }).catch(function () { /* stay on step 1; honest default */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
