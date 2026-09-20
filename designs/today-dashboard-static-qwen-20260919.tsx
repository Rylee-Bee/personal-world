/*
  Project Worlds — Today Dashboard
  ------------------------------------------------------------------
  Tailwind (reference only — not executed):
    <script src="https://cdn.tailwindcss.com"></script>
  React Aria (reference only — this component is intentionally hook-free
  per spec, so accessibility is carried by native semantics + ARIA):
    // import { useButton } from 'react-aria';
    // import { Button, Link } from 'react-aria-components';
  ------------------------------------------------------------------
*/

import * as React from 'react';

type MWStatus = 'healthy' | 'waiting' | 'unavailable' | 'neutral';

interface MWCapability {
  id: string;
  name: string;
  codename: string;
  icon: 'branch' | 'key' | 'radar' | 'rocket';
  status: Exclude<MWStatus, 'neutral'>;
  summary: string;
  metricLabel: string;
  metricValue: number;
  checks: string[];
  stats: { label: string; value: string }[];
}

interface MWPriorities {
  id: string;
  rank: string;
  title: string;
  source: string;
  status: Exclude<MWStatus, 'neutral'>;
  clock: string;
  impact: string;
  notes: string[];
  actions: { label: string; href: string }[];
}

interface MWEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  ago: string;
  tone: MWStatus;
}

interface MWAlert {
  id: string;
  severity: 'critical' | 'watch' | 'info';
  title: string;
  source: string;
  ago: string;
  detail: string;
  steps: string[];
}

interface MWVital {
  label: string;
  value: string;
  bar: number;
  tone: MWStatus;
}

interface TodayDashboardProps {
  name?: string;
  salutation?: string;
  dateLabel?: string;
  sessionLabel?: string;
  worldsAwake?: number;
  worldsTotal?: number;
  pendingYou?: number;
  capabilities?: MWCapability[];
  priorities?: MWPriorities[];
  activity?: MWEvent[];
  alerts?: MWAlert[];
  vitals?: MWVital[];
  companion?: { name: string; state: string; line: string };
  footerRole?: string;
  buildLabel?: string;
}

const TONE: Record<MWStatus, { hex: string; chip: string; text: string; label: string }> = {
  healthy: { hex: '#72b1b1', chip: 'bg-[#72b1b1]/10 text-[#72b1b1] ring-1 ring-inset ring-[#72b1b1]/30', text: 'text-[#72b1b1]', label: 'Healthy' },
  waiting: { hex: '#e4c58d', chip: 'bg-[#e4c58d]/10 text-[#e4c58d] ring-1 ring-inset ring-[#e4c58d]/30', text: 'text-[#e4c58d]', label: 'Waiting' },
  unavailable: { hex: '#b57f8b', chip: 'bg-[#b57f8b]/10 text-[#b57f8b] ring-1 ring-inset ring-[#b57f8b]/30', text: 'text-[#b57f8b]', label: 'Unavailable' },
  neutral: { hex: '#a397b8', chip: 'bg-[#a397b8]/10 text-[#a397b8] ring-1 ring-inset ring-[#a397b8]/25', text: 'text-[#a397b8]', label: 'Idle' },
};

const DEFAULT_CAPABILITIES: MWCapability[] = [
  {
    id: 'git-bridge', name: 'Source Control', codename: 'git-bridge', icon: 'branch', status: 'healthy',
    summary: 'Twelve repositories in sync. Last merge landed without conflict.',
    metricLabel: 'sync integrity', metricValue: 98,
    checks: ['hooks: pre-receive · signed', 'branch protection: 12/12', 'mirror lag: 0.4s'],
    stats: [{ label: 'latency', value: '38ms' }, { label: 'queue', value: '0' }, { label: 'uptime', value: '99.98%' }],
  },
  {
    id: 'sso-orb', name: 'Identity Provider', codename: 'sso-orb', icon: 'key', status: 'waiting',
    summary: 'Three realm escalations parked in the approval lane, waiting on you.',
    metricLabel: 'lane clearance', metricValue: 64,
    checks: ['tokens: rotating in 6h', 'realms: deep-shelf, tidepool', 'policy: two-signer required'],
    stats: [{ label: 'latency', value: '210ms' }, { label: 'queue', value: '3' }, { label: 'uptime', value: '99.41%' }],
  },
  {
    id: 'currents', name: 'Discovery Feed', codename: 'currents', icon: 'radar', status: 'healthy',
    summary: 'Twenty-seven new signals indexed across six worlds in the last hour.',
    metricLabel: 'index depth', metricValue: 91,
    checks: ['crawlers: 6 active', 'dedupe: 0.93 precision', 'schema: v4 (migrated)'],
    stats: [{ label: 'latency', value: '74ms' }, { label: 'signals', value: '27' }, { label: 'uptime', value: '99.87%' }],
  },
  {
    id: 'forge', name: 'Deployment Pipeline', codename: 'forge', icon: 'rocket', status: 'unavailable',
    summary: 'Canary certificate expired. Forge is holding every release channel.',
    metricLabel: 'release flow', metricValue: 12,
    checks: ['cert: EXPIRED 02:14', 'releases held: 2', 'rollback: armed'],
    stats: [{ label: 'latency', value: '—' }, { label: 'blocked', value: '41m' }, { label: 'uptime', value: '96.20%' }],
  },
];

