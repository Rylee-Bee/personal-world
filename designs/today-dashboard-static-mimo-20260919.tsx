import React from 'react';

// Reference for CDN link (not executed in this file):
// <script src="https://cdn.tailwindcss.com"></script>

const DesignTokens = {
  canvas: '#0a0810',
  panel: '#12101a',
  elevated: '#1a1724',
  border: '#2a2538',
  textPrimary: '#f0eaff',
  textSecondary: '#a397b8',
  accentTeal: '#72b1b1',
  rose: '#b57f8b',
  gold: '#e4c58d',
};

const StatusBadge: React.FC<{
  status: 'healthy' | 'waiting' | 'unavailable';
  label: string;
}> = ({ status, label }) => {
  const colors = {
    healthy: 'bg-green-500/20 text-green-400',
    waiting: 'bg-amber-500/20 text-amber-400',
    unavailable: 'bg-red-500/20 text-red-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[status]}`}
      aria-label={`${label} status: ${status}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'healthy' ? 'bg-green-400' :
        status === 'waiting' ? 'bg-amber-400' : 'bg-red-400'
      }`} />
      {label}
    </span>
  );
};

const PriorityItem: React.FC<{
  title: string;
  description: string;
  due?: string;
  priority: 'high' | 'medium' | 'low';
}> = ({ title, description, due, priority }) => {
  const priorityColors = {
    high: 'border-l-rose',
    medium: 'border-l-gold',
    low: 'border-l-accentTeal',
  };

  return (
    <div
      className={`p-4 bg-[#1a1724] rounded-lg border-l-4 ${priorityColors[priority]} hover:bg-[#221f30] transition-colors`}
      role="article"
      aria-label={`Priority item: ${title}`}
    >
      <h3 className="text-[#f0eaff] font-medium mb-1">{title}</h3>
      <p className="text-[#a397b8] text-sm mb-2">{description}</p>
      {due && (
        <span className="text-xs text-[#e4c58d] font-medium">Due: {due}</span>
      )}
    </div>
  );
};

