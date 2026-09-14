import { useEffect, useState } from "react";
import {
  saveNativeConfig,
  saveConnection,
  testConnection,
  fetchConnections,
  type ProviderSchemaDef,
  type ConfigFieldDef,
  type ConnectionTestResult,
  type CapabilityOverview,
} from "../lib/api";
import { useConnectionsOverview } from "../lib/hooks";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { Icon, type IconName } from "../lib/icons";

const panelClasses = "rounded-2xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] p-5 flex flex-col gap-4 overflow-hidden";
const mutedClasses = "text-[var(--pw-color-text-muted)]";

const actionButtonClasses = [
  "inline-flex min-h-[var(--pw-target-minimum)] items-center justify-center gap-2",
  "rounded-lg border border-[var(--pw-color-border-subtle)] bg-transparent",
  "px-2.5 text-[11px] text-[var(--pw-color-text-primary)]",
  "hover:border-[var(--pw-color-accent-primary)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const screenButtonClasses = [
  "inline-flex min-h-[var(--pw-target-minimum)] items-center justify-center",
  "rounded-lg bg-[var(--pw-color-accent-primary)] px-3.5 text-[12px] font-medium",
  "text-[var(--pw-color-surface-canvas)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

const textInputClasses = [
  "min-h-[var(--pw-target-minimum)] flex-1 rounded-lg border border-[var(--pw-color-border-subtle)]",
  "bg-[var(--pw-color-surface-elevated)] px-3 text-[11px] text-[var(--pw-color-text-secondary)]",
  "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2",
].join(" ");

function isCanonicalStatus(value: unknown): value is CanonicalStatus {
  return typeof value === "string" && [
    "healthy", "warning", "unknown", "needs_attention",
    "unavailable", "stale", "disabled", "not_configured",
  ].includes(value);
}

// ── Capability card ──────────────────────────────────────────────

function CapabilityCard({
  cap,
  onConfigure,
}: {
  cap: CapabilityOverview;
  onConfigure: () => void;
}) {
  const needsSetup = !cap.configured && cap.needs_setup;
  return (
    <div className={[
      "flex items-center justify-between rounded-xl border px-4 py-3 min-h-[56px]",
      needsSetup
        ? "bg-[var(--pw-color-surface-elevated)] border-[var(--pw-color-border-subtle)]"
        : "bg-[var(--pw-color-surface-elevated)] border-[var(--pw-color-border-subtle)]",
    ].join(" ")}>
      <span className="flex items-center gap-3 min-w-0">
        <Icon name={cap.icon as IconName || "icon-world-content-world"} size={18}
              className="shrink-0 text-[var(--pw-color-text-secondary)]" />
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-semibold text-[var(--pw-color-text-primary)]">
            {cap.display_name}
          </span>
          <span className="text-[10px] text-[var(--pw-color-text-secondary)] truncate">
            {needsSetup ? cap.help_text : cap.description}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {cap.configured ? (
          <StatusChip
            status={isCanonicalStatus(cap.status) ? cap.status : "unknown"}
            size="sm"
          />
        ) : (
          <button
            type="button"
            className={actionButtonClasses}
            onClick={onConfigure}
          >
            Configure
          </button>
        )}
        {cap.configured && (
          <button
            type="button"
            className={actionButtonClasses}
            onClick={onConfigure}
          >
            Configure
          </button>
        )}
      </span>
    </div>
  );
}

// ── Config form (schema-driven) ──────────────────────────────────

function ConfigForm({
  provider,
  initialValues,
  onSave,
  onCancel,
}: {
  provider: ProviderSchemaDef;
  initialValues?: Record<string, string>;
  onSave: (values: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const setField = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const f of provider.config_fields) {
      if (f.required && !values[f.key]?.trim()) {
        errs[f.key] = `${f.label} is required`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(values);
    } catch (err) {
      setErrors({ _form: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)}>
      {provider.config_fields.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={values[field.key] || ""}
          error={errors[field.key]}
          onChange={(v) => setField(field.key, v)}
        />
      ))}
      {errors._form && (
        <p role="alert" className="text-xs text-[var(--pw-color-text-primary)]">{errors._form}</p>
      )}
      <span className="flex items-center gap-2">
        <button type="submit" className={screenButtonClasses} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className={actionButtonClasses} onClick={onCancel}>
          Cancel
        </button>
      </span>
    </form>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: ConfigFieldDef;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const isSecret = field.type === "secret";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-[var(--pw-color-text-primary)]">
        {field.label}
        {field.required && <span className="text-[var(--pw-color-text-primary)]"> *</span>}
      </span>
      {field.description && (
        <span className="text-[10px] text-[var(--pw-color-text-secondary)]">{field.description}</span>
      )}
      {field.type === "select" && field.options ? (
        <select
          className={textInputClasses}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : isSecret && field.secret_ref ? (
        <span className="flex items-center gap-2">
          <input
            className={textInputClasses}
            type="text"
            value={value}
            placeholder={field.placeholder || "Vault secret name"}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="text-[10px] text-[var(--pw-color-accent-primary)] shrink-0">
            Stored in Vault
          </span>
        </span>
      ) : (
        <input
          className={textInputClasses}
          type={isSecret ? "password" : field.type === "url" ? "url" : "text"}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && (
        <span role="alert" className="text-[10px] text-[var(--pw-color-text-primary)]">{error}</span>
      )}
    </label>
  );
}

// ── Test connection result ───────────────────────────────────────

function TestResult({ result }: { result: ConnectionTestResult | null }) {
  if (!result) return null;
  const statusMap: Record<string, { color: string; label: string }> = {
    healthy: { color: "var(--pw-color-accent-primary)", label: "Connected" },
    validated: { color: "var(--pw-color-accent-primary)", label: "Configuration validated" },
    unavailable: { color: "var(--pw-color-text-primary)", label: "Unavailable" },
    invalid_configuration: { color: "var(--pw-color-text-primary)", label: "Invalid configuration" },
    unauthorized: { color: "var(--pw-color-text-primary)", label: "Unauthorized" },
    unknown: { color: "var(--pw-color-text-secondary)", label: "Unknown" },
  };
  const info = statusMap[result.status] || statusMap.unknown;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--pw-color-surface-elevated)] px-3 py-2">
      <span className="size-2 rounded-full" style={{ backgroundColor: info.color }} />
      <span className="text-xs text-[var(--pw-color-text-primary)]">{info.label}</span>
      {result.detail && (
        <span className="text-[10px] text-[var(--pw-color-text-secondary)] truncate">{result.detail}</span>
      )}
    </div>
  );
}