const DEFAULT_PRIORITIES: MWPriorities[] = [
  {
    id: 'pri-1', rank: '01', title: 'Sign three realm escalations', source: 'sso-orb', status: 'waiting', clock: 'waiting 12m',
    impact: 'Blocks four contributors from the deep-shelf workspace and holds the 10:00 reviewer rotation.',
    notes: ['Ada K. — reader → editor on realm:deep-shelf', 'Wren O. — service identity for currents-worker', 'Sable N. — break-glass, expires in 6h'],
    actions: [{ label: 'Open approval lane', href: '#mw-alerts' }, { label: 'Identity activity', href: '#mw-activity' }],
  },
  {
    id: 'pri-2', rank: '02', title: 'Renew the expired canary certificate', source: 'forge', status: 'unavailable', clock: 'due in 40m',
    impact: 'Two releases are queued behind it. Tidepool-web stays on the previous build until the chain is valid.',
    notes: ['Issuer: worlds-internal-ca', 'CSR already generated at 02:14', 'Downtime window: none required'],
    actions: [{ label: 'Read the pipeline alert', href: '#mw-alerts' }, { label: 'Deploy history', href: '#mw-activity' }],
  },
  {
    id: 'pri-3', rank: '03', title: 'Skim the tide-pool digest', source: 'currents', status: 'healthy', clock: 'optional',
    impact: 'Nine signals were flagged interesting overnight. Nothing is blocked — this one can wait for coffee.',
    notes: ['3 schema changes upstream', '6 new worlds announced', '1 retraction, already reverted'],
    actions: [{ label: 'Jump to activity', href: '#mw-activity' }],
  },
];

const DEFAULT_ACTIVITY: MWEvent[] = [
  { id: 'ev-1', actor: 'meridian', action: 'merged', target: 'PR #912 · reef-cache into main', ago: '4m', tone: 'healthy' },
  { id: 'ev-2', actor: 'sso-orb', action: 'rotated signing keys for', target: 'realm: deep-shelf', ago: '22m', tone: 'waiting' },
  { id: 'ev-3', actor: 'currents', action: 'indexed 27 signals from', target: '6 discovery worlds', ago: '1h', tone: 'healthy' },
  { id: 'ev-4', actor: 'forge', action: 'halted canary deploy on', target: 'world: tidepool-web', ago: '2h', tone: 'unavailable' },
  { id: 'ev-5', actor: 'Rylee', action: 'acknowledged alert', target: 'ALR-2291 · cert expiry window', ago: '5h', tone: 'neutral' },
  { id: 'ev-6', actor: 'nerida', action: 'opened the deep channel', target: 'route: shelf-04', ago: '7h', tone: 'neutral' },
];

const DEFAULT_ALERTS: MWAlert[] = [
  {
    id: 'ALR-2301', severity: 'critical', title: 'Canary certificate expired', source: 'forge', ago: '2h ago',
    detail: 'The chain for worlds-internal-ca failed validation at 02:14. Forge refused to promote build 4.18 and is holding all release channels.',
    steps: ['Re-issue from the CSR at /pki/canary-418.csr', 'Install on forge-edge-1 through forge-edge-3', 'Resume release lane 418'],
  },
  {
    id: 'ALR-2300', severity: 'watch', title: 'Identity escalations past the 10-minute lane', source: 'sso-orb', ago: '12m ago',
    detail: 'Three escalations crossed the policy threshold. A second signer is required before any of them can self-clear.',
    steps: ['Confirm requester scope in realm:deep-shelf', 'Sign or decline as a batch'],
  },
  {
    id: 'ALR-2298', severity: 'info', title: 'Discovery feed re-indexed after upstream schema change', source: 'currents', ago: '3h ago',
    detail: 'Schema v4 migration completed with no data loss. Dedupe precision dipped to 0.88 for eleven minutes, now recovered.',
    steps: ['No action required — informational only'],
  },
];

const DEFAULT_VITALS: MWVital[] = [
  { label: 'worlds awake', value: '11 / 12', bar: 92, tone: 'healthy' },
  { label: 'sync depth', value: '42 m', bar: 60, tone: 'healthy' },
  { label: 'current', value: '0.8 kn', bar: 34, tone: 'waiting' },
  { label: 'shelf storage', value: '68 %', bar: 68, tone: 'neutral' },
  { label: 'release flow', value: 'held', bar: 12, tone: 'unavailable' },
];

function MwIcon({ name, color }: { name: MWCapability['icon']; color: string }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      {name === 'branch' && (
        <g {...s}>
          <circle cx="7" cy="5.5" r="2.2" /><circle cx="7" cy="18.5" r="2.2" /><circle cx="17" cy="8.5" r="2.2" />
          <path d="M7 7.7v8.6" /><path d="M17 10.7c0 3.2-2.8 4.3-5.4 4.7" />
        </g>
      )}
      {name === 'key' && (
        <g {...s}>
          <circle cx="8.5" cy="12" r="3.4" /><path d="M11.9 12H21" /><path d="M17.6 12v3.1" /><path d="M20.4 12v2.2" />
        </g>
      )}
      {name === 'radar' && (
        <g {...s}>
          <circle cx="12" cy="12" r="8.2" /><path d="M12 12l5-6" /><circle cx="12" cy="12" r="1.5" />
          <path d="M12 3.8a8.2 8.2 0 0 1 7.3 4.5" opacity=".55" />
        </g>
      )}
      {name === 'rocket' && (
        <g {...s}>
          <path d="M12 3.2c3 2.6 4.6 5.8 4.6 9.3L12 17.2l-4.6-4.7C7.4 9 9 5.8 12 3.2Z" />
          <path d="M9.4 15.6 7.8 21l4.2-2.6L16.2 21l-1.6-5.4" /><circle cx="12" cy="10" r="1.6" />
        </g>
      )}
    </svg>
  );
}

