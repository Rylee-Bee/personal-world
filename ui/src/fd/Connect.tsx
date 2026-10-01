import { useEffect, useId, useRef, useState } from "react";
import { sampleBindings, sampleSecrets } from "./fixtures";
import { Tabs, type TabDef } from "./Tabs";
import "./fd.css";

/** One binding as the sample fixtures describe it (read is name + word only). */
type Binding = (typeof sampleBindings)[number];

/** UNKNOWN is never shown bare: it always says the result was not confirmed. */
function outcomeText(outcome: string): string {
  return outcome === "UNKNOWN" ? "UNKNOWN: the result was not confirmed" : outcome;
}

/**
 * A confirmation dialog for a write binding: focus moves in, Escape cancels,
 * and the receipt only lands once Confirm is pressed. There is no value to
 * show, so the dialog holds the question and the two actions only.
 */
function RunDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fd-dialog"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        } else if (event.key === "Tab") {
          // Trap focus: Tab and Shift+Tab cycle inside the dialog.
          const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("button, [href], input, [tabindex]:not([tabindex='-1'])") ?? []);
          if (items.length === 0) return;
          const first = items[0];
          const last = items[items.length - 1];
          const at = document.activeElement;
          if (event.shiftKey && (at === first || at === ref.current)) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && at === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <h2 id={titleId} className="fd-dialog-title">
        Run {name}?
      </h2>
      <p className="fd-dialog-sample">Sample, nothing was sent.</p>
      <div className="fd-dialog-actions">
        <button type="button" className="fd-btn" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className="fd-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Actions: every binding in sample order. A read binding is its name and the
 * word "Read"; a write binding asks first and then reports the outcome.
 */
function ActionsPanel() {
  const [running, setRunning] = useState<Binding | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const runRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const cancel = () => {
    const id = running?.id;
    setRunning(null);
    if (id) runRefs.current[id]?.focus();
  };

  const confirm = () => {
    if (!running || running.access !== "write") return;
    const id = running.id;
    setReceipt(`${running.name}: ${outcomeText(running.outcome)}. Sample, nothing was sent.`);
    setRunning(null);
    runRefs.current[id]?.focus();
  };

  return (
    <div className="fd-actions">
      <p className="fd-sample">Sample data</p>
      <ul className="fd-bindings">
        {sampleBindings.map((binding) => (
          <li key={binding.id} className="fd-binding">
            <span className="fd-binding-name">{binding.name}</span>
            {binding.access === "read" ? (
              <span className="fd-binding-access">Read</span>
            ) : (
              <button
                type="button"
                ref={(el) => {
                  runRefs.current[binding.id] = el;
                }}
                className="fd-btn"
                aria-label={`Run: ${binding.name}`}
                onClick={() => setRunning(binding)}
              >
                Run
              </button>
            )}
          </li>
        ))}
      </ul>
      {receipt && (
        <p role="status" className="fd-receipt">
          {receipt}
        </p>
      )}
      {running && running.access === "write" && (
        <RunDialog name={running.name} onConfirm={confirm} onCancel={cancel} />
      )}
    </div>
  );
}

/** Advanced: secret names and whether each is set. Values are never shown. */
function SecretRow({ name, isSet }: { name: string; isSet: boolean }) {
  const [editing, setEditing] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    if (inputRef.current) inputRef.current.value = "";
    setEditing(false);
  };

  return (
    <div className="fd-secret-row">
      <span className="fd-secret-name">{name}</span>
      <span className="fd-secret-state">{isSet ? "Set" : "Not set"}</span>
      {editing ? (
        <div className="fd-secret-form">
          <label htmlFor={inputId} className="fd-label">
            New value for {name}
          </label>
          <input id={inputId} ref={inputRef} type="password" autoComplete="off" className="fd-input" />
          <div className="fd-secret-actions">
            <button type="button" className="fd-btn" onClick={save}>
              Save
            </button>
            <button type="button" className="fd-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="fd-btn" onClick={() => setEditing(true)}>
          Replace {name}
        </button>
      )}
    </div>
  );
}

function AdvancedPanel() {
  return (
    <div className="fd-advanced">
      {sampleSecrets.map((secret) => (
        <SecretRow key={secret.name} name={secret.name} isSet={secret.set} />
      ))}
    </div>
  );
}

const ARRIVES = "Saved requests will run here.";

/** Connect: the five front-door tabs. Only Actions and Advanced have content yet. */
export function Connect() {
  const tabs: TabDef[] = [
    { id: "requests", label: "Requests", panel: <p className="fd-sentence">{ARRIVES}</p> },
    { id: "providers", label: "Providers", panel: <p className="fd-sentence">{ARRIVES}</p> },
    { id: "recipes", label: "Recipes", panel: <p className="fd-sentence">{ARRIVES}</p> },
    { id: "actions", label: "Actions", panel: <ActionsPanel /> },
    { id: "advanced", label: "Advanced", panel: <AdvancedPanel /> },
  ];

  return (
    <div className="fd-screen">
      <h1 className="fd-screen-title">Connect</h1>
      <Tabs label="Connect" tabs={tabs} />
    </div>
  );
}
