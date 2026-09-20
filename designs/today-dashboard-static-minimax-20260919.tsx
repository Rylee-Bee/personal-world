import * as React from 'react';

/*
 * Project Worlds — Today Dashboard
 * Pure presentational component with CSS-only interactivity.
 *
 * Reference import pattern (not used directly here to maintain purity):
 *   import { useButton } from 'react-aria';
 *   import { useTab, useTabList, useTabPanel } from 'react-aria';
 *
 * CDN reference (for reference only — not executed):
 *   <script src="https://cdn.tailwindcss.com"></script>
 *
 * Design tokens:
 *   Canvas #0a0810 | Panel #12101a | Elevated #1a1724 | Border #2a2538
 *   Text primary #f0eaff | Text secondary #a397b8
 *   Accent teal #72b1b1 | Rose #b57f8b | Gold #e4c58d
 */

interface Capability {
  title: string;
  description: string;
  status: 'healthy' | 'waiting' | 'unavailable';
  metric: string;
  detail: string;
  icon: React.ReactNode;
}

interface PriorityItem {
  title: string;
  context: string;
  badge: string;
  badgeColor: 'rose' | 'gold' | 'teal';
}

interface ActivityItem {
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'commit' | 'deploy' | 'auth' | 'review' | 'alert';
}

interface AlertItem {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  time: string;
}

const capabilities: Capability[] = [
  {
    title: 'Source Control',
    description: 'Repository sync & branches',
    status: 'healthy',
    metric: '12 repos',
    detail: 'Last sync 3 min ago',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="12" r="2.5" />
        <path d="M6 8.5v7M8.5 6h7a2 2 0 0 1 2 2v2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Identity Provider',
    description: 'Auth & session management',
    status: 'healthy',
    metric: '847',
    detail: 'All providers operational',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: 'Discovery Feed',
    description: 'Content ingestion pipeline',
    status: 'waiting',
    metric: '3 queues',
    detail: 'Awaiting upstream signal',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    title: 'Deployment Pipeline',
    description: 'Build & release orchestration',
    status: 'unavailable',
    metric: '0 active',
    detail: 'Staging cluster offline',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 12h4l3-8 4 16 3-8h2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const priorities: PriorityItem[] = [
  {
    title: 'Approve staging environment restart',
    context: 'Deployment Pipeline has been unavailable for 24 minutes. Manual approval required to proceed with cluster recovery.',
    badge: 'Action needed',
    badgeColor: 'rose',
  },
  {
    title: 'Review identity migration staging rollout',
    context: 'Two team members flagged concerns about the session timeout changes. Their review comments are waiting on your response.',
    badge: '2 reviews',
    badgeColor: 'gold',
  },
  {
    title: 'Confirm discovery feed throttle adjustment',
    context: 'The new ingestion rate was scheduled to take effect at 09:00. Confirm before the next sync window opens.',
    badge: 'Scheduled',
    badgeColor: 'teal',
  },
];

const activities: ActivityItem[] = [
  { actor: 'Maren', action: 'pushed to', target: 'main on world-collector', timestamp: '4m ago', type: 'commit' },
  { actor: 'pipeline', action: 'completed build', target: '#2847 — stable', timestamp: '22m ago', type: 'deploy' },
  { actor: 'Idris', action: 'requested review on', target: 'auth/timeout-config', timestamp: '1h ago', type: 'review' },
  { actor: 'system', action: 'rotated credentials for', target: 'discovery-feed-prod', timestamp: '3h ago', type: 'auth' },
  { actor: 'Sasha', action: 'flagged alert on', target: 'staging-cluster-3', timestamp: '6h ago', type: 'alert' },
];

const alerts: AlertItem[] = [
  {
    severity: 'critical',
    title: 'Staging cluster offline',
    detail: 'World runtime unreachable since 09:14 UTC. Auto-recovery paused pending approval.',
    time: '24m ago',
  },
  {
    severity: 'warning',
    title: 'Discovery queue depth above threshold',
    detail: 'Ingestion backlog at 14k items — double the rolling 24h average.',
    time: '1h ago',
  },
  {
    severity: 'info',
    title: 'Scheduled maintenance window',
    detail: 'Identity provider maintenance scheduled for tonight at 22:00 UTC.',
    time: '3h ago',
  },
];

function StatusBadge({ status }: { status: Capability['status'] }) {
  const config = {
    healthy: { dot: '#7dd3a0', text: '#7dd3a0', label: 'Healthy', pulse: true },
    waiting: { dot: '#e4c58d', text: '#e4c58d', label: 'Waiting', pulse: false },
    unavailable: { dot: '#b57f8b', text: '#b57f8b', label: 'Unavailable', pulse: false },
  } as const;
  const c = config[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0a0810]/60 border border-[#2a2538] text-[10px] uppercase tracking-wider font-medium">
      <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }}>
        {c.pulse && (
          <span
            className="absolute inset-0 rounded-full ping-slow"
            style={{ backgroundColor: c.dot }}
          />
        )}
      </span>
      <span style={{ color: c.text }}>{c.label}</span>
    </span>
  );
}

