import { useState, useRef, useEffect } from 'react';
import { useButton, useTab, useTabList, useTabPanel, FocusScope, useFocusRing } from 'react-aria';
import type { AriaTabListProps, AriaTabProps } from 'react-aria';

type Capability = {
  id: string;
  name: string;
  status: 'healthy' | 'waiting' | 'unavailable';
  detail: string;
  metric: string;
};

type Priority = {
  id: string;
  title: string;
  context: string;
  tag: string;
};

type Activity = {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
};

const CAPABILITIES: Capability[] = [
  { id: 'sc', name: 'Source Control', status: 'healthy', detail: 'All branches synced, no pending conflicts.', metric: '128 commits today' },
  { id: 'id', name: 'Identity Provider', status: 'waiting', detail: 'Two new SSO requests pending admin approval.', metric: '2 pending' },
  { id: 'df', name: 'Discovery Feed', status: 'healthy', detail: 'Index warm, queries responding under 80ms.', metric: 'p80 76ms' },
  { id: 'dp', name: 'Deployment Pipeline', status: 'unavailable', detail: 'Canary stage failing health checks on region eu-2.', metric: '3 failed runs' },
];

const PRIORITIES: Priority[] = [
  { id: 'p1', title: 'Approve SSO access for Lunar team', context: 'Blocks onboarding for 4 engineers since yesterday.', tag: 'Identity' },
  { id: 'p2', title: 'Triage canary failures', context: 'Deployment Pipeline has been red for 22 minutes.', tag: 'Deploys' },
  { id: 'p3', title: 'Review Maren’s discovery proposal', context: 'Awaiting your sign-off before fanning out to feeds.', tag: 'Discovery' },
];

const ACTIVITY: Activity[] = [
  { id: 'a1', actor: 'Maren', action: 'pushed', target: 'feature/discovery-v2', timestamp: '3 minutes ago' },
  { id: 'a2', actor: 'Pipeline', action: 'failed on', target: 'canary/eu-2', timestamp: '22 minutes ago' },
  { id: 'a3', actor: 'Sora', action: 'requested access to', target: 'Identity/Lunar-sso', timestamp: '1 hour ago' },
  { id: 'a4', actor: 'You', action: 'merged', target: 'discovery/index-warmup', timestamp: '3 hours ago' },
  { id: 'a5', actor: 'Aren', action: 'opened', target: 'INC-204 Discovery latency spike', timestamp: 'Yesterday' },
];

const STATUS_META: Record<Capability['status'], { dot: string; ring: string; label: string; text: string; bg: string }> = {
  healthy: { dot: 'bg-[#7fc99c]', ring: 'ring-[#7fc99c]/40', label: 'Healthy', text: 'text-[#7fc99c]', bg: 'bg-[#7fc99c]/10' },
  waiting: { dot: 'bg-[#e4c58d]', ring: 'ring-[#e4c58d]/40', label: 'Waiting', text: 'text-[#e4c58d]', bg: 'bg-[#e4c58d]/10' },
  unavailable: { dot: 'bg-[#b57f8b]', ring: 'ring-[#b57f8b]/40', label: 'Unavailable', text: 'text-[#b57f8b]', bg: 'bg-[#b57f8b]/10' },
};