const ActivityItem: React.FC<{
  title: string;
  description: string;
  timestamp: string;
  type: 'commit' | 'deploy' | 'alert' | 'comment';
}> = ({ title, description, timestamp, type }) => {
  const typeIcons: Record<string, string> = {
    commit: '↳',
    deploy: '⚡',
    alert: '⚠',
    comment: '💬',
  };

  return (
    <div className="flex gap-3" role="listitem">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2a2538] flex items-center justify-center text-[#72b1b1]">
        {typeIcons[type]}
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <h4 className="text-[#f0eaff] text-sm font-medium">{title}</h4>
          <span className="text-[#a397b8] text-xs">{timestamp}</span>
        </div>
        <p className="text-[#a397b8] text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
};

const MermaidShape: React.FC = () => (
  <div 
    className="fixed bottom-20 left-4 w-32 h-32 opacity-10 pointer-events-none z-0"
    aria-hidden="true"
  >
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M 50,10 C 70,25 80,40 75,60 C 70,80 55,90 45,85 C 35,80 25,60 30,40 C 35,20 30,10 50,10 Z"
        fill="none"
        stroke="#72b1b1"
        strokeWidth="1"
        filter="url(#glow)"
        className="mermaid-pulse"
      />
      <circle cx="50" cy="10" r="2" fill="#72b1b1" className="mermaid-pulse" />
      <circle cx="75" cy="60" r="2" fill="#72b1b1" className="mermaid-pulse" />
      <circle cx="45" cy="85" r="2" fill="#72b1b1" className="mermaid-pulse" />
      <circle cx="30" cy="40" r="2" fill="#72b1b1" className="mermaid-pulse" />
    </svg>
  </div>
);

const TabBar: React.FC = () => (
  <nav 
    className="bg-[#12101a] border-t border-[#2a2538] mt-auto"
    aria-label="Main navigation"
  >
    <div className="max-w-4xl mx-auto px-4">
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        <details className="group flex-1 min-w-[120px]" open>
          <summary className="cursor-pointer p-3 rounded-lg bg-[#1a1724] text-[#f0eaff] font-medium text-center focus-within:ring-2 focus-within:ring-[#72b1b1] focus-within:ring-offset-2 focus-within:ring-offset-[#0a0810]">
            Overview
          </summary>
        </details>
        <details className="group flex-1 min-w-[120px]">
          <summary className="cursor-pointer p-3 rounded-lg hover:bg-[#1a1724] text-[#a397b8] hover:text-[#f0eaff] font-medium text-center transition-colors focus-within:ring-2 focus-within:ring-[#72b1b1] focus-within:ring-offset-2 focus-within:ring-offset-[#0a0810]">
            Activity
          </summary>
        </details>
        <details className="group flex-1 min-w-[120px]">
          <summary className="cursor-pointer p-3 rounded-lg hover:bg-[#1a1724] text-[#a397b8] hover:text-[#f0eaff] font-medium text-center transition-colors focus-within:ring-2 focus-within:ring-[#72b1b1] focus-within:ring-offset-2 focus-within:ring-offset-[#0a0810]">
            Alerts
          </summary>
        </details>
      </div>
    </div>
  </nav>
);

const ProjectWorldsTodayDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0810] text-[#f0eaff] flex flex-col font-sans">
      <style>{`
        @keyframes mermaid-pulse {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.3; }
        }
        @keyframes ambient-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes gentle-glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.2); }
        }
        .mermaid-pulse {
          animation: mermaid-pulse 4s ease-in-out infinite;
        }
        .ambient-float {
          animation: ambient-float 6s ease-in-out infinite;
        }
        .gentle-glow {
          animation: gentle-glow 8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .mermaid-pulse,
          .ambient-float,
          .gentle-glow {
            animation: none;
          }
          * {
            transition: none !important;
          }
        }
        :focus-visible {
          outline: 2px solid #72b1b1;
          outline-offset: 2px;
        }
      `}</style>

      <MermaidShape />

      <header className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold text-[#f0eaff] mb-1">
            Good morning, Rylee
          </h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            <span className="text-[#a397b8] text-sm">All systems operational</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Capability Cards */}
          <section aria-labelledby="capabilities-heading">
            <h2 id="capabilities-heading" className="text-lg font-medium text-[#f0eaff] mb-4">
              System Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#12101a] rounded-xl border border-[#2a2538] ambient-float">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-[#f0eaff]">Source Control</h3>
                  <StatusBadge status="healthy" label="Healthy" />
                </div>
                <p className="text-sm text-[#a397b8]">Git repository system</p>
              </div>

              <div className="p-4 bg-[#12101a] rounded-xl border border-[#2a2538] ambient-float" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-[#f0eaff]">Identity Provider</h3>
                  <StatusBadge status="waiting" label="Waiting" />
                </div>
                <p className="text-sm text-[#a397b8]">Authentication services</p>
              </div>

              <div className="p-4 bg-[#12101a] rounded-xl border border-[#2a2538] ambient-float" style={{ animationDelay: '1s' }}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-[#f0eaff]">Discovery Feed</h3>
                  <StatusBadge status="healthy" label="Healthy" />
                </div>
                <p className="text-sm text-[#a397b8]">Content discovery engine</p>
              </div>

              <div className="p-4 bg-[#12101a] rounded-xl border border-[#2a2538] ambient-float" style={{ animationDelay: '1.5s' }}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-[#f0eaff]">Deployment Pipeline</h3>
                  <StatusBadge status="unavailable" label="Unavailable" />
                </div>
                <p className="text-sm text-[#a397b8]">CI/CD infrastructure</p>
              </div>
            </div>
          </section>

          {/* What needs you now */}
          <section aria-labelledby="priority-heading">
            <h2 id="priority-heading" className="text-lg font-medium text-[#f0eaff] mb-4">
              What needs you now
            </h2>
            <div className="space-y-3">
              <PriorityItem
                title="Merge PR #427 to main"
                description="Security patch for authentication module"
                due="Today, 2:00 PM"
                priority="high"
              />
              <PriorityItem
                title="Review staging deployment"
                description="New feature requires approval before production"
                due="Tomorrow, 10:00 AM"
                priority="medium"
              />
              <PriorityItem
                title="Update documentation"
                description="API endpoints for v2.3 need documentation"
                due="Friday"
                priority="low"
              />
            </div>
          </section>

          {/* Recent Activity */}
          <section aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="text-lg font-medium text-[#f0eaff] mb-4">
              Recent Activity
            </h2>
            <div className="space-y-4" role="list">
              <ActivityItem
                title="Merged pull request #425"
                description="Updated dependency versions for security"
                timestamp="2 hours ago"
                type="commit"
              />
              <ActivityItem
                title="Deployment to staging"
                description="Version 2.3.1 successfully deployed"
                timestamp="5 hours ago"
                type="deploy"
              />
              <ActivityItem
                title="System alert resolved"
                description="High memory usage on worker nodes"
                timestamp="Yesterday"
                type="alert"
              />
              <ActivityItem
                title="Comment on issue #198"
                description="Suggested solution for performance bottleneck"
                timestamp="2 days ago"
                type="comment"
              />
              <ActivityItem
                title="Branch created"
                description="feature/user-analytics-dashboard"
                timestamp="3 days ago"
                type="commit"
              />
            </div>
          </section>
        </div>
      </main>

      <TabBar />

      <footer className="p-4 bg-[#12101a] border-t border-[#2a2538]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-[#a397b8] text-sm">Rylee</span>
          <div className="flex-1 mx-6 h-px bg-gradient-to-r from-[#72b1b1] via-[#b57f8b] to-[#e4c58d] opacity-50"></div>
          <span className="text-[#a397b8] text-xs">Project Worlds v2.5</span>
        </div>
      </footer>
    </div>
  );
};

export default ProjectWorldsTodayDashboard;