function CapabilityCard({ capability }: { capability: Capability }) {
  return (
    <article
      className="group relative bg-[#12101a] border border-[#2a2538] rounded-xl p-4 sm:p-5 transition-all duration-300 hover:border-[#72b1b1]/60 hover:bg-[#1a1724] hover:-translate-y-0.5 focus-within:border-[#72b1b1] focus-within:ring-2 focus-within:ring-[#72b1b1]/40 focus-within:outline-none"
      tabIndex={0}
      aria-label={`${capability.title} capability — status ${capability.status}`}
    >
      <div className="absolute top-3 right-3">
        <StatusBadge status={capability.status} />
      </div>
      <div className="flex items-center gap-2 mb-6 sm:mb-8 text-[#a397b8]">
        <span className="transition-colors group-hover:text-[#72b1b1]">{capability.icon}</span>
        <span className="text-[10px] uppercase tracking-[0.15em]">{capability.status === 'unavailable' ? 'Capability offline' : capability.status === 'waiting' ? 'Capability waiting' : 'Capability online'}</span>
      </div>
      <div>
        <h3 className="text-[#f0eaff] font-medium text-base tracking-tight">{capability.title}</h3>
        <p className="text-[#a397b8] text-xs mt-0.5 leading-relaxed">{capability.description}</p>
      </div>
      <div className="mt-4 sm:mt-5 space-y-0.5">
        <div className="text-[#f0eaff] text-2xl sm:text-3xl font-extralight tracking-tight">{capability.metric}</div>
        <div className="text-[#a397b8] text-xs">{capability.detail}</div>
      </div>
    </article>
  );
}

function MermaidAmbient() {
  return (
    <div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-28 h-28 sm:w-32 sm:h-32 pointer-events-none mermaid-float"
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <defs>
          <filter id="mGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="mAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#72b1b1" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#72b1b1" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#72b1b1" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="55" fill="url(#mAura)" className="mermaid-aura" />
        <g
          filter="url(#mGlow)"
          stroke="#72b1b1"
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* flowing tail strands */}
          <path d="M 32 78 Q 24 92, 14 100 T 4 112" opacity="0.55" />
          <path d="M 36 80 Q 30 96, 22 104 T 12 114" opacity="0.45" />
          <path d="M 40 82 Q 36 98, 30 106" opacity="0.4" />
          <path d="M 34 76 Q 28 88, 20 94" opacity="0.5" />
          {/* body */}
          <path d="M 32 78 C 36 60, 56 52, 62 36 C 68 22, 86 22, 90 34" opacity="0.85" />
          {/* torso shading */}
          <path d="M 42 66 C 48 56, 58 54, 64 48" opacity="0.5" strokeWidth="0.6" />
          {/* head */}
          <ellipse cx="91" cy="34" rx="7" ry="5" opacity="0.85" />
          <circle cx="93" cy="33" r="0.8" fill="#72b1b1" stroke="none" opacity="0.9" />
          {/* hair flowing */}
          <path d="M 96 30 Q 104 26, 110 18" opacity="0.7" />
          <path d="M 97 33 Q 108 32, 114 28" opacity="0.6" />
          <path d="M 96 36 Q 104 38, 108 44" opacity="0.55" />
          <path d="M 95 38 Q 100 44, 100 50" opacity="0.45" />
          {/* arm */}
          <path d="M 52 50 Q 46 44, 44 38" opacity="0.65" />
          {/* fin suggestion */}
          <path d="M 28 74 Q 22 70, 18 72 Q 22 76, 28 78" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}