function useAriaButton(props: { onPress?: () => void; 'aria-label'?: string; isDisabled?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(props, ref);
  const { focusProps, isFocusVisible } = useFocusRing();
  return { ref, buttonProps: { ...buttonProps, ...focusProps }, isFocusVisible };
}

function CapabilityCard({ cap, expanded, onToggle }: { cap: Capability; expanded: boolean; onToggle: () => void }) {
  const meta = STATUS_META[cap.status];
  const { ref, buttonProps, isFocusVisible } = useAriaButton({
    onPress: onToggle,
    'aria-label': `${cap.name}, status ${meta.label}. Press to ${expanded ? 'collapse' : 'expand'} details.`,
  });

  return (
    <button
      ref={ref}
      {...buttonProps}
      className={[
        'group relative text-left bg-[#12101a] border border-[#2a2538] rounded-2xl p-4 transition-all duration-300 ease-out',
        'hover:bg-[#1a1724] hover:border-[#3a3350]',
        isFocusVisible ? 'outline-none ring-2 ring-[#72b1b1] ring-offset-2 ring-offset-[#0a0810]' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`relative inline-block w-2.5 h-2.5 rounded-full ${meta.dot} ring-4 ${meta.ring}`}
          >
            {cap.status === 'unavailable' && (
              <span className="absolute inset-0 rounded-full bg-[#b57f8b] animate-ping opacity-60 motion-reduce:hidden" />
            )}
          </span>
          <div>
            <p className="text-[#f0eaff] font-medium text-sm">{cap.name}</p>
            <p className="text-[#a397b8] text-xs mt-0.5">{cap.metric}</p>
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${meta.bg} ${meta.text}`}>
          {meta.label}
        </span>
      </div>

      <div
        className={`grid transition-all duration-300 ease-out ${
          expanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-[#a397b8] text-sm leading-relaxed border-t border-[#2a2538] pt-3">
            {cap.detail}
          </p>
        </div>
      </div>
    </button>
  );
}

function PriorityRow({ item }: { item: Priority }) {
  const { ref, buttonProps, isFocusVisible } = useAriaButton({
    'aria-label': `Open priority: ${item.title}`,
    onPress: () => {},
  });
  return (
    <button
      ref={ref}
      {...buttonProps}
      className={[
        'w-full text-left flex items-start gap-3 p-3 rounded-xl bg-[#12101a] border border-[#2a2538]',
        'transition-all duration-300 hover:bg-[#1a1724] hover:border-[#3a3350]',
        isFocusVisible ? 'outline-none ring-2 ring-[#72b1b1] ring-offset-2 ring-offset-[#0a0810]' : '',
      ].join(' ')}
    >
      <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#72b1b1]" />
      <div className="flex-1 min-w-0">
        <p className="text-[#f0eaff] text-sm font-medium truncate">{item.title}</p>
        <p className="text-[#a397b8] text-xs mt-1">{item.context}</p>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-[#72b1b1] bg-[#72b1b1]/10 px-2 py-1 rounded-full whitespace-nowrap">
        {item.tag}
      </span>
    </button>
  );
}

function TimelineItem({ item, last }: { item: Activity; last: boolean }) {
  return (
    <li className="relative pl-7 pb-4">
      <span
        aria-hidden="true"
        className={`absolute left-[7px] top-2 w-2 h-2 rounded-full bg-[#72b1b1] ring-4 ring-[#72b1b1]/15`}
      />
      {!last && <span aria-hidden="true" className="absolute left-[11px] top-4 bottom-0 w-px bg-[#2a2538]" />}
      <p className="text-sm text-[#f0eaff]">
        <span className="text-[#a397b8]">{item.actor}</span>{' '}
        <span className="text-[#a397b8]">{item.action}</span>{' '}
        <span className="font-medium">{item.target}</span>
      </p>
      <p className="text-xs text-[#a397b8] mt-0.5">{item.timestamp}</p>
    </li>
  );
}

function MermaidCompanion() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-0">
      <div className="relative w-24 h-24 sm:w-32 sm:h-32 opacity-30 motion-reduce:opacity-20">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <radialGradient id="mermGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#72b1b1" stopOpacity="0.7" />
              <stop offset="60%" stopColor="#72b1b1" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#72b1b1" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#mermGlow)" />
          <path
            d="M30 60 Q 40 40 55 55 T 80 50 Q 70 65 55 60 T 30 60 Z"
            fill="none"
            stroke="#72b1b1"
            strokeWidth="1"
            className="merm-tail"
          />
          <circle cx="62" cy="48" r="3" fill="#72b1b1" className="merm-core" />
          <path d="M50 30 Q 60 35 65 45" stroke="#72b1b1" strokeWidth="0.8" fill="none" opacity="0.6" />
        </svg>
      </div>
    </div>
  );
}

export default function TodayDashboard() {
  const [expandedId, setExpandedId] = useState<string | null>('dp');
  const [tabIndex, setTabIndex] = useState(0);

  const tabsRef = useRef<HTMLDivElement>(null);
  const tabListProps = useTabList(
    {
      'aria-label': 'Dashboard views',
      selectedKey: ['overview', 'activity', 'alerts'][tabIndex],
      onSelectionChange: (k) => setTabIndex(['overview', 'activity', 'alerts'].indexOf(k as string)),
    } as AriaTabListProps<unknown>,
    tabsRef,
  );

  return (
    <div className="relative min-h-screen bg-[#0a0810] text-[#f0eaff] flex flex-col overflow-x-hidden">
      <style>{`
        @keyframes mermDrift {
          0%, 100% { transform: translate(0,0) rotate(0deg); }
          50% { transform: translate(2px,-2px) rotate(2deg); }
        }
        .merm-tail { animation: mermDrift 6s ease-in-out infinite; transform-origin: 50% 50%; }
        @keyframes mermCore {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .merm-core { animation: mermCore 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .merm-tail, .merm-core { animation: none !important; }
        }
      `}</style>

      <MermaidCompanion />

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 pt-6 pb-4 border-b border-[#2a2538]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="relative inline-block w-2.5 h-2.5 rounded-full bg-[#7fc99c] ring-4 ring-[#7fc99c]/30"
            >
              <span className="absolute inset-0 rounded-full bg-[#7fc99c] animate-ping opacity-50 motion-reduce:hidden" />
            </span>
            <div>
              <p className="text-[#a397b8] text-xs uppercase tracking-widest">Project Worlds</p>
              <h1 className="text-[#f0eaff] text-lg sm:text-xl font-medium">Good morning, Rylee</h1>
            </div>
          </div>
          <button
            className="text-[10px] uppercase tracking-wider text-[#a397b8] bg-[#12101a] border border-[#2a2538] rounded-full px-3 py-1.5 hover:bg-[#1a1724] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1]"
            aria-label="View profile"
          >
            Rylee
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Tabs */}
          <FocusScope>
            <div
              ref={tabsRef}
              {...tabListProps}
              className="flex gap-1 p-1 bg-[#12101a] border border-[#2a2538] rounded-2xl w-full sm:w-fit"
              role="tablist"
            >
              {['Overview', 'Activity', 'Alerts'].map((label, i) => (
                <TabItem key={label} id={['overview', 'activity', 'alerts'][i]} label={label} isSelected={tabIndex === i} />
              ))}
            </div>
          </FocusScope>

          {/* Panels */}
          {tabIndex === 0 && (
            <section className="space-y-6" aria-label="Overview panel">
              {/* Capability cards */}
              <div>
                <h2 className="text-[#a397b8] text-xs uppercase tracking-widest mb-3">Capabilities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CAPABILITIES.map((cap) => (
                    <CapabilityCard
                      key={cap.id}
                      cap={cap}
                      expanded={expandedId === cap.id}
                      onToggle={() => setExpandedId(expandedId === cap.id ? null : cap.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Priorities */}
              <div>
                <h2 className="text-[#a397b8] text-xs uppercase tracking-widest mb-3">What needs you now</h2>
                <div className="space-y-2">
                  {PRIORITIES.map((p) => (
                    <PriorityRow key={p.id} item={p} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {tabIndex === 1 && (
            <section className="space-y-6" aria-label="Activity panel">
              <div className="bg-[#12101a] border border-[#2a2538] rounded-2xl p-4 sm:p-5">
                <h2 className="text-[#f0eaff] text-sm font-medium mb-1">Recent activity</h2>
                <p className="text-[#a397b8] text-xs mb-4">Across your projects in the last 24 hours.</p>
                <ol className="space-y-0">
                  {ACTIVITY.map((a, i) => (
                    <TimelineItem key={a.id} item={a} last={i === ACTIVITY.length - 1} />
                  ))}
                </ol>
              </div>
            </section>
          )}

          {tabIndex === 2 && (
            <section className="space-y-4" aria-label="Alerts panel">
              <div className="bg-[#12101a] border border-[#2a2538] rounded-2xl p-4 sm:p-5">
                <h2 className="text-[#f0eaff] text-sm font-medium mb-3">Active alerts</h2>
                <div className="space-y-2">
                  {CAPABILITIES.filter((c) => c.status !== 'healthy').map((c) => {
                    const meta = STATUS_META[c.status];
                    return (
                      <div
                        key={c.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-[#1a1724] border border-[#2a2538]"
                      >
                        <span className={`mt-1 w-2 h-2 rounded-full ${meta.dot}`} aria-hidden="true" />
                        <div className="flex-1">
                          <p className="text-[#f0eaff] text-sm font-medium">{c.name}</p>
                          <p className="text-[#a397b8] text-xs mt-0.5">{c.detail}</p>
                        </div>
                        <span className={`text-[10px] tracking-wider ${meta.text}`}>{meta.label.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 sm:px-6 py-4 border-t border-[#2a2538]">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <span className="text-[#a397b8] text-xs">Rylee</span>
          <span aria-hidden="true" className="flex-1 h-px bg-gradient-to-r from-[#72b1b1]/40 via-[#72b1b1]/15 to-transparent" />
          <span className="text-[#a397b8] text-xs">Today</span>
        </div>
      </footer>
    </div>
  );
}

function TabItem({ id, label, isSelected }: { id: string; label: string; isSelected: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { tabProps } = useTab({ id, isDisabled: false } as AriaTabProps, ref, undefined);
  const { focusProps, isFocusVisible } = useFocusRing();
  return (
    <div
      ref={ref}
      {...tabProps}
      {...focusProps}
      className={[
        'flex-1 sm:flex-none px-4 py-2 text-sm rounded-xl text-center cursor-pointer transition-all duration-300 outline-none',
        isSelected
          ? 'bg-[#1a1724] text-[#f0eaff] border border-[#2a2538]'
          : 'text-[#a397b8] border border-transparent hover:text-[#f0eaff]',
        isFocusVisible ? 'ring-2 ring-[#72b1b1] ring-offset-2 ring-offset-[#12101a]' : '',
      ].join(' ')}
    >
      {label}
    </div>
  );
}