function MwMermaid({ gradientId, className, style }: { gradientId: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 152" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#72b1b1" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#72b1b1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#e4c58d" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="60" cy="26" r="10" />
        <path d="M50 21c-16 1-25 14-22 30" opacity=".7" />
        <path d="M52 28c-13 5-19 17-17 30" opacity=".5" />
        <path d="M48 14c-17-2-28 10-27 25" opacity=".4" />
        <path d="M62 36c7 9 7 21 0 31" />
        <path d="M62 67c-7 12-5 28 7 40c8 8 18 10 26 6" />
        <path d="M95 113c-8-7-12-16-9-26" opacity=".85" />
        <path d="M95 113c9-5 15-13 15-23" opacity=".85" />
        <path d="M64 45c10 3 16 10 18 19" opacity=".6" />
        <path d="M45 92c6 3 11 8 14 14" opacity=".35" />
      </g>
    </svg>
  );
}

function MwSectionHead({ kicker, title, hint, id }: { kicker: string; title: string; hint?: string; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="mw-mono text-[10px] uppercase tracking-[0.38em] text-[#a397b8]">{kicker}</p>
        <h2 id={id} className="mw-display mt-1.5 text-[22px] font-semibold tracking-[-0.015em] text-[#f0eaff] sm:text-[27px]">{title}</h2>
      </div>
      {hint ? <p className="mw-mono shrink-0 pb-1 text-[10px] uppercase tracking-[0.22em] text-[#a397b8]">{hint}</p> : null}
    </div>
  );
}