// ── Configure dialog ─────────────────────────────────────────────

function ConfigurePanel({
  cap,
  onClose,
  onSaved,
}: {
  cap: CapabilityOverview;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { withStepUp } = useStepUp();
  const { announce } = useAnnounce();
  const [selectedProvider, setSelectedProvider] = useState<ProviderSchemaDef | null>(
    cap.providers.length === 1 ? cap.providers[0] : null
  );
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Load existing config for this capability
  useEffect(() => {
    fetchConnections().catch(() => {});
  }, []);

  const handleTest = async (values: Record<string, string>) => {
    if (!selectedProvider) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection({
        capability: cap.capability,
        adapter_type: selectedProvider.adapter_type,
        config: values,
      });
      setTestResult(result);
    } catch {
      setTestResult({ status: "unavailable", detail: "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (values: Record<string, string>) => {
    await withStepUp(async () => {
      // For connection-based providers, save as a connection
      if (cap.capability === "reasoning") {
        await saveConnection({
          type: selectedProvider!.adapter_type,
          name: `user-${selectedProvider!.adapter_type}`,
          capability: "reasoning",
          ...values,
        });
      } else {
        // For native providers, save native config
        await saveNativeConfig(cap.capability, {
          ...values,
          _adapter: selectedProvider!.adapter_type,
        });
      }
    });
    announce(`${cap.display_name} configured.`, { kind: "action_completed", key: cap.capability });
    onSaved();
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--pw-color-accent-primary)] bg-[var(--pw-color-surface-panel)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--pw-color-text-primary)]">
          Configure {cap.display_name}
        </h3>
        <button type="button" className={actionButtonClasses} onClick={onClose}>
          Close
        </button>
      </div>

      {/* Provider selector */}
      {cap.providers.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--pw-color-text-primary)]">Provider</span>
          <div className="flex flex-wrap gap-2">
            {cap.providers.map((p: ProviderSchemaDef) => (
              <button
                key={p.id}
                type="button"
                className={[
                  "rounded-lg border px-3 py-2 text-xs",
                  selectedProvider?.id === p.id
                    ? "border-[var(--pw-color-accent-primary)] bg-[var(--pw-color-warmth-teal-tint)] text-[var(--pw-color-text-primary)]"
                    : "border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-elevated)] text-[var(--pw-color-text-secondary)]",
                ].join(" ")}
                onClick={() => { setSelectedProvider(p); setTestResult(null); }}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Config form */}
      {selectedProvider && (
        <>
          <ConfigForm
            provider={selectedProvider}
            onSave={handleSave}
            onCancel={onClose}
          />
          {/* Test button */}
          {selectedProvider.can_test && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={actionButtonClasses}
                disabled={testing}
                onClick={() => {
                  // Get current form values — simplified: read from DOM
                  const form = document.querySelector(`form`) as HTMLFormElement;
                  if (form) {
                    const fd = new FormData(form);
                    const values: Record<string, string> = {};
                    selectedProvider.config_fields.forEach((f) => {
                      values[f.key] = String(fd.get(f.key) || "");
                    });
                    void handleTest(values);
                  }
                }}
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
              <TestResult result={testResult} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────

export function ConnectionsPanel() {
  const overview = useConnectionsOverview();
  const [configuring, setConfiguring] = useState<string | null>(null);
  const emitOverviewRefresh = () => {
    // Trigger a refetch of the overview
    overview.refetch();
  };

  const caps = overview.data ?? [];
  const needsSetup = caps.filter((c) => !c.configured && c.needs_setup);
  const connected = caps.filter((c) => c.configured);
  const readyCount = connected.filter((c) => c.ok || c.status === "healthy").length;
  const setupCount = needsSetup.length;

  const configuringCap = configuring ? caps.find((c) => c.capability === configuring) : null;

  return (
    <section aria-labelledby="connections-heading" data-testid="connections-panel" className={panelClasses}>
      <div className="flex flex-col gap-1.5">
        <h2 id="connections-heading" className="text-[22px]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
          Connections & Providers
        </h2>
        <p className={`text-xs leading-relaxed ${mutedClasses}`}>
          What your world is connected to. Configure capabilities without editing files.
        </p>
      </div>

      {overview.isLoading ? (
        <p className={`text-xs ${mutedClasses}`}>Loading connections…</p>
      ) : overview.isError ? (
        <p role="alert" className="text-sm text-[var(--pw-color-text-primary)]">
          Could not load connections.
        </p>
      ) : (
        <>
          {/* Compact summary */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[var(--pw-color-accent-primary)] font-medium">
              {readyCount} ready
            </span>
            {setupCount > 0 && (
              <span className="text-[var(--pw-color-text-secondary)]">
                {setupCount} need{setupCount === 1 ? "s" : ""} setup
              </span>
            )}
          </div>

          {/* Configure panel (inline) */}
          {configuringCap && (
            <ConfigurePanel
              cap={configuringCap}
              onClose={() => setConfiguring(null)}
              onSaved={emitOverviewRefresh}
            />
          )}

          {/* Needs setup */}
          {needsSetup.length > 0 && !configuring && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[var(--pw-color-text-primary)]">Needs setup</span>
              {needsSetup.map((cap) => (
                <CapabilityCard
                  key={cap.capability}
                  cap={cap}
                  onConfigure={() => setConfiguring(cap.capability)}
                />
              ))}
            </div>
          )}

          {/* Connected */}
          {connected.length > 0 && !configuring && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[var(--pw-color-text-primary)]">Connected</span>
              {connected.map((cap) => (
                <CapabilityCard
                  key={cap.capability}
                  cap={cap}
                  onConfigure={() => setConfiguring(cap.capability)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
