import React from "react";
import { Link } from "react-aria-components";

// Tailwind CDN reference only: <script src="https://cdn.tailwindcss.com"></script>

type CapabilityStatus = "healthy" | "waiting" | "unavailable";

export interface ProjectWorldsTodayDashboardProps {
  greetingName?: string;
  footerName?: string;
}

const capabilities: Array<{
  name: string;
  description: string;
  status: CapabilityStatus;
  detail: string;
  icon: string;
}> = [
  {
    name: "Source Control",
    description: "Repositories and change tracking",
    status: "healthy",
    detail: "All repositories synchronized",
    icon: "SC",
  },
  {
    name: "Identity Provider",
    description: "Authentication and access",
    status: "healthy",
    detail: "Services responding normally",
    icon: "ID",
  },
  {
    name: "Discovery Feed",
    description: "Signals from across your worlds",
    status: "waiting",
    detail: "3 sources awaiting review",
    icon: "DF",
  },
  {
    name: "Deployment Pipeline",
    description: "Build and release automation",
    status: "unavailable",
    detail: "Runner connection interrupted",
    icon: "DP",
  },
];

const priorities = [
  {
    title: "Review deployment runner",
    description: "The production runner stopped responding after its last health check.",
    meta: "Deployment Pipeline",
    urgency: "High priority",
    color: "rose",
  },
  {
    title: "Resolve discovery requests",
    description: "Three new sources are ready for approval and categorization.",
    meta: "Discovery Feed",
    urgency: "Waiting",
    color: "gold",
  },
  {
    title: "Confirm tomorrow’s release",
    description: "The release candidate is prepared and needs a final readiness check.",
    meta: "Source Control",
    urgency: "Today",
    color: "teal",
  },
] as const;

const activity = [
  {
    title: "Release candidate prepared",
    detail: "project-worlds/dashboard · build 184",
    time: "8 min ago",
    tone: "teal",
  },
  {
    title: "Access policy synchronized",
    detail: "12 identities checked successfully",
    time: "24 min ago",
    tone: "teal",
  },
  {
    title: "Discovery source submitted",
    detail: "Design systems weekly digest",
    time: "1 hr ago",
    tone: "gold",
  },
  {
    title: "Production runner disconnected",
    detail: "Automatic reconnect is pending",
    time: "2 hrs ago",
    tone: "rose",
  },
  {
    title: "Repository snapshot completed",
    detail: "All tracked projects archived",
    time: "Yesterday",
    tone: "teal",
  },
] as const;

const alerts = [
  {
    title: "Production runner unavailable",
    detail: "Deployment jobs will remain queued until the runner reconnects.",
    severity: "Action needed",
    color: "rose",
  },
  {
    title: "Discovery review pending",
    detail: "Three submitted sources are waiting for your approval.",
    severity: "Review",
    color: "gold",
  },
] as const;

const statusStyles: Record<
  CapabilityStatus,
  { badge: string; dot: string; label: string }
> = {
  healthy: {
    badge: "border-[#72b1b1]/30 bg-[#72b1b1]/10 text-[#9ad0d0]",
    dot: "bg-[#72b1b1] shadow-[0_0_8px_rgba(114,177,177,0.65)]",
    label: "Healthy",
  },
  waiting: {
    badge: "border-[#e4c58d]/30 bg-[#e4c58d]/10 text-[#e4c58d]",
    dot: "bg-[#e4c58d] shadow-[0_0_8px_rgba(228,197,141,0.55)]",
    label: "Waiting",
  },
  unavailable: {
    badge: "border-[#b57f8b]/35 bg-[#b57f8b]/10 text-[#dba5b0]",
    dot: "bg-[#b57f8b] shadow-[0_0_8px_rgba(181,127,139,0.55)]",
    label: "Unavailable",
  },
};