function MwBadge({ status, pulse }: { status: Exclude<MWStatus, 'neutral'>; pulse?: boolean }) {
  const tone = TONE[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${tone.chip}`}>
      <span className="relative inline-flex h-1.5 w-1.5">
        {pulse ? <span className="mw-ping absolute inset-0 rounded-full" style={{ background: tone.hex }} aria-hidden="true" /> : null}
        <span className="relative inline-block h-1.5 w-1.5 rounded-full" style={{ background: tone.hex }} aria-hidden="true" />
      </span>
      <span className="mw-mono text-[9px] uppercase tracking-[0.16em]">{tone.label}</span>
    </span>
  );
}

function MwCapabilityCard({ cap, index }: { cap: MWCapability; index: number }) {
  const tone = TONE[cap.status];
  return (
    <article
      className="mw-card mw-rise group relative overflow-hidden rounded-xl border border-[#2a2538] bg-[#12101a] p-4 sm:p-5"
      style={{ animationDelay: `${index * 80}ms`, ['--mw-tone-a' as string]: tone.hex }}
      aria-label={`${cap.name}, status ${tone.label}`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${tone.hex}, transparent)` }} aria-hidden="true" />
      <span className="pointer-events-none absolute inset-0 mw-card-sheen" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#1a1724] ring-1 ring-inset ring-[#2a2538] transition-transform duration-300 group-hover:-translate-y-0.5">
          <MwIcon name={cap.icon} color={tone.hex} />
        </span>
        <MwBadge status={cap.status} pulse={cap.status !== 'healthy'} />
      </div>

      <h3 className="mw-display relative mt-3.5 text-[17px] font-semibold leading-tight text-[#f0eaff]">{cap.name}</h3>
      <p className="mw-mono relative mt-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: tone.hex }}>{cap.codename}</p>
      <p className="relative mt-2.5 text-[13px] leading-relaxed text-[#a397b8]">{cap.summary}</p>

      <div className="relative mt-4">
        <div className="flex items-center justify-between">
          <span className="mw-mono text-[9px] uppercase tracking-[0.2em] text-[#a397b8]">{cap.metricLabel}</span>
          <span className="mw-mono text-[10px] text-[#f0eaff]">{cap.metricValue}%</span>
        </div>
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[#2a2538]">
          <span className="mw-meter block h-full rounded-full" style={{ width: `${cap.metricValue}%`, background: tone.hex, boxShadow: `0 0 12px ${tone.hex}77`, animationDelay: `${index * 120}ms` }} />
        </div>
      </div>

      <dl className="relative mt-4 grid grid-cols-3 gap-2 border-t border-[#2a2538] pt-3">
        {cap.stats.map((st) => (
          <div key={st.label}>
            <dt className="mw-mono text-[9px] uppercase tracking-[0.16em] text-[#a397b8]">{st.label}</dt>
            <dd className="mw-mono mt-0.5 text-[12px] text-[#f0eaff]">{st.value}</dd>
          </div>
        ))}
      </dl>

      <details className="mw-fold relative mt-3">
        <summary className="mw-mono flex items-center gap-1.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[#a397b8] transition-colors hover:text-[#f0eaff]">
          <span className="mw-chev inline-block" aria-hidden="true">›</span> checks
        </summary>
        <ul className="mt-1 space-y-1 border-l border-[#2a2538] pl-3">
          {cap.checks.map((c) => (
            <li key={c} className="mw-mono text-[11px] leading-relaxed text-[#a397b8]">{c}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function MwPriority({ item, index }: { item: MWPriorities; index: number }) {
  const tone = TONE[item.status];
  return (
    <details
      className="mw-fold mw-rise group rounded-xl border border-[#2a2538] bg-[#12101a] transition-colors duration-300 hover:border-[#3a3350]"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <summary className="flex items-start gap-3 p-4 sm:p-5">
        <span className="mw-mono mt-0.5 text-[11px] tabular-nums text-[#a397b8]">{item.rank}</span>
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: tone.hex, boxShadow: `0 0 10px ${tone.hex}` }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="mw-display block text-[16px] font-semibold leading-snug text-[#f0eaff] sm:text-[18px]">{item.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`mw-mono rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] ${tone.chip}`}>{item.source}</span>
            <span className="mw-mono text-[10px] uppercase tracking-[0.18em] text-[#a397b8]">{item.clock}</span>
          </span>
        </span>
        <span className="mw-chev mt-1 shrink-0 text-[#a397b8] transition-transform duration-300" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
        </span>
      </summary>
      <div className="border-t border-[#2a2538] px-4 pb-5 pt-4 sm:px-5">
        <p className="text-[13px] leading-relaxed text-[#a397b8]">{item.impact}</p>
        <ul className="mt-3 space-y-1.5">
          {item.notes.map((n) => (
            <li key={n} className="flex items-start gap-2 text-[13px] text-[#f0eaff]/85">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#a397b8]" aria-hidden="true" />{n}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {item.actions.map((a) => (
            <a
              key={a.href + a.label}
              href={a.href}
              className="mw-mono rounded-md border border-[#2a2538] bg-[#1a1724] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#a397b8] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#72b1b1]/50 hover:text-[#72b1b1]"
            >
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </details>
  );
}

function MwTimeline({ events, dense }: { events: MWEvent[]; dense?: boolean }) {
  return (
    <ol className="mw-timeline mt-4 pl-6">
      {events.map((ev, i) => {
        const tone = TONE[ev.tone];
        return (
          <li key={ev.id} className="mw-rise group relative pb-5 last:pb-0" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="absolute -left-6 top-[6px] grid h-3 w-3 place-items-center">
              {i === 0 ? <span className="mw-ping absolute h-3 w-3 rounded-full" style={{ background: tone.hex }} aria-hidden="true" /> : null}
              <span className="relative h-[7px] w-[7px] rounded-full border transition-transform duration-300 group-hover:scale-150" style={{ borderColor: tone.hex, background: '#0a0810' }} aria-hidden="true" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="mw-mono text-[12px] font-medium" style={{ color: tone.hex }}>{ev.actor}</span>
              <span className="text-[13px] text-[#a397b8]">{ev.action}</span>
              <span className="text-[13px] text-[#f0eaff]">{ev.target}</span>
            </div>
            {!dense ? (
              <p className="mw-mono mt-1 text-[10px] uppercase tracking-[0.18em] text-[#a397b8]/70">{ev.ago} ago</p>
            ) : null}
            {dense ? <p className="mw-mono absolute right-0 top-1 hidden text-[10px] uppercase tracking-[0.18em] text-[#a397b8]/70 sm:block">{ev.ago}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

function MwAlertRow({ alert, index }: { alert: MWAlert; index: number }) {
  const tone: MWStatus = alert.severity === 'critical' ? 'unavailable' : alert.severity === 'watch' ? 'waiting' : 'neutral';
  const hex = TONE[tone].hex;
  return (
    <details
      className="mw-fold mw-rise group relative overflow-hidden rounded-xl border border-[#2a2538] bg-[#12101a] pl-5 transition-colors duration-300 hover:border-[#3a3350]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: hex, boxShadow: `0 0 18px ${hex}66` }} aria-hidden="true" />
      <summary className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 sm:p-5">
        <span className="mw-mono rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em]" style={{ background: `${hex}1a`, color: hex }}>{alert.severity}</span>
        <span className="mw-display min-w-0 flex-1 text-[15px] font-semibold text-[#f0eaff] sm:text-[17px]">{alert.title}</span>
        <span className="mw-mono text-[10px] uppercase tracking-[0.18em] text-[#a397b8]">{alert.source} · {alert.ago}</span>
        <span className="mw-chev text-[#a397b8]" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
        </span>
      </summary>
      <div className="border-t border-[#2a2538] py-4 pr-5">
        <p className="text-[13px] leading-relaxed text-[#a397b8]">{alert.detail}</p>
        <p className="mw-mono mt-3 text-[9px] uppercase tracking-[0.24em] text-[#a397b8]">remediation</p>
        <ol className="mt-2 space-y-1.5">
          {alert.steps.map((s, i) => (
            <li key={s} className="flex gap-2.5 text-[13px] text-[#f0eaff]/85">
              <span className="mw-mono text-[10px] text-[#a397b8]">{String(i + 1).padStart(2, '0')}</span>{s}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

export default function TodayDashboard(props: TodayDashboardProps) {
  const {
    name = 'Rylee',
    salutation = 'Good morning,',
    dateLabel = 'Tue 04 · shelf light',
    sessionLabel = 'session 04:12',
    worldsAwake = 11,
    worldsTotal = 12,
    pendingYou = 3,
    capabilities = DEFAULT_CAPABILITIES,
    priorities = DEFAULT_PRIORITIES,
    activity = DEFAULT_ACTIVITY,
    alerts = DEFAULT_ALERTS,
    vitals = DEFAULT_VITALS,
    companion = { name: 'Nerida', state: 'drifting', line: 'Holding the deep channel open. Nothing needs her yet.' },
    footerRole = 'keeper of twelve worlds',
    buildLabel = 'build 4.18 · tide 0.8kn · last sync 4s ago',
  } = props;

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="mw-root relative min-h-screen bg-[#0a0810] text-[#f0eaff]">
      <style dangerouslySetInnerHTML={{ __html: `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400..600&display=swap');
.mw-root{font-family:'Space Grotesk',ui-sans-serif,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;}
.mw-display{font-family:'Fraunces','Iowan Old Style',Georgia,serif;font-variation-settings:'SOFT' 30,'WONK' 1;}
.mw-mono{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;}
.mw-root :focus-visible{outline:2px solid #72b1b1;outline-offset:2px;border-radius:6px;}
.mw-skip{position:absolute;left:-9999px;top:0;z-index:60;}
.mw-skip:focus{left:1rem;top:1rem;position:fixed;padding:.55rem .9rem;background:#1a1724;border:1px solid #72b1b1;color:#f0eaff;border-radius:.5rem;font-size:12px;}

.mw-view{display:none;}
.mw-view--default{display:block;}
.mw-shell:has(.mw-view:target) .mw-view{display:none;}
.mw-shell:has(.mw-view:target) .mw-view:target{display:block;}
.mw-tab{position:relative;color:#a397b8;border:1px solid transparent;transition:color .25s ease,background .25s ease,border-color .25s ease,transform .25s ease;}
.mw-tab:hover{color:#f0eaff;background:#1a1724;border-color:#2a2538;transform:translateY(-1px);}
.mw-tab::after{content:'';position:absolute;left:12px;right:12px;bottom:-1px;height:2px;background:#72b1b1;transform:scaleX(0);transform-origin:left;transition:transform .3s cubic-bezier(.2,.7,.3,1);box-shadow:0 0 12px #72b1b1;}
.mw-shell:has(#mw-overview:target) .mw-tab[data-tab="mw-overview"],
.mw-shell:has(#mw-activity:target) .mw-tab[data-tab="mw-activity"],
.mw-shell:has(#mw-alerts:target) .mw-tab[data-tab="mw-alerts"],
.mw-shell:not(:has(.mw-view:target)) .mw-tab[data-tab="mw-overview"]{color:#f0eaff;background:#1a1724;border-color:#2a2538;}
.mw-shell:has(#mw-overview:target) .mw-tab[data-tab="mw-overview"]::after,
.mw-shell:has(#mw-activity:target) .mw-tab[data-tab="mw-activity"]::after,
.mw-shell:has(#mw-alerts:target) .mw-tab[data-tab="mw-alerts"]::after,
.mw-shell:not(:has(.mw-view:target)) .mw-tab[data-tab="mw-overview"]::after{transform:scaleX(1);}

.mw-card{transition:transform .35s cubic-bezier(.2,.7,.3,1),border-color .35s ease,box-shadow .35s ease;}
.mw-card:hover{transform:translateY(-4px);border-color:#3a3350;box-shadow:0 24px 50px -26px rgba(0,0,0,.95);}
.mw-card-sheen{background:radial-gradient(130% 100% at 50% -25%,var(--mw-tone-a,#72b1b1) 0%,transparent 58%);opacity:0;transition:opacity .4s ease;}
.mw-card:hover .mw-card-sheen,.mw-card:focus-within .mw-card-sheen{opacity:.16;}
.mw-fold summary{list-style:none;}
.mw-fold summary::-webkit-details-marker{display:none;}
.mw-fold[open]{background:#15121e;border-color:#3a3350;}
.mw-fold[open] .mw-chev{transform:rotate(90deg);}
.mw-fold .mw-chev{transition:transform .3s cubic-bezier(.2,.7,.3,1);}
.mw-timeline{position:relative;}
.mw-timeline::before{content:'';position:absolute;left:-21px;top:10px;bottom:10px;width:1px;background:linear-gradient(180deg,#2a2538 0%,#2a2538 55%,rgba(42,37,56,0) 100%);}

@keyframes mwRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.mw-rise{animation:mwRise .55s cubic-bezier(.2,.7,.3,1) both;}
@keyframes mwPing{0%{transform:scale(1);opacity:.5}75%,100%{transform:scale(2.7);opacity:0}}
.mw-ping{animation:mwPing 2.4s cubic-bezier(0,0,.2,1) infinite;}
@keyframes mwBlink{0%,100%{opacity:1}50%{opacity:.35}}
.mw-blink{animation:mwBlink 2.8s ease-in-out infinite;}
@keyframes mwMeter{from{width:0}}
.mw-meter{animation:mwMeter 1.1s cubic-bezier(.2,.7,.3,1) both;}
@keyframes mwSheen{0%{background-position:130% 0}100%{background-position:-130% 0}}
.mw-sheen{background:linear-gradient(90deg,rgba(114,177,177,0),#72b1b1 18%,#e4c58d 42%,#b57f8b 66%,rgba(181,127,139,0));background-size:220% 100%;animation:mwSheen 11s linear infinite;}
@keyframes mwCaustic{0%{transform:translate3d(-2%,-1%,0) rotate(0deg)}50%{transform:translate3d(2%,2%,0) rotate(1.5deg)}100%{transform:translate3d(-2%,-1%,0) rotate(0deg)}}
.mw-caustic{background:repeating-linear-gradient(112deg,rgba(114,177,177,.055) 0 2px,transparent 2px 92px),repeating-linear-gradient(68deg,rgba(181,127,139,.045) 0 2px,transparent 2px 128px);animation:mwCaustic 28s ease-in-out infinite;}
.mw-gridlines{background-image:linear-gradient(to right,rgba(42,37,56,.6) 1px,transparent 1px),linear-gradient(to bottom,rgba(42,37,56,.6) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(120% 90% at 50% 0%,#000 15%,transparent 75%);mask-image:radial-gradient(120% 90% at 50% 0%,#000 15%,transparent 75%);}
@keyframes mwMermaid{0%,100%{transform:translateY(0) rotate(-1.5deg);opacity:.62}50%{transform:translateY(-9px) rotate(1.5deg);opacity:1}}
.mw-mermaid{animation:mwMermaid 9.5s ease-in-out infinite;filter:drop-shadow(0 0 14px rgba(114,177,177,.55));}
@keyframes mwHalo{0%,100%{opacity:.10;transform:scale(1)}50%{opacity:.26;transform:scale(1.1)}}
.mw-halo{animation:mwHalo 9.5s ease-in-out infinite;}
@keyframes mwDrift{0%{transform:translate3d(0,0,0) rotate(-3deg)}50%{transform:translate3d(-14px,-22px,0) rotate(3deg)}100%{transform:translate3d(0,0,0) rotate(-3deg)}}
.mw-ghost{animation:mwDrift 26s ease-in-out infinite;opacity:.07;filter:blur(.4px);}
@keyframes mwBubble{0%{transform:translateY(8px) scale(.4);opacity:0}18%{opacity:.5}100%{transform:translateY(-96px) scale(1);opacity:0}}
.mw-bubble{position:absolute;border-radius:9999px;background:#72b1b1;box-shadow:0 0 8px #72b1b1;animation:mwBubble 7s linear infinite;}
@keyframes mwRing{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.mw-ring{animation:mwRing 22s linear infinite;}

@media (prefers-reduced-motion: reduce){
  .mw-root *,.mw-root *::before,.mw-root *::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important;}
  .mw-mermaid{opacity:.8;transform:none;}
  .mw-ghost{opacity:.05;}
  .mw-ping,.mw-bubble{display:none;}
}
      `}} />

      {/* ambient layers */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-[18%] -top-[28%] h-[70vh] w-[70vw] rounded-full opacity-[0.16] blur-[120px]" style={{ background: 'radial-gradient(circle, #72b1b1 0%, transparent 65%)' }} />
        <div className="absolute -bottom-[28%] -right-[12%] h-[60vh] w-[60vw] rounded-full opacity-[0.11] blur-[130px]" style={{ background: 'radial-gradient(circle, #b57f8b 0%, transparent 65%)' }} />
        <div className="mw-caustic absolute -inset-[20%]" />
        <div className="mw-gridlines absolute inset-0 opacity-[0.5]" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(130% 90% at 50% 0%, transparent 38%, rgba(10,8,16,0.9) 100%)' }} />
        <MwMermaid gradientId="mw-grad-ghost" className="mw-ghost absolute bottom-[-40px] right-[-30px] hidden h-[420px] w-[420px] xl:block" />
      </div>

      <a href="#mw-main" className="mw-skip mw-mono">Skip to dashboard</a>

      <div className="mw-shell relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col">
        {/* header */}
        <header className="flex flex-col gap-6 border-b border-[#2a2538] px-4 pb-6 pt-7 sm:px-6 sm:pb-7 sm:pt-9 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="min-w-0">
            <p className="mw-mono text-[10px] uppercase tracking-[0.42em] text-[#a397b8]">
              Project Worlds <span aria-hidden="true">·</span> Today
            </p>
            <h1 className="mw-display mt-3 text-[34px] font-light leading-[1.04] tracking-[-0.025em] text-[#a397b8] sm:text-[46px] lg:text-[54px]">
              {salutation}{' '}
              <span className="font-semibold italic text-[#f0eaff]">{name}</span>
              <span className="ml-2 inline-block h-2 w-2 -translate-y-1 rounded-full bg-[#e4c58d] align-middle" aria-hidden="true" />
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2" role="status">
              <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
                <span className="mw-ping absolute inset-0 rounded-full bg-[#72b1b1]" aria-hidden="true" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#72b1b1] shadow-[0_0_10px_#72b1b1]" aria-hidden="true" />
              </span>
              <p className="text-[13px] text-[#a397b8]">
                <span className="font-medium text-[#72b1b1]">{worldsAwake} of {worldsTotal} worlds awake</span>
                <span aria-hidden="true"> · </span>
                <span className="text-[#e4c58d]">{pendingYou} waiting on you</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:justify-end">
            <dl className="hidden text-right sm:block">
              <div>
                <dt className="sr-only">Local date</dt>
                <dd className="mw-mono text-[11px] uppercase tracking-[0.2em] text-[#f0eaff]">{dateLabel}</dd>
              </div>
              <div className="mt-1">
                <dt className="sr-only">Session length</dt>
                <dd className="mw-mono text-[10px] uppercase tracking-[0.2em] text-[#a397b8]">{sessionLabel}</dd>
              </div>
            </dl>
            <div className="relative h-12 w-12 shrink-0">
              <span className="mw-ring absolute inset-0 rounded-full border border-dashed border-[#72b1b1]/40" aria-hidden="true" />
              <span className="absolute inset-1 grid place-items-center rounded-full bg-[#1a1724] ring-1 ring-inset ring-[#2a2538]">
                <span className="mw-display text-[17px] font-semibold text-[#72b1b1]">{name.charAt(0)}</span>
              </span>
            </div>
          </div>
        </header>

        {/* view switch (CSS :target) */}
        <nav aria-label="Dashboard views" className="sticky top-0 z-30 border-b border-[#2a2538] bg-[#0a0810]/85 px-4 backdrop-blur-md sm:px-6 lg:px-10">
          <div className="flex gap-1.5 overflow-x-auto py-3">
            <a href="#mw-overview" data-tab="mw-overview" className="mw-tab mw-mono whitespace-nowrap rounded-lg px-3.5 py-2 text-[10px] uppercase tracking-[0.22em]">Overview</a>
            <a href="#mw-activity" data-tab="mw-activity" className="mw-tab mw-mono flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[10px] uppercase tracking-[0.22em]">
              Activity <span className="rounded bg-[#2a2538] px-1.5 py-0.5 text-[9px] tracking-normal text-[#a397b8]">{activity.length}</span>
            </a>
            <a href="#mw-alerts" data-tab="mw-alerts" className="mw-tab mw-mono flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[10px] uppercase tracking-[0.22em]">
              Alerts
              <span className="relative flex items-center gap-1.5">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="mw-ping absolute inset-0 rounded-full bg-[#b57f8b]" aria-hidden="true" />
                  <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-[#b57f8b]" aria-hidden="true" />
                </span>
                <span className="rounded bg-[#2a2538] px-1.5 py-0.5 text-[9px] tracking-normal text-[#a397b8]">{alerts.length}</span>
              </span>
            </a>
            <span className="ml-auto hidden items-center gap-2 pr-1 lg:flex">
              <span className="mw-mono text-[9px] uppercase tracking-[0.24em] text-[#a397b8]/70">{criticalCount} critical</span>
              <span className="mw-blink inline-block h-1 w-1 rounded-full bg-[#b57f8b]" aria-hidden="true" />
            </span>
          </div>
        </nav>

        <main id="mw-main" className="flex-1 px-4 pb-12 pt-7 sm:px-6 lg:px-10">
          {/* OVERVIEW */}
          <section id="mw-overview" className="mw-view mw-view--default scroll-mt-28" aria-labelledby="mw-overview-h">
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_318px]">
              <div className="min-w-0 space-y-9">
                <div>
                  <MwSectionHead kicker="Capabilities" title="Four systems, watching the shelf" hint="live · 4s" id="mw-overview-h" />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {capabilities.map((c, i) => <MwCapabilityCard key={c.id} cap={c} index={i} />)}
                  </div>
                </div>

                <div>
                  <MwSectionHead kicker="Triage" title="What needs you now" hint={`${priorities.length} items`} />
                  <div className="mt-4 space-y-3">
                    {priorities.map((p, i) => <MwPriority key={p.id} item={p} index={i} />)}
                  </div>
                </div>

                <div>
                  <MwSectionHead kicker="Recent Activity" title="Since the last high tide" hint="last 7h" />
                  <MwTimeline events={activity.slice(0, 4)} dense />
                </div>
              </div>

              {/* sidebar */}
              <aside className="space-y-5" aria-label="System vitals and companion">
                <div className="rounded-xl border border-[#2a2538] bg-[#12101a] p-4">
                  <p className="mw-mono text-[9px] uppercase tracking-[0.32em] text-[#a397b8]">Vitals</p>
                  <ul className="mt-3 space-y-3.5">
                    {vitals.map((v) => {
                      const tone = TONE[v.tone];
                      return (
                        <li key={v.label}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="mw-mono text-[10px] uppercase tracking-[0.16em] text-[#a397b8]">{v.label}</span>
                            <span className="mw-mono text-[11px] text-[#f0eaff]">{v.value}</span>
                          </div>
                          <div className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full bg-[#2a2538]">
                            <span className="mw-meter block h-full rounded-full" style={{ width: `${v.bar}%`, background: tone.hex, boxShadow: `0 0 10px ${tone.hex}66` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* companion */}
                <figure className="relative overflow-hidden rounded-xl border border-[#2a2538] bg-[#12101a] px-4 pb-4 pt-6">
                  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <span className="mw-halo absolute left-1/2 top-10 h-40 w-40 -translate-x-1/2 rounded-full blur-[42px]" style={{ background: 'radial-gradient(circle, #72b1b1 0%, transparent 68%)' }} />
                    <span className="mw-bubble left-[32%] top-[62%] h-1 w-1" style={{ animationDelay: '0s' }} />
                    <span className="mw-bubble left-[58%] top-[70%] h-[3px] w-[3px]" style={{ animationDelay: '1.9s' }} />
                    <span className="mw-bubble left-[44%] top-[78%] h-[2px] w-[2px]" style={{ animationDelay: '3.6s' }} />
                    <span className="mw-bubble left-[68%] top-[66%] h-1 w-1" style={{ animationDelay: '5.2s' }} />
                  </div>
                  <MwMermaid gradientId="mw-grad-companion" className="mw-mermaid relative mx-auto h-[172px] w-auto" />
                  <figcaption className="relative mt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="mw-display text-[16px] font-semibold text-[#f0eaff]">{companion.name}</span>
                      <span className="mw-mono flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-[#72b1b1]">
                        <span className="mw-blink inline-block h-1 w-1 rounded-full bg-[#72b1b1]" aria-hidden="true" />{companion.state}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[#a397b8]">{companion.line}</p>
                  </figcaption>
                </figure>

                <div className="rounded-xl border border-[#2a2538] bg-[#12101a] p-4">
                  <p className="mw-mono text-[9px] uppercase tracking-[0.32em] text-[#a397b8]">Next horizon</p>
                  <p className="mw-display mt-2 text-[15px] leading-snug text-[#f0eaff]">Reviewer rotation at 10:00</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#a397b8]">Forge resumes automatically once the canary chain validates.</p>
                  <div className="mw-sheen mt-3 h-px w-full" aria-hidden="true" />
                </div>
              </aside>
            </div>
          </section>

          {/* ACTIVITY */}
          <section id="mw-activity" className="mw-view scroll-mt-28" aria-labelledby="mw-activity-h">
            <MwSectionHead kicker="Full log" title="Everything the worlds did today" hint={`${activity.length} events`} id="mw-activity-h" />
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Event legend">
              {([['healthy', 'completed'], ['waiting', 'pending'], ['unavailable', 'failed'], ['neutral', 'observed']] as [Exclude<MWStatus, never>, string][]).map(([tone, label]) => (
                <span key={label} className="mw-mono inline-flex items-center gap-2 rounded-full border border-[#2a2538] bg-[#12101a] px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-[#a397b8]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[tone].hex }} aria-hidden="true" />{label}
                </span>
              ))}
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_318px]">
              <div className="rounded-xl border border-[#2a2538] bg-[#12101a] p-4 sm:p-5">
                <p className="mw-mono text-[9px] uppercase tracking-[0.3em] text-[#a397b8]">Timeline · today</p>
                <MwTimeline events={activity} />
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-[#2a2538] bg-[#12101a] p-4">
                  <p className="mw-mono text-[9px] uppercase tracking-[0.3em] text-[#a397b8]">Busiest worlds</p>
                  <ul className="mt-3 space-y-3">
                    {[['tidepool-web', 34, 'unavailable'], ['deep-shelf', 27, 'waiting'], ['reef-cache', 19, 'healthy'], ['lantern-04', 8, 'neutral']].map(([w, n, t]) => (
                      <li key={w as string}>
                        <div className="flex items-baseline justify-between">
                          <span className="mw-mono text-[11px] text-[#f0eaff]">{w as string}</span>
                          <span className="mw-mono text-[10px] text-[#a397b8]">{n as number} events</span>
                        </div>
                        <div className="mt-1.5 h-[2px] overflow-hidden rounded-full bg-[#2a2538]">
                          <span className="mw-meter block h-full rounded-full" style={{ width: `${((n as number) / 34) * 100}%`, background: TONE[t as MWStatus].hex }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[#2a2538] bg-[#12101a] p-4">
                  <p className="mw-display text-[15px] font-semibold text-[#f0eaff]">Quiet since 05:12</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#a397b8]">No human writes on the shelf for four hours. Everything below came from the systems themselves.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ALERTS */}
          <section id="mw-alerts" className="mw-view scroll-mt-28" aria-labelledby="mw-alerts-h">
            <MwSectionHead kicker="Signal & noise" title="Alerts raised in the last six hours" hint={`${criticalCount} critical`} id="mw-alerts-h" />
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_318px]">
              <div className="space-y-3">
                {alerts.map((a, i) => <MwAlertRow key={a.id} alert={a} index={i} />)}
              </div>
              <aside className="space-y-4" aria-label="Alert summary">
                <div className="rounded-xl border border-[#2a2538] bg-[#12101a] p-4">
                  <p className="mw-mono text-[9px] uppercase tracking-[0.3em] text-[#a397b8]">Muted lanes</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#a397b8]">Two noisy checks on <span className="mw-mono text-[#f0eaff]">currents</span> are silenced until the schema v4 backfill closes at 14:00.</p>
                </div>
                <div className="relative overflow-hidden rounded-xl border border-[#2a2538] bg-[#12101a] p-4">
                  <span className="mw-halo pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-[36px]" style={{ background: 'radial-gradient(circle,#72b1b1,transparent 70%)' }} aria-hidden="true" />
                  <p className="relative mw-mono text-[9px] uppercase tracking-[0.3em] text-[#72b1b1]">{companion.name} says</p>
                  <p className="relative mw-display mt-2 text-[15px] leading-snug text-[#f0eaff]">“The cert is the only real thing in this list.”</p>
                </div>
              </aside>
            </div>
          </section>
        </main>

        <footer className="relative mt-auto border-t border-[#2a2538] px-4 pb-8 pt-0 sm:px-6 lg:px-10">
          <div className="mw-sheen h-px w-full" aria-hidden="true" />
          <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="mw-display text-[15px] text-[#f0eaff]">
              {name} <span className="text-[13px] font-light not-italic text-[#a397b8]">· {footerRole}</span>
            </p>
            <p className="mw-mono text-[10px] uppercase tracking-[0.2em] text-[#a397b8]">{buildLabel}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}