export default function TodayDashboard() {
  return (
    <>
      <style>{`
        @keyframes pingSlow {
          0% { transform: scale(1); opacity: 0.9; }
          80%, 100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes auraPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.08); }
        }
        @keyframes mermaidFloat {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(2px, -4px) rotate(1deg); }
          66% { transform: translate(-3px, 2px) rotate(-1.2deg); }
        }
        @keyframes hairFlow {
          0%, 100% { stroke-dashoffset: 0; }
          50% { stroke-dashoffset: -8; }
        }
        @keyframes headerShine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .ping-slow { animation: pingSlow 2.6s cubic-bezier(0,0,0.2,1) infinite; }
        .mermaid-aura { transform-origin: 60px 60px; animation: auraPulse 7s ease-in-out infinite; }
        .mermaid-float { animation: mermaidFloat 9s ease-in-out infinite; }

        /* Tab panel visibility via hidden radio inputs */
        .tab-panel { display: none; }
        #tab-overview:checked ~ main .panel-overview,
        #tab-activity:checked ~ main .panel-activity,
        #tab-alerts:checked ~ main .panel-alerts { display: block; }

        /* Active tab label styling */
        .tab-label {
          color: #a397b8;
          border-bottom-color: transparent;
        }
        #tab-overview:checked ~ nav label[for="tab-overview"],
        #tab-activity:checked ~ nav label[for="tab-activity"],
        #tab-alerts:checked ~ nav label[for="tab-alerts"] {
          color: #f0eaff;
          border-bottom-color: #72b1b1;
        }

        /* Hover/focus for tab labels */
        .tab-label:hover { color: #f0eaff; }
        .tab-label:focus-visible {
          outline: none;
          color: #f0eaff;
          box-shadow: inset 0 0 0 2px #72b1b1;
          border-radius: 6px;
        }

        /* Subtle background texture */
        .canvas-bg {
          background-image:
            radial-gradient(ellipse 80% 60% at 20% 0%, rgba(114,177,177,0.06), transparent 60%),
            radial-gradient(ellipse 60% 50% at 100% 100%, rgba(181,127,139,0.05), transparent 60%);
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
          .ping-slow, .mermaid-aura, .mermaid-float { animation: none !important; }
        }

        /* Focus visibility for sr-only inputs */
        .sr-only:focus { outline: none; }
      `}</style>

      <div className="min-h-screen bg-[#0a0810] text-[#f0eaff] flex flex-col relative overflow-x-hidden canvas-bg">
        {/* Hidden radio inputs for CSS-only tab switching */}
        <input
          type="radio"
          name="dashboard-tabs"
          id="tab-overview"
          defaultChecked
          className="sr-only"
          aria-label="Show overview tab"
        />
        <input
          type="radio"
          name="dashboard-tabs"
          id="tab-activity"
          className="sr-only"
          aria-label="Show activity tab"
        />
        <input
          type="radio"
          name="dashboard-tabs"
          id="tab-alerts"
          className="sr-only"
          aria-label="Show alerts tab"
        />

        {/* Header */}
        <header className="border-b border-[#2a2538] bg-[#0a0810]/85 backdrop-blur-sm sticky top-0 z-10 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1/3 header-shine pointer-events-none opacity-30" style={{ animation: 'headerShine 8s ease-in-out infinite', background: 'linear-gradient(90deg, transparent, rgba(114,177,177,0.08), transparent)' }} />
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between gap-3 relative">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#72b1b1]/30 to-[#1a1724] flex items-center justify-center border border-[#2a2538] flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#72b1b1]" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.6" />
                  <circle cx="12" cy="12" r="7" opacity="0.5" />
                  <circle cx="12" cy="12" r="11" opacity="0.25" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#a397b8]">Project Worlds</div>
                <div className="text-sm font-medium text-[#f0eaff] -mt-0.5 truncate">Today</div>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-[#7dd3a0]">
                    <span className="absolute inset-0 rounded-full bg-[#7dd3a0] ping-slow" />
                  </span>
                  <span className="text-sm text-[#f0eaff]">
                    Good morning, <span className="text-[#e4c58d] font-medium">Rylee</span>
                  </span>
                </div>
                <div className="text-[10px] text-[#a397b8] uppercase tracking-wider mt-0.5">
                  Tuesday · 09:42 · Clearwater
                </div>
              </div>
              <div className="sm:hidden flex items-center gap-2">
                <span className="relative inline-flex w-2 h-2 rounded-full bg-[#7dd3a0]">
                  <span className="absolute inset-0 rounded-full bg-[#7dd3a0] ping-slow" />
                </span>
                <span className="text-sm text-[#f0eaff]"><span className="text-[#e4c58d]">Rylee</span></span>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="border-b border-[#2a2538] bg-[#0a0810]" aria-label="Dashboard sections">
          <div className="max-w-6xl mx-auto px-3 sm:px-8">
            <ul className="flex gap-1 -mb-px" role="tablist">
              <li>
                <label
                  htmlFor="tab-overview"
                  className="tab-label block py-3 px-3 sm:px-4 text-sm font-medium border-b-2 cursor-pointer transition-colors select-none"
                >
                  Overview
                </label>
              </li>
              <li>
                <label
                  htmlFor="tab-activity"
                  className="tab-label block py-3 px-3 sm:px-4 text-sm font-medium border-b-2 cursor-pointer transition-colors select-none"
                >
                  Activity
                </label>
              </li>
              <li>
                <label
                  htmlFor="tab-alerts"
                  className="tab-label block py-3 px-3 sm:px-4 text-sm font-medium border-b-2 cursor-pointer transition-colors select-none inline-flex items-center gap-2"
                >
                  Alerts
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#b57f8b]/15 text-[#b57f8b] text-[10px] font-semibold border border-[#b57f8b]/30">
                    2
                  </span>
                </label>
              </li>
            </ul>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-6 sm:py-8">
          {/* Overview Panel */}
          <div className="tab-panel panel-overview space-y-8 sm:space-y-10">
            <section aria-labelledby="capabilities-heading">
              <div className="flex items-baseline justify-between mb-4">
                <h2 id="capabilities-heading" className="text-[11px] uppercase tracking-[0.2em] text-[#a397b8] font-semibold">
                  Capabilities
                </h2>
                <span className="text-[10px] text-[#a397b8] uppercase tracking-wider">Updated 09:41</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {capabilities.map((c) => (
                  <CapabilityCard key={c.title} capability={c} />
                ))}
              </div>
            </section>

            <section aria-labelledby="priorities-heading">
              <div className="flex items-baseline justify-between mb-4">
                <h2 id="priorities-heading" className="text-[11px] uppercase tracking-[0.2em] text-[#a397b8] font-semibold">
                  What needs you now
                </h2>
                <label
                  htmlFor="tab-activity"
                  className="text-[10px] text-[#72b1b1] hover:text-[#f0eaff] uppercase tracking-wider cursor-pointer focus:outline-none focus-visible:text-[#f0eaff]"
                >
                  View all →
                </label>
              </div>
              <div className="bg-[#12101a] border border-[#2a2538] rounded-xl divide-y divide-[#2a2538] overflow-hidden">
                {priorities.map((p, i) => {
                  const colorMap = {
                    rose: { dot: '#b57f8b', text: '#b57f8b', border: 'rgba(181,127,139,0.3)' },
                    gold: { dot: '#e4c58d', text: '#e4c58d', border: 'rgba(228,197,141,0.3)' },
                    teal: { dot: '#72b1b1', text: '#72b1b1', border: 'rgba(114,177,177,0.3)' },
                  } as const;
                  const c = colorMap[p.badgeColor];
                  return (
                    <details key={i} className="group">
                      <summary className="flex items-start gap-3 p-4 sm:p-5 cursor-pointer list-none hover:bg-[#1a1724] focus-within:bg-[#1a1724] transition-colors [&::-webkit-details-marker]:hidden">
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.dot }}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-[#f0eaff] text-sm font-medium leading-snug">{p.title}</h3>
                            <span
                              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border flex-shrink-0 font-medium"
                              style={{ color: c.text, borderColor: c.border, backgroundColor: 'rgba(10,8,16,0.4)' }}
                            >
                              {p.badge}
                            </span>
                          </div>
                          <p className="text-[#a397b8] text-xs mt-1.5 leading-relaxed">
                            {p.context}
                          </p>
                        </div>
                        <svg
                          className="w-4 h-4 text-[#a397b8] mt-1 transition-transform group-open:rotate-90 flex-shrink-0"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          aria-hidden="true"
                        >
                          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pl-9 sm:pl-11 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-md bg-[#72b1b1]/10 text-[#72b1b1] border border-[#72b1b1]/30 hover:bg-[#72b1b1]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] transition-colors"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-md text-[#a397b8] border border-[#2a2538] hover:text-[#f0eaff] hover:border-[#a397b8]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] transition-colors"
                        >
                          Snooze
                        </button>
                        <button
                          type="button"
                          className="text-xs px-3 py-1.5 rounded-md text-[#a397b8] hover:text-[#f0eaff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] transition-colors"
                        >
                          Assign
                        </button>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Activity Panel */}
          <div className="tab-panel panel-activity space-y-6">
            <section aria-labelledby="activity-heading">
              <div className="flex items-baseline justify-between mb-4">
                <h2 id="activity-heading" className="text-[11px] uppercase tracking-[0.2em] text-[#a397b8] font-semibold">
                  Recent Activity
                </h2>
                <span className="text-[10px] text-[#a397b8] uppercase tracking-wider">Last 24 hours</span>
              </div>
              <div className="bg-[#12101a] border border-[#2a2538] rounded-xl p-5 sm:p-7">
                <ol className="relative space-y-5 sm:space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-[#2a2538]">
                  {activities.map((a, i) => {
                    const typeConfig: Record<ActivityItem['type'], { color: string; label: string }> = {
                      commit: { color: '#72b1b1', label: 'Commit' },
                      deploy: { color: '#7dd3a0', label: 'Deploy' },
                      auth: { color: '#e4c58d', label: 'Auth' },
                      review: { color: '#a397b8', label: 'Review' },
                      alert: { color: '#b57f8b', label: 'Alert' },
                    };
                    const t = typeConfig[a.type];
                    return (
                      <li key={i} className="relative pl-7">
                        <span
                          className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 border-[#12101a]"
                          style={{ backgroundColor: t.color }}
                          aria-hidden="true"
                        />
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-[#f0eaff] text-sm font-medium">{a.actor}</span>
                          <span className="text-[#a397b8] text-sm">{a.action}</span>
                          <span className="text-[#72b1b1] text-sm font-mono break-all">{a.target}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <time className="text-[10px] text-[#a397b8] uppercase tracking-wider">{a.timestamp}</time>
                          <span className="text-[#2a2538]">·</span>
                          <span
                            className="text-[10px] uppercase tracking-wider font-medium"
                            style={{ color: t.color }}
                          >
                            {t.label}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </section>
          </div>

          {/* Alerts Panel */}
          <div className="tab-panel panel-alerts space-y-6">
            <section aria-labelledby="alerts-heading">
              <div className="flex items-baseline justify-between mb-4">
                <h2 id="alerts-heading" className="text-[11px] uppercase tracking-[0.2em] text-[#a397b8] font-semibold">
                  Active Alerts
                </h2>
                <span className="text-[10px] text-[#b57f8b] uppercase tracking-wider">2 require attention</span>
              </div>
              <div className="space-y-3">
                {alerts.map((alert, i) => {
                  const sev = {
                    critical: { color: '#b57f8b', label: 'Critical', dot: '#b57f8b', glow: 'rgba(181,127,139,0.4)' },
                    warning: { color: '#e4c58d', label: 'Warning', dot: '#e4c58d', glow: 'rgba(228,197,141,0.3)' },
                    info: { color: '#72b1b1', label: 'Info', dot: '#72b1b1', glow: 'rgba(114,177,177,0.3)' },
                  } as const;
                  const s = sev[alert.severity];
                  return (
                    <article
                      key={i}
                      className="group bg-[#12101a] border border-[#2a2538] rounded-xl p-4 sm:p-5 transition-all duration-300 hover:border-[#72b1b1]/40 hover:bg-[#1a1724] focus-within:border-[#72b1b1] focus-within:ring-2 focus-within:ring-[#72b1b1]/30 focus-within:outline-none"
                      tabIndex={0}
                      aria-label={`${s.label} alert: ${alert.title}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="relative inline-flex w-2 h-2 rounded-full" style={{ backgroundColor: s.dot }}>
                            {alert.severity === 'critical' && (
                              <span
                                className="absolute inset-0 rounded-full ping-slow"
                                style={{ backgroundColor: s.dot }}
                              />
                            )}
                          </span>
                          <span
                            className="text-[10px] uppercase tracking-[0.2em] font-semibold"
                            style={{ color: s.color }}
                          >
                            {s.label}
                          </span>
                        </div>
                        <time className="text-[10px] text-[#a397b8] uppercase tracking-wider">{alert.time}</time>
                      </div>
                      <h3 className="text-[#f0eaff] text-sm font-medium mb-1.5">{alert.title}</h3>
                      <p className="text-[#a397b8] text-xs leading-relaxed">{alert.detail}</p>
                      {alert.severity === 'critical' && (
                        <div className="mt-3 pt-3 border-t border-[#2a2538] flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-md bg-[#b57f8b]/10 text-[#b57f8b] border border-[#b57f8b]/30 hover:bg-[#b57f8b]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b57f8b] transition-colors"
                          >
                            Investigate
                          </button>
                          <button
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-md text-[#a397b8] border border-[#2a2538] hover:text-[#f0eaff] hover:border-[#a397b8]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] transition-colors"
                          >
                            View logs
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#2a2538] bg-[#0a0810]/60 mt-auto">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-[#f0eaff] text-sm">Rylee</span>
              <span className="text-[#a397b8] text-xs hidden sm:inline">·</span>
              <span className="text-[#a397b8] text-xs hidden sm:inline">Build 2024.11.18 · v3.2.0</span>
              <span className="text-[#a397b8] text-xs">·</span>
              <span className="text-[#a397b8] text-xs">All systems local</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#a397b8] uppercase tracking-[0.2em]">Connected</span>
              <div
                className="h-px w-12 sm:w-24 bg-gradient-to-r from-[#72b1b1] via-[#72b1b1]/50 to-transparent"
                aria-hidden="true"
              />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#72b1b1]">
                <span className="absolute inset-0 rounded-full bg-[#72b1b1] ping-slow" />
              </span>
            </div>
          </div>
        </footer>

        {/* Mermaid ambient presence */}
        <MermaidAmbient />
      </div>
    </>
  );
}