export default function ProjectWorldsTodayDashboard({
  greetingName = "Rylee",
  footerName = "Rylee",
}: ProjectWorldsTodayDashboardProps) {
  return (
    <div className="min-h-screen bg-[#0a0810] text-[#f0eaff] selection:bg-[#72b1b1]/30">
      <style>{`
        @keyframes mermaidPulse {
          0%, 100% { opacity: .18; transform: scale(.96) rotate(-2deg); }
          50% { opacity: .32; transform: scale(1.035) rotate(2deg); }
        }

        @keyframes ambientDrift {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(-12px, 8px, 0); }
        }

        @keyframes statusBreathe {
          0%, 100% { opacity: .72; }
          50% { opacity: 1; }
        }

        .mermaid-pulse {
          animation: mermaidPulse 7s ease-in-out infinite;
          transform-origin: center;
        }

        .ambient-drift {
          animation: ambientDrift 12s ease-in-out infinite;
        }

        .status-breathe {
          animation: statusBreathe 2.8s ease-in-out infinite;
        }

        .dashboard-panel {
          display: none;
        }

        #overview {
          display: block;
        }

        #activity:target,
        #alerts:target {
          display: block;
        }

        body:has(#activity:target) #overview,
        body:has(#alerts:target) #overview {
          display: none;
        }

        .dashboard-tab {
          color: #a397b8;
          border-color: transparent;
        }

        .dashboard-tab:hover,
        .dashboard-tab:focus-visible {
          color: #f0eaff;
          border-color: rgba(114, 177, 177, .45);
        }

        body:not(:has(#activity:target)):not(:has(#alerts:target))
          .dashboard-tab[href="#overview"],
        body:has(#activity:target) .dashboard-tab[href="#activity"],
        body:has(#alerts:target) .dashboard-tab[href="#alerts"] {
          color: #f0eaff;
          border-color: #72b1b1;
          background: rgba(114, 177, 177, .08);
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="ambient-drift pointer-events-none fixed -right-24 top-20 h-80 w-80 rounded-full bg-[#72b1b1]/[0.045] blur-[90px]"
      />

      <div className="relative flex min-h-screen flex-col">
        <header className="border-b border-[#2a2538] bg-[#0a0810]/90 px-4 py-5 backdrop-blur-xl sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-5">
            <div>
              <div className="mb-1 flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="status-breathe h-2 w-2 rounded-full bg-[#72b1b1] shadow-[0_0_10px_rgba(114,177,177,0.75)]"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#72b1b1]">
                  Worlds online
                </span>
              </div>
              <h1 className="text-xl font-semibold tracking-[-0.025em] text-[#f0eaff] sm:text-2xl">
                Good morning, {greetingName}
              </h1>
            </div>

            <div className="hidden text-right sm:block">
              <p className="text-xs uppercase tracking-[0.18em] text-[#a397b8]">
                Today
              </p>
              <p className="mt-1 text-sm font-medium text-[#f0eaff]">
                Saturday, September 19
              </p>
            </div>
          </div>
        </header>

        <nav
          aria-label="Dashboard views"
          className="sticky top-0 z-30 border-b border-[#2a2538] bg-[#0a0810]/95 px-4 backdrop-blur-xl sm:px-6 lg:px-10"
        >
          <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto">
            {[
              ["Overview", "#overview"],
              ["Activity", "#activity"],
              ["Alerts", "#alerts"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-controls={href.slice(1)}
                className="dashboard-tab min-w-fit border-b-2 px-4 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810]"
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <section
            id="overview"
            aria-labelledby="overview-heading"
            className="dashboard-panel scroll-mt-20"
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-8">
                <section aria-labelledby="overview-heading">
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#72b1b1]">
                        System landscape
                      </p>
                      <h2
                        id="overview-heading"
                        className="text-lg font-semibold tracking-[-0.02em] sm:text-xl"
                      >
                        Today Dashboard
                      </h2>
                    </div>
                    <span className="text-xs text-[#a397b8]">4 capabilities</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {capabilities.map((capability) => {
                      const status = statusStyles[capability.status];

                      return (
                        <article
                          key={capability.name}
                          className="group rounded-2xl border border-[#2a2538] bg-[#12101a] p-5 transition-colors hover:border-[#72b1b1]/40 hover:bg-[#1a1724] focus-within:border-[#72b1b1]/50"
                        >
                          <div className="mb-6 flex items-start justify-between gap-4">
                            <span
                              aria-hidden="true"
                              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a2538] bg-[#1a1724] text-[11px] font-bold tracking-[0.08em] text-[#72b1b1]"
                            >
                              {capability.icon}
                            </span>

                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.badge}`}
                            >
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                              />
                              {status.label}
                            </span>
                          </div>

                          <h3 className="font-semibold text-[#f0eaff]">
                            {capability.name}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-[#a397b8]">
                            {capability.description}
                          </p>
                          <p className="mt-4 border-t border-[#2a2538] pt-3 text-xs text-[#a397b8]">
                            {capability.detail}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section aria-labelledby="needs-heading">
                  <div className="mb-4 flex items-center justify-between">
                    <h2
                      id="needs-heading"
                      className="text-lg font-semibold tracking-[-0.02em]"
                    >
                      What needs you now
                    </h2>
                    <span className="rounded-full border border-[#2a2538] bg-[#12101a] px-2.5 py-1 text-xs text-[#a397b8]">
                      {priorities.length} items
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[#2a2538] bg-[#12101a]">
                    {priorities.map((item, index) => {
                      const color =
                        item.color === "rose"
                          ? {
                              dot: "bg-[#b57f8b]",
                              label: "text-[#dba5b0]",
                            }
                          : item.color === "gold"
                            ? {
                                dot: "bg-[#e4c58d]",
                                label: "text-[#e4c58d]",
                              }
                            : {
                                dot: "bg-[#72b1b1]",
                                label: "text-[#9ad0d0]",
                              };

                      return (
                        <details
                          key={item.title}
                          className="group border-b border-[#2a2538] last:border-b-0 open:bg-[#1a1724]"
                        >
                          <summary className="flex cursor-pointer list-none items-start gap-4 p-4 outline-none transition-colors hover:bg-[#1a1724] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#72b1b1] sm:p-5 [&::-webkit-details-marker]:hidden">
                            <span
                              aria-hidden="true"
                              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${color.dot}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                                <span className="font-medium text-[#f0eaff]">
                                  {item.title}
                                </span>
                                <span
                                  className={`text-xs font-semibold ${color.label}`}
                                >
                                  {item.urgency}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs text-[#a397b8]">
                                {item.meta}
                              </span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="mt-1 text-[#a397b8] transition-transform group-open:rotate-45"
                            >
                              +
                            </span>
                          </summary>
                          <div className="px-10 pb-5 text-sm leading-6 text-[#a397b8] sm:px-11">
                            {item.description}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </section>
              </div>

              <aside
                aria-labelledby="recent-heading"
                className="relative overflow-hidden rounded-2xl border border-[#2a2538] bg-[#12101a] p-5 sm:p-6"
              >
                <div
                  aria-hidden="true"
                  className="mermaid-pulse pointer-events-none absolute -bottom-16 -right-12 opacity-20"
                >
                  <svg
                    viewBox="0 0 260 300"
                    className="h-72 w-64 text-[#72b1b1] drop-shadow-[0_0_24px_rgba(114,177,177,0.28)]"
                    fill="none"
                  >
                    <path
                      d="M131 38c31 5 53 32 49 64-3 22-18 39-36 50 13 12 31 19 49 19-8 18-28 27-47 23 7 21 22 39 43 49-20 12-47 3-59-16-14 20-40 27-61 14 21-9 38-26 46-47-20 4-40-6-47-25 19 1 37-6 51-18-18-12-31-31-32-53-2-34 13-58 44-60Z"
                      fill="currentColor"
                      fillOpacity=".12"
                      stroke="currentColor"
                      strokeOpacity=".42"
                    />
                    <path
                      d="M111 96c5-8 12-12 20-12s15 4 20 12M104 122c17 13 37 13 54 0M130 153v73M130 176c-18 4-31 15-38 34M130 176c18 4 31 15 38 34"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeOpacity=".5"
                    />
                    <circle cx="112" cy="108" r="3" fill="currentColor" />
                    <circle cx="149" cy="108" r="3" fill="currentColor" />
                  </svg>
                </div>

                <div className="relative">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#72b1b1]">
                    Across your worlds
                  </p>
                  <h2
                    id="recent-heading"
                    className="text-lg font-semibold tracking-[-0.02em]"
                  >
                    Recent Activity
                  </h2>

                  <ol className="mt-6 space-y-0">
                    {activity.map((item, index) => {
                      const dot =
                        item.tone === "rose"
                          ? "border-[#b57f8b] bg-[#b57f8b]"
                          : item.tone === "gold"
                            ? "border-[#e4c58d] bg-[#e4c58d]"
                            : "border-[#72b1b1] bg-[#72b1b1]";

                      return (
                        <li
                          key={`${item.title}-${item.time}`}
                          className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-3 pb-6 last:pb-0"
                        >
                          {index < activity.length - 1 && (
                            <span
                              aria-hidden="true"
                              className="absolute left-[7px] top-3 h-full w-px bg-[#2a2538]"
                            />
                          )}
                          <span
                            aria-hidden="true"
                            className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full border-2 shadow-[0_0_0_4px_#12101a] ${dot}`}
                          />
                          <div>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h3 className="text-sm font-medium text-[#f0eaff]">
                                {item.title}
                              </h3>
                              <time className="text-[11px] text-[#a397b8]">
                                {item.time}
                              </time>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[#a397b8]">
                              {item.detail}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </aside>
            </div>
          </section>

          <section
            id="activity"
            aria-labelledby="activity-heading"
            className="dashboard-panel scroll-mt-20"
          >
            <div className="mx-auto max-w-3xl">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#72b1b1]">
                Across your worlds
              </p>
              <h2
                id="activity-heading"
                className="text-xl font-semibold tracking-[-0.02em]"
              >
                Activity
              </h2>

              <ol className="mt-6 overflow-hidden rounded-2xl border border-[#2a2538] bg-[#12101a]">
                {activity.map((item) => (
                  <li
                    key={`${item.title}-full`}
                    className="flex gap-4 border-b border-[#2a2538] p-5 last:border-b-0 hover:bg-[#1a1724]"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        item.tone === "rose"
                          ? "bg-[#b57f8b]"
                          : item.tone === "gold"
                            ? "bg-[#e4c58d]"
                            : "bg-[#72b1b1]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col justify-between gap-1 sm:flex-row">
                        <h3 className="font-medium">{item.title}</h3>
                        <time className="text-xs text-[#a397b8]">
                          {item.time}
                        </time>
                      </div>
                      <p className="mt-1 text-sm text-[#a397b8]">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section
            id="alerts"
            aria-labelledby="alerts-heading"
            className="dashboard-panel scroll-mt-20"
          >
            <div className="mx-auto max-w-3xl">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#72b1b1]">
                Attention queue
              </p>
              <h2
                id="alerts-heading"
                className="text-xl font-semibold tracking-[-0.02em]"
              >
                Alerts
              </h2>

              <div className="mt-6 space-y-3">
                {alerts.map((alert) => (
                  <article
                    key={alert.title}
                    className="rounded-2xl border border-[#2a2538] bg-[#12101a] p-5 hover:bg-[#1a1724]"
                  >
                    <div className="flex items-start gap-4">
                      <span
                        aria-hidden="true"
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                          alert.color === "rose"
                            ? "bg-[#b57f8b] shadow-[0_0_9px_rgba(181,127,139,0.55)]"
                            : "bg-[#e4c58d] shadow-[0_0_9px_rgba(228,197,141,0.45)]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                          <h3 className="font-medium">{alert.title}</h3>
                          <span
                            className={`text-xs font-semibold ${
                              alert.color === "rose"
                                ? "text-[#dba5b0]"
                                : "text-[#e4c58d]"
                            }`}
                          >
                            {alert.severity}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#a397b8]">
                          {alert.detail}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-[#2a2538] px-4 py-5 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3">
            <span className="h-px w-10 bg-[#72b1b1] shadow-[0_0_8px_rgba(114,177,177,0.45)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a397b8]">
              {footerName}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}