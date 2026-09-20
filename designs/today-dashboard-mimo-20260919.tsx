// @ts-nocheck
import React, { useState, useRef } from 'react';
import { useButton, useToggleButton, useToggleState, useFocusRing, mergeProps } from 'react-aria';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'alerts', label: 'Alerts', count: 2 },
  ];

  const capabilities = [
    {
      id: 0, name: 'Source Control', status: 'healthy' as const, statusLabel: 'Healthy',
      detail: 'Last sync 3 minutes ago · 12 repositories active · 0 conflicts',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
          <path d="M13.5 3C13.5 4.38071 12.3807 5.5 11 5.5C9.61929 5.5 8.5 4.38071 8.5 3C8.5 1.61929 9.61929 0.5 11 0.5C12.3807 0.5 13.5 1.61929 13.5 3ZM13.5 3V14M13.5 14C13.5 15.3807 12.3807 16.5 11 16.5C9.61929 16.5 8.5 15.3807 8.5 14V3" strokeLinecap="round" />
          <circle cx="11" cy="20" r="2" />
        </svg>
      ),
    },
    {
      id: 1, name: 'Identity Provider', status: 'waiting' as const, statusLabel: 'Waiting',
      detail: 'Pending 14 SSO credential renewals · Next batch in 6 minutes',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
          <path d="M12 11C13.6569 11 15 9.65685 15 8C15 6.34315 13.6569 5 12 5C10.3431 5 9 6.34315 9 8C9 9.65685 10.3431 11 12 11ZM12 11V13M8 15C6.89543 15 6 14.1046 6 13H18C18 14.1046 17.1046 15 16 15H8Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 2, name: 'Discovery Feed', status: 'healthy' as const, statusLabel: 'Healthy',
      detail: '847 items indexed · Last crawl 1 minute ago · Feed latency 12ms',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
          <path d="M4 11L20 5M4 11V19L12 16M4 11L12 8M20 5V13L12 16M20 5L12 8M12 8V16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 3, name: 'Deployment Pipeline', status: 'unavailable' as const, statusLabel: 'Unavailable',
      detail: 'Build runner offline · Last successful deploy 4 hours ago · Retrying in 12 min',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  const priorityItems = [
    { id: 100, label: 'SSO Credential Renewal Batch', description: '14 identity tokens approaching expiration within the hour', severity: 'amber' as const, action: 'Review' },
    { id: 101, label: 'Pipeline Runner Recovery', description: 'Deployment runner lost connection 18 minutes ago', severity: 'red' as const, action: 'Restart' },
    { id: 102, label: 'Weekly Analytics Digest', description: '3 community feeds requesting review approval', severity: 'green' as const, action: 'Review' },
  ];

  const activityTimeline = [
    { id: 200, time: '2m ago', label: 'Discovery Feed indexed 847 items', detail: 'Full crawl complete', color: 'teal' },
    { id: 201, time: '8m ago', label: 'Source Control merged 3 pull requests', detail: 'feat/auth-gateway, fix/cors-policy, chore/deps', color: 'teal' },
    { id: 202, time: '18m ago', label: 'Deployment Pipeline lost build runner', detail: 'Runner-07 unreachable · last heartbeat 22m ago', color: 'rose' },
    { id: 203, time: '24m ago', label: 'Identity Provider queued 14 renewals', detail: 'Batch processing · ETA 6 minutes', color: 'gold' },
    { id: 204, time: '1h ago', label: 'Deployment Pipeline completed deploy v3.14.2', detail: 'Staging environment · zero downtime', color: 'teal' },
  ];

  const alerts = [
    { id: 300, severity: 'red' as const, title: 'Deployment Pipeline — Runner Offline', detail: 'Build runner-07 lost connection 18 minutes ago. All queued builds are pending. The last successful deploy (v3.14.2) completed to staging. Automatic retry scheduled in 12 minutes.', action: 'Restart Runner' },
    { id: 301, severity: 'amber' as const, title: 'Identity Provider — 14 Tokens Expiring', detail: 'SSO credentials for 14 service accounts will expire within the next hour. Automatic renewal batch has been queued and will process in approximately 6 minutes.', action: 'Review Batch' },
  ];

  // Tab Button Component
  function TabButton({ tab, isActive, onSelect }: { tab: any; isActive: boolean; onSelect: () => void }) {
    const ref = useRef<HTMLButtonElement>(null);
    const { buttonProps } = useButton(
      {
        onPress: onSelect,
        'aria-label': `${tab.label}${tab.count ? ` (${tab.count} alerts)` : ''}`,
      },
      ref
    );
    const { focusProps, isFocusVisible } = useFocusRing();

    return (
      <button
        {...mergeProps(buttonProps, focusProps)}
        ref={ref}
        role="tab"
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 ${
          isActive
            ? 'bg-[#1a1724] text-[#72b1b1] shadow-[0_0_12px_rgba(114,177,177,0.15)]'
            : 'text-[#a397b8] hover:text-[#f0eaff] hover:bg-[#1a1724]/50'
        } ${isFocusVisible ? 'outline outline-2 outline-offset-2 outline-[#72b1b1]' : ''}`}
      >
        {tab.label}
        {tab.count && (
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[#b57f8b]/20 text-[#b57f8b]">
            {tab.count}
          </span>
        )}
      </button>
    );
  }

  // Card Button Component
  function CardButton({ cap, isExpanded, onToggle }: { cap: any; isExpanded: boolean; onToggle: () => void }) {
    const ref = useRef<HTMLButtonElement>(null);
    const { buttonProps } = useButton(
      {
        onPress: onToggle,
        'aria-label': `${cap.name} — ${cap.statusLabel}. ${cap.detail}${isExpanded ? '. Click to collapse.' : '. Click to expand.'}`,
      },
      ref
    );
    const { focusProps, isFocusVisible } = useFocusRing();

    const statusColorMap = { healthy: 'bg-[#4ade80]', waiting: 'bg-[#f59e0b]', unavailable: 'bg-[#ef4444]' };
    const statusTextMap = { healthy: 'text-[#4ade80]', waiting: 'text-[#f59e0b]', unavailable: 'text-[#ef4444]' };
    const statusBgMap = { healthy: 'bg-[#4ade80]/10', waiting: 'bg-[#f59e0b]/10', unavailable: 'bg-[#ef4444]/10' };
    const statusBorderMap = { healthy: 'border-[#4ade80]/20', waiting: 'border-[#f59e0b]/20', unavailable: 'border-[#ef4444]/20' };

    return (
      <button
        {...mergeProps(buttonProps, focusProps)}
        ref={ref}
        className={`w-full text-left p-5 rounded-2xl border border-[#2a2538] bg-[#1a1724] transition-all duration-300 hover:bg-[#1a1724]/80 hover:border-[#2a2538]/60 ${isExpanded ? 'ring-1 ring-[#72b1b1]/20' : ''} ${isFocusVisible ? 'outline outline-2 outline-offset-2 outline-[#72b1b1]' : ''}`}
        aria-expanded={isExpanded}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-[#72b1b1]">{cap.icon}</div>
            <span className="text-[#f0eaff] font-medium text-sm">{cap.name}</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColorMap[cap.status]} ${statusTextMap[cap.status]} ${statusBgMap[cap.status]} ${statusBorderMap[cap.status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusColorMap[cap.status]} ${cap.status === 'waiting' ? 'animate-pulse' : ''}`} />
            {cap.statusLabel}
          </span>
        </div>
        <p className="text-[#a397b8] text-xs leading-relaxed">{cap.detail}</p>
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-[#2a2538]/50">
            <p className="text-[#a397b8]/70 text-xs">Expanded details for {cap.name} are loading...</p>
          </div>
        )}
      </button>
    );
  }

  // Priority Item Button
  function PriorityButton({ item, onAction }: { item: any; onAction: () => void }) {
    const ref = useRef<HTMLButtonElement>(null);
    const { buttonProps } = useButton({ onPress: onAction }, ref);
    const { focusProps, isFocusVisible } = useFocusRing();

    const colorMap = { green: 'bg-[#72b1b1]', amber: 'bg-[#f59e0b]', red: 'bg-[#ef4444]' };

    return (
      <button
        {...mergeProps(buttonProps, focusProps)}
        ref={ref}
        className={`w-full p-4 rounded-xl border border-[#2a2538] bg-[#1a1724] flex items-start gap-4 transition-all duration-300 hover:bg-[#1a1724]/80 text-left ${isFocusVisible ? 'outline outline-2 outline-offset-2 outline-[#72b1b1]' : ''}`}
      >
        <div className={`w-2 h-2 rounded-full ${colorMap[item.severity]} mt-2 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="text-[#f0eaff] text-sm font-medium mb-1">{item.label}</div>
          <div className="text-[#a397b8] text-xs">{item.description}</div>
        </div>
        <span className="text-[#72b1b1] text-xs font-medium flex-shrink-0 mt-0.5">{item.action} →</span>
      </button>
    );
  }

  // Activity Item
  function ActivityItem({ item }: { item: any }) {
    const ref = useRef<HTMLDivElement>(null);
    const { focusProps, isFocusVisible } = useFocusRing();

    const dotColorMap = { teal: 'bg-[#72b1b1]', rose: 'bg-[#b57f8b]', gold: 'bg-[#e4c58d]' };

    return (
      <div
        {...focusProps}
        ref={ref}
        tabIndex={0}
        role="listitem"
        aria-label={`${item.time}: ${item.label}. ${item.detail}`}
        className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-300 hover:bg-[#1a1724] ${isFocusVisible ? 'outline outline-2 outline-offset-2 outline-[#72b1b1]' : ''}`}
      >
        <div className="flex flex-col items-center pt-1 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${dotColorMap[item.color]}`} />
          <div className="w-px h-full bg-[#2a2538] mt-2" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[#f0eaff] text-sm font-medium">{item.label}</span>
            <span className="text-[#a397b8] text-xs flex-shrink-0">{item.time}</span>
          </div>
          <p className="text-[#a397b8]/70 text-xs">{item.detail}</p>
        </div>
      </div>
    );
  }

  // Mermaid Companion SVG
  const MermaidCompanion = () => (
    <div className="fixed bottom-8 right-8 opacity-[0.06] pointer-events-none" aria-hidden="true">
      <div className="mermaid-glow">
        <svg width="160" height="200" viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="mermaidGlow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#72b1b1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#72b1b1" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="80" cy="100" rx="70" ry="90" fill="url(#mermaidGlow)" />
          <path
            d="M80 15 C65 15, 50 30, 50 50 C50 70, 65 80, 80 95 C95 80, 110 70, 110 50 C110 30, 95 15, 80 15Z"
            stroke="#72b1b1"
            strokeWidth="1"
            fill="none"
            opacity="0.8"
          />
          <circle cx="68" cy="42" r="3" fill="#72b1b1" opacity="0.5" />
          <circle cx="92" cy="42" r="3" fill="#72b1b1" opacity="0.5" />
          <path
            d="M80 95 Q75 120, 65 140 Q55 160, 45 185"
            stroke="#72b1b1"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M80 95 Q85 120, 95 140 Q105 160, 115 185"
            stroke="#72b1b1"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M65 140 Q55 145, 40 142 Q30 140, 20 145"
            stroke="#72b1b1"
            strokeWidth="0.8"
            fill="none"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M95 140 Q105 145, 120 142 Q130 140, 140 145"
            stroke="#72b1b1"
            strokeWidth="0.8"
            fill="none"
            strokeLinecap="round"
            opacity="0.4"
          />
        </svg>
      </div>
    </div>
  );

  // Tab Panel
  function TabPanel({ tabId, children }: { tabId: string; children: React.ReactNode }) {
    return (
      <div
        role="tabpanel"
        id={`panel-${tabId}`}
        aria-labelledby={`tab-${tabId}`}
        tabIndex={0}
        className="outline-none"
      >
        {children}
      </div>
    );
  }

  const overviewContent = (
    <TabPanel tabId="overview">
      <div className="space-y-10">
        {/* Capabilities Grid */}
        <section aria-labelledby="capabilities-heading">
          <h2 id="capabilities-heading" className="text-[#a397b8] text-xs font-semibold uppercase tracking-[0.15em] mb-4">System Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {capabilities.map((cap) => (
              <CardButton
                key={cap.id}
                cap={cap}
                isExpanded={expandedCard === cap.id}
                onToggle={() => setExpandedCard(expandedCard === cap.id ? null : cap.id)}
              />
            ))}
          </div>
        </section>

        {/* Priority Items */}
        <section aria-labelledby="priority-heading">
          <h2 id="priority-heading" className="text-[#a397b8] text-xs font-semibold uppercase tracking-[0.15em] mb-4">What needs you now</h2>
          <div className="space-y-3">
            {priorityItems.map((item) => (
              <PriorityButton
                key={item.id}
                item={item}
                onAction={() => {}}
              />
            ))}
          </div>
        </section>

        {/* Activity Feed */}
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="text-[#a397b8] text-xs font-semibold uppercase tracking-[0.15em] mb-4">Recent Activity</h2>
          <div role="list" aria-label="Recent activity timeline" className="rounded-2xl border border-[#2a2538] bg-[#1a1724] overflow-hidden divide-y divide-[#2a2538]/30">
            {activityTimeline.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      </div>
    </TabPanel>
  );

  const activityContent = (
    <TabPanel tabId="activity">
      <div className="space-y-6">
        <h2 className="text-[#a397b8] text-xs font-semibold uppercase tracking-[0.15em]">Full Activity Log</h2>
        <div role="list" aria-label="Full activity log" className="rounded-2xl border border-[#2a2538] bg-[#1a1724] overflow-hidden divide-y divide-[#2a2538]/30">
          {activityTimeline.map((item) => (
            <ActivityItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </TabPanel>
  );

  const alertsContent = (
    <TabPanel tabId="alerts">
      <div className="space-y-6">
        <h2 className="text-[#a397b8] text-xs font-semibold uppercase tracking-[0.15em]">Active Alerts</h2>
        {alerts.filter(a => !dismissedAlerts.includes(a.id)).length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-[#2a2538] bg-[#1a1724]">
            <div className="text-[#72b1b1] text-3xl mb-3">✓</div>
            <p className="text-[#a397b8] text-sm">All clear — no active alerts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.filter(a => !dismissedAlerts.includes(a.id)).map((alert) => {
              const ref = useRef<HTMLButtonElement>(null);
              const { buttonProps } = useButton(
                {
                  onPress: () => setDismissedAlerts([...dismissedAlerts, alert.id]),
                },
                ref
              );
              const { focusProps, isFocusVisible } = useFocusRing();
              const colorMap = { red: 'border-l-[#ef4444]', amber: 'border-l-[#f59e0b]', green: 'border-l-[#72b1b1]' };
              const dotMap = { red: 'bg-[#ef4444]', amber: 'bg-[#f59e0b]', green: 'bg-[#72b1b1]' };

              return (
                <div
                  key={alert.id}
                  className={`p-5 rounded-2xl border border-[#2a2538] border-l-4 ${colorMap[alert.severity]} bg-[#1a1724] transition-all duration-300 hover:bg-[#1a1724]/80`}
                  role="alert"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className={`w-2 h-2 rounded-full ${dotMap[alert.severity]} mt-2 flex-shrink-0 animate-pulse`} />
                    <h3 className="text-[#f0eaff] text-sm font-medium flex-1">{alert.title}</h3>
                  </div>
                  <p className="text-[#a397b8] text-xs leading-relaxed ml-5 mb-4">{alert.detail}</p>
                  <div className="flex gap-2 ml-5">
                    <button
                      {...mergeProps(buttonProps, focusProps)}
                      ref={ref}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg bg-[#2a2538] text-[#f0eaff] hover:bg-[#2a2538]/80 transition-all duration-200 ${isFocusVisible ? 'outline outline-2 outline-offset-2 outline-[#72b1b1]' : ''}`}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TabPanel>
  );

  // Tab List
  const tabListRef = useRef<HTMLDivElement>(null);

  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-[#0a0810] text-[#f0eaff] font-sans flex flex-col relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        /* Tailwind CDN reference — not executed, for reference only:
        <script src="https://cdn.tailwindcss.com"></script>
        */

        @keyframes mermaid-pulse {
          0%, 100% { opacity: 0.06; transform: scale(1) translateY(0); }
          50% { opacity: 0.1; transform: scale(1.03) translateY(-2px); }
        }

        @keyframes mermaid-glow-pulse {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(114, 177, 177, 0.15)); }
          50% { filter: drop-shadow(0 0 16px rgba(114, 177, 177, 0.3)); }
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .mermaid-glow {
          animation: mermaid-pulse 6s ease-in-out infinite, mermaid-glow-pulse 6s ease-in-out infinite;
        }

        .tab-content-enter {
          animation: fade-in-up 0.3s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .mermaid-glow,
          .animate-pulse {
            animation: none !important;
          }
          .tab-content-enter {
            animation: none !important;
            opacity: 1;
            transform: none;
          }
          * {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }

        body {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #0a0810;
        }
        ::-webkit-scrollbar-thumb {
          background: #2a2538;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #3a3548;
        }

        :focus-visible {
          outline: 2px solid #72b1b1;
          outline-offset: 2px;
          border-radius: 4px;
        }
      `}} />

      {/* Ambient Background Gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 600px 400px at 85% 80%, rgba(114,177,177,0.04) 0%, transparent 70%), radial-gradient(ellipse 400px 300px at 15% 20%, rgba(181,127,139,0.03) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Mermaid Companion */}
      <MermaidCompanion />

      {/* Header */}
      <header className="relative z-10 px-5 sm:px-8 lg:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.4)]" />
            <h1 className="text-[#f0eaff] text-lg sm:text-xl font-semibold tracking-tight">
              Good morning, Rylee
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#72b1b1] to-[#5a8f8f] flex items-center justify-center text-[#0a0810] text-sm font-bold">
            R
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 px-5 sm:px-8 lg:px-10 pb-8 max-w-6xl w-full mx-auto">
        {/* Tab Navigation */}
        <nav
          role="tablist"
          aria-label="Dashboard sections"
          ref={tabListRef}
          className="flex items-center gap-1 mb-8 p-1 rounded-2xl bg-[#12101a] border border-[#2a2538]/50 w-fit"
        >
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onSelect={() => setActiveTab(tab.id)}
            />
          ))}
        </nav>

        {/* Tab Content */}
        <div className="tab-content-enter" key={activeTab}>
          {activeTab === 'overview' && overviewContent}
          {activeTab === 'activity' && activityContent}
          {activeTab === 'alerts' && alertsContent}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-5 sm:px-8 lg:px-10 py-5 flex items-center justify-between">
        <span className="text-[#a397b8] text-sm font-medium tracking-wide">Rylee</span>
        <div className="h-px flex-1 mx-5 bg-gradient-to-r from-[#72b1b1]/30 via-[#72b1b1]/10 to-transparent" />
        <span className="text-[#a397b8]/50 text-xs">Project Worlds</span>
      </footer>
    </div>
  );
};

export default Dashboard;