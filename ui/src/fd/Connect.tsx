import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { sampleBindings, sampleSecrets } from "./fixtures";
import { Tabs, type TabDef } from "./Tabs";
import "./fd.css";

/** One binding as the sample fixtures describe it (read is name + word only). */
type Binding = (typeof sampleBindings)[number];

/** One plain word per outcome. UNKNOWN is never shown bare: it always says the result was not confirmed. */
function outcomeText(outcome: string): string {
  if (outcome === "UNKNOWN") return "Unknown: the result was not confirmed";
  return outcome.charAt(0) + outcome.slice(1).toLowerCase();
}

type WriteBinding = Extract<Binding, { access: "write" }>;

/**
 * A native modal dialog for a write binding: the browser makes the page behind it inert, traps focus and
 * returns it on close. The safe choice comes first and has initial focus. The buttons are named for the act.
 */
function RunDialog({ binding, onConfirm, onCancel }: { binding: WriteBinding; onConfirm: () => void; onCancel: () => void }) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  // Layout effects, so the dialog is closed (and focus handed back) before React removes it.
  useLayoutEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="fd-dialog"
      onCancel={(event) => {
        // Escape: the safe choice.
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId} className="fd-dialog-title">
        {binding.act}?
      </h2>
      <p className="fd-dialog-consequence">{binding.consequence}</p>
      <p className="fd-dialog-sample">Sample, nothing was sent.</p>
      <div className="fd-dialog-actions">
        <button type="button" className="fd-btn fd-btn--primary" autoFocus onClick={onCancel}>
          {binding.safe}
        </button>
        <button type="button" className="fd-btn" onClick={onConfirm}>
          {binding.act}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Actions: every binding in sample order. A read binding is its name and the
 * word "Read"; a write binding asks first and then reports the outcome.
 */
function ActionsPanel() {
  const [running, setRunning] = useState<WriteBinding | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const runRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Focus goes back to the Run button once the dialog has closed (a modal's page is inert until then).
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    if (running === null && refocus.current) {
      runRefs.current[refocus.current]?.focus();
      refocus.current = null;
    }
  }, [running]);

  const cancel = () => {
    refocus.current = running?.id ?? null;
    setRunning(null);
  };

  const confirm = () => {
    if (!running) return;
    refocus.current = running.id;
    setReceipt(`${running.name}: ${outcomeText(running.outcome)}. Sample, nothing was sent.`);
    setRunning(null);
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
      <p role="status" className="fd-receipt">
        {receipt ?? ""}
      </p>
      {running && <RunDialog binding={running} onConfirm={confirm} onCancel={cancel} />}
    </div>
  );
}

/** Advanced: secret names and whether each is set. Values are never shown. */
function SecretRow({ name, isSet }: { name: string; isSet: boolean }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);
  const backToReplace = useRef(false);

  // Replace puts focus in the field; Save and Cancel put it back on Replace.
  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (backToReplace.current) {
      backToReplace.current = false;
      replaceRef.current?.focus();
    }
  }, [editing]);

  const close = (didSave: boolean) => {
    if (inputRef.current) inputRef.current.value = "";
    backToReplace.current = true;
    setSaved(didSave);
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
            <button type="button" className="fd-btn" onClick={() => close(true)}>
              Save
            </button>
            <button type="button" className="fd-btn" onClick={() => close(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" ref={replaceRef} className="fd-btn" onClick={() => { setSaved(false); setEditing(true); }}>
          Replace {name}
        </button>
      )}
      <p role="status" className="fd-secret-saved">
        {saved ? "Saved" : ""}
      </p>
    </div>
  );
}

function AdvancedPanel() {
  return (
    <div className="fd-advanced">
      <p className="fd-sample">Sample data. Nothing is stored.</p>
      {sampleSecrets.map((secret) => (
        <SecretRow key={secret.name} name={secret.name} isSet={secret.set} />
      ))}
    </div>
  );
}


/** Connect: the five front-door tabs. Only Actions and Advanced have content yet. */
export function Connect() {
  const tabs: TabDef[] = [
    { id: "requests", label: "Requests", panel: <p className="fd-sentence">No saved requests yet. They will run here once Connect is wired up.</p> },
    { id: "providers", label: "Providers", panel: <p className="fd-sentence">No providers yet. A provider is a service Worlds can read.</p> },
    { id: "recipes", label: "Recipes", panel: <p className="fd-sentence">No recipes installed yet. A recipe sets up one service in a single step.</p> },
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
