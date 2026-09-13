import { useState } from "react";
import { saveWorldIntent, saveWorldPolicy, ApiError } from "../lib/api";
import { useWorld, useWorldStatus, useReminders, useWorldKey } from "../lib/hooks";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Loader2, AlertCircle, Globe, GitBranch, Calendar,
  FileText, Cloud, Mail, Users, Bell, ChevronRight, Plus, X,
} from "../lib/icons";

const CAPABILITY_ICONS: Record<string, typeof GitBranch> = {
  source_control: GitBranch, calendar: Calendar, notes: FileText,
  weather: Cloud, mail: Mail, contacts: Users, notifications: Bell,
};

const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  source_control: "Your code and changes",
  calendar: "Your schedule and time",
  notes: "Your writing and ideas",
  weather: "The world outside",
  mail: "Your conversations",
  contacts: "Your people",
  notifications: "Things trying to reach you",
};

function WorldScreen() {
  const world = useWorld();
  const worldStatus = useWorldStatus();
  const reminders = useReminders();
  const bumpWorld = useWorldKey();
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [expandedCap, setExpandedCap] = useState<string | null>(null);

  if (world.isLoading || worldStatus.isLoading) {
    return <div className="flex flex-col items-center justify-center gap-4 p-8"><Loader2 className="h-8 w-8 loader-static text-[var(--pw-color-accent-primary)]" aria-hidden={true} /><p className="text-[var(--pw-color-text-muted)]">Loading your world…</p></div>;
  }

  if (world.isError || worldStatus.isError) {
    return <div className="flex flex-col items-center justify-center gap-4 p-8"><AlertCircle className="h-8 w-8 text-[var(--pw-color-text-primary)]" aria-hidden={true} /><p className="text-[var(--pw-color-text-muted)]">Could not load your world.</p></div>;
  }

  const capabilities = worldStatus.data?.capabilities || {};
  const capabilitiesList = Object.entries(capabilities);
  const healthyCount = capabilitiesList.filter(([, c]) => c.ok).length;
  const intents = world.data?.intents || {};
  const policies = world.data?.policies || {};
  const activeReminders = (reminders.data || []).filter((r) => r.enabled);
  const actors = worldStatus.data?.actors || [];

  const refreshAll = () => {
    bumpWorld();
  };

  return (
    <div className="space-y-7">
      {/* World Overview */}
      <section aria-labelledby="world-heading">
        <div className="flex gap-7 items-center">
          <div className="relative shrink-0 size-[150px] flex items-center justify-center">
            <div className="absolute inset-0 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, var(--pw-color-accent-primary) 0%, transparent 70%)" }}
              aria-hidden={true}
            />
            <Globe className="h-20 w-20 text-[var(--pw-color-accent-primary)]" aria-hidden={true} />
          </div>
          <div className="flex-1 min-w-0 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--pw-color-accent-secondary)]">
              Personal World
            </p>
            <h1 id="world-heading" className="text-[40px] leading-[1.05] text-[var(--pw-color-accent-primary)]"
              style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
              Your World
            </h1>
            <p className="text-[15px] leading-relaxed text-[var(--pw-color-text-secondary)]">
              Everything here belongs to you. This is what your world can see.
            </p>
            <p className="text-xs text-[var(--pw-color-accent-secondary)]">
              ✦ keeping watch over all of this
            </p>
          </div>
        </div>

        {/* World facts bar */}
        <div className="mt-5 flex items-center justify-between h-20 px-6 rounded-2xl border border-[var(--pw-color-border-strong)] bg-[var(--pw-color-surface-elevated)]">
          <div className="flex items-center gap-2.5">
            <Globe className="h-[18px] w-[18px] text-[var(--pw-color-accent-primary)]" aria-hidden={true} />
            <span className="text-[13px] text-[var(--pw-color-text-primary)]">Timezone: Portland, Oregon</span>
          </div>
          <div className="h-7 w-px bg-[var(--pw-color-border-strong)]" aria-hidden={true} />
          <div className="flex items-center gap-2.5">
            <span className="text-base text-[var(--pw-color-accent-secondary)]" aria-hidden={true}>✦</span>
            <span className="text-[13px] text-[var(--pw-color-text-primary)]">{capabilitiesList.length} capabilities connected</span>
          </div>
          <div className="h-7 w-px bg-[var(--pw-color-border-strong)]" aria-hidden={true} />
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-[var(--pw-color-accent-secondary)]" aria-hidden={true} />
            <span className="text-[13px] text-[var(--pw-color-text-primary)]">{healthyCount} healthy</span>
          </div>
        </div>
      </section>

      {/* World Senses — Capabilities as senses */}
      <section aria-labelledby="senses-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="senses-heading" className="text-[22px] text-[var(--pw-color-text-primary)]"
            style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
            What your world can see
          </h2>
          <span className="text-xs text-[var(--pw-color-text-secondary)]">what it can perceive</span>
        </div>
        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {capabilitiesList.map(([name, cap]) => {
            const Icon = CAPABILITY_ICONS[name] || Globe;
            const isHealthy = cap.ok;
            const isConfigured = cap.status !== "not_configured";
            const isExpanded = expandedCap === name;
            const displayName = name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
            const description = CAPABILITY_DESCRIPTIONS[name] || "";

            return (
              <div key={name}>
                <button
                  onClick={() => setExpandedCap(isExpanded ? null : name)}
                  className={`w-full text-left flex gap-3 items-center p-3.5 rounded-2xl border transition-all min-h-[44px] ${
                    isConfigured
                      ? "bg-[var(--pw-color-surface-elevated)] border-[var(--pw-color-border-strong)]"
                      : "bg-[var(--pw-color-surface-panel)] border-[var(--pw-color-border-subtle)] opacity-60"
                  } ${isExpanded ? "ring-1 ring-[var(--pw-color-accent-primary)]" : ""}`}
                >
                  <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-[10px] ${
                    isConfigured
                      ? "bg-[var(--pw-color-warmth-teal-wash)]"
                      : "bg-[var(--pw-color-warmth-teal-reassure)]"
                  }`}>
                    <Icon className={`h-[21px] w-[21px] ${isConfigured ? "text-[var(--pw-color-accent-primary)]" : "text-[var(--pw-color-text-muted)]"}`} aria-hidden={true} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-[13px] font-semibold truncate ${isConfigured ? "text-[var(--pw-color-text-primary)]" : "text-[var(--pw-color-text-secondary)]"}`}>
                        {displayName}
                      </h3>
                      {isHealthy && <span className="text-[11px] text-[var(--pw-color-accent-primary)]" aria-hidden={true}>✦</span>}
                    </div>
                    <p className="text-[11px] text-[var(--pw-color-text-secondary)] truncate">{description}</p>
                    <p className={`text-[10px] ${isHealthy ? "text-[var(--pw-color-accent-primary)]" : "text-[var(--pw-color-text-muted)]"}`}>
                      {cap.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-[var(--pw-color-text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden={true} />
                </button>
                {isExpanded && (
                  <div className="mt-1 p-4 rounded-2xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)]">
                    <dl className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><dt className="text-[var(--pw-color-text-muted)]">Status</dt><dd className="text-[var(--pw-color-text-primary)]">{cap.status.replace(/_/g, " ")}</dd></div>
                      <div className="flex justify-between"><dt className="text-[var(--pw-color-text-muted)]">Healthy</dt><dd className="text-[var(--pw-color-text-primary)]">{cap.ok ? "Yes" : "No"}</dd></div>
                      {cap.last_observed && <div className="flex justify-between"><dt className="text-[var(--pw-color-text-muted)]">Last seen</dt><dd className="text-[var(--pw-color-text-primary)]">{new Date(cap.last_observed).toLocaleString()}</dd></div>}
                      {(cap.warnings || []).length > 0 && <div><dt className="text-[var(--pw-color-text-muted)]">Warnings</dt><dd className="mt-0.5 text-[var(--pw-color-text-primary)]">{cap.warnings.join(", ")}</dd></div>}
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Intent and Policies */}
      <section aria-labelledby="intent-policy-heading">
        <h2 id="intent-policy-heading" className="sr-only">Intent and Policies</h2>
        <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2">
          {/* Intent card */}
          <div className="bg-[var(--pw-color-surface-panel)] border border-[var(--pw-color-border-strong)] rounded-2xl p-4 space-y-2.5">
            <p className="text-[11px] text-[var(--pw-color-text-secondary)]">What you&apos;re focused on</p>
            {Object.keys(intents).length === 0 ? (
              <p className="text-xs text-[var(--pw-color-text-muted)]">No active intents.</p>
            ) : (
              <ul className="space-y-2" role="list">
                {Object.entries(intents).map(([key, intent]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--pw-color-accent-primary)]" aria-hidden={true} />
                    <span className="text-[13px] font-semibold text-[var(--pw-color-text-primary)]">{intent.value}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="healthy" className="text-[11px] px-2.5 py-1.5 rounded-full">focus</Badge>
              <button onClick={() => setShowIntentModal(true)} className="flex items-center gap-1 text-[11px] text-[var(--pw-color-accent-primary)] hover:underline min-h-[44px]">
                <Plus className="h-3 w-3" aria-hidden={true} />Add
              </button>
            </div>
          </div>

          {/* Policy card */}
          <div className="bg-[var(--pw-color-surface-panel)] border border-[var(--pw-color-border-strong)] rounded-2xl p-4 space-y-2.5">
            <p className="text-[11px] text-[var(--pw-color-text-secondary)]">Rules you&apos;ve set</p>
            {Object.keys(policies).length === 0 ? (
              <p className="text-xs text-[var(--pw-color-text-muted)]">No policies.</p>
            ) : (
              <ul className="space-y-2" role="list">
                {Object.entries(policies).map(([key, policy]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--pw-color-accent-secondary)]" aria-hidden={true} />
                    <span className="text-[13px] font-semibold text-[var(--pw-color-text-primary)]">{String(policy)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="warning" className="text-[11px] px-2.5 py-1.5 rounded-full">privacy</Badge>
              <button onClick={() => setShowPolicyModal(true)} className="flex items-center gap-1 text-[11px] text-[var(--pw-color-accent-primary)] hover:underline min-h-[44px]">
                <Plus className="h-3 w-3" aria-hidden={true} />Add
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Reminders */}
      <section aria-labelledby="reminders-heading">
        <h2 id="reminders-heading" className="sr-only">Reminders</h2>
        <div className="bg-[var(--pw-color-surface-elevated)] border border-[var(--pw-color-border-strong)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--pw-color-accent-primary)]" aria-hidden={true} />
              <span className="text-[13px] font-semibold text-[var(--pw-color-text-primary)]">Reminders</span>
            </div>
            <Badge variant="default" className="text-[11px]">{activeReminders.length} active</Badge>
          </div>
          {activeReminders.length === 0 ? (
            <p className="text-xs text-[var(--pw-color-text-muted)]">No active reminders.</p>
          ) : (
            <ul className="space-y-2" role="list">
              {activeReminders.slice(0, 4).map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--pw-color-text-secondary)] truncate">{r.text}</span>
                  <Badge variant="healthy" className="shrink-0 ml-2">Active</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Who's here */}
      {actors.length > 0 && (
        <section aria-labelledby="inhabitants-heading">
          <div className="bg-[var(--pw-color-surface-panel)] border border-[var(--pw-color-vault-store-border)] rounded-3xl p-5 space-y-4">
            <div className="space-y-1.5">
              <h2 id="inhabitants-heading" className="text-[22px] text-[var(--pw-color-text-primary)]"
                style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>
                Who&apos;s here
              </h2>
              <p className="text-[11px] text-[var(--pw-color-accent-secondary)]">
                A field guide to inhabitants &amp; visitors
              </p>
            </div>
            <ul className="space-y-2" role="list">
              {actors.map((actor) => (
                <li key={actor.name} className="flex items-center gap-3 py-2.5 border-b border-[var(--pw-color-border-strong)] last:border-b-0">
                  <div className="shrink-0 flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[var(--pw-color-warmth-rose-wash-soft)]">
                    <Users className="h-4 w-4 text-[var(--pw-color-accent-secondary)]" aria-hidden={true} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-[var(--pw-color-text-primary)] truncate">{actor.name}</p>
                    <p className="text-[10px] text-[var(--pw-color-text-secondary)] truncate">{actor.role}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="italic text-[10px] text-[var(--pw-color-text-muted)]">
              Visitors leave a little history behind.
            </p>
          </div>
        </section>
      )}

      {/* Add Intent Modal */}
      {showIntentModal && <AddIntentModal onClose={() => setShowIntentModal(false)} onSaved={refreshAll} />}
      {/* Add Policy Modal */}
      {showPolicyModal && <AddPolicyModal onClose={() => setShowPolicyModal(false)} onSaved={refreshAll} />}
    </div>
  );
}

function AddIntentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveWorldIntent(key.trim(), value.trim());
      setSuccess(true);
      setTimeout(() => { onSaved(); }, 1500);
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "Failed to save.");
    } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pw-color-surface-canvas)]/60 p-4">
      <div className="w-full max-w-xl rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Add Intent</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-4 pt-0 space-y-3">
            <div><label className="mb-1 block text-xs text-[var(--pw-color-text-muted)]">Key</label><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. focus" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" /></div>
            <div><label className="mb-1 block text-xs text-[var(--pw-color-text-muted)]">Value</label><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Build frontend v2" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" /></div>
            {error && <p className="text-xs text-[var(--pw-color-text-primary)]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-4 pt-0"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!key.trim() || !value.trim() || isSaving || success}>{isSaving ? <Loader2 className="h-4 w-4 loader-static" /> : success ? "✓ Saved" : "Save"}</Button></div>
        </form>
      </div>
    </div>
  );
}

function AddPolicyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [effect, setEffect] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !effect.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveWorldPolicy(key.trim(), effect.trim());
      setSuccess(true);
      setTimeout(() => { onSaved(); }, 1500);
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "Failed to save.");
    } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pw-color-surface-canvas)]/60 p-4">
      <div className="w-full max-w-xl rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Add Policy</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-4 pt-0 space-y-3">
            <div><label className="mb-1 block text-xs text-[var(--pw-color-text-muted)]">Key</label><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. privacy" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" /></div>
            <div><label className="mb-1 block text-xs text-[var(--pw-color-text-muted)]">Effect</label><input value={effect} onChange={(e) => setEffect(e.target.value)} placeholder="e.g. minimum-necessary" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" /></div>
            {error && <p className="text-xs text-[var(--pw-color-text-primary)]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 p-4 pt-0"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!key.trim() || !effect.trim() || isSaving || success}>{isSaving ? <Loader2 className="h-4 w-4 loader-static" /> : success ? "✓ Saved" : "Save"}</Button></div>
        </form>
      </div>
    </div>
  );
}

export default WorldScreen;
