import React, { useRef, useState } from "react";
import { useButton } from "react-aria";
import {
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type Key,
} from "react-aria-components";

// Tailwind CDN reference only: <script src="https://cdn.tailwindcss.com"></script>

type Status = "healthy" | "waiting" | "unavailable";

type Capability = {
  id: string;
  name: string;
  description: string;
  status: Status;
  detail: string;
  metric: string;
};

const capabilities: Capability[] = [
  {
    id: "source-control",
    name: "Source Control",
    description: "Repositories, branches, and reviews",
    status: "healthy",
    detail: "All repositories are reachable. Two pull requests are ready for review.",
    metric: "2 reviews",
  },
  {
    id: "identity-provider",
    name: "Identity Provider",
    description: "Authentication and access",
    status: "waiting",
    detail: "A pending access request needs approval before the next deployment window.",
    metric: "1 request",
  },
  {
    id: "discovery-feed",
    name: "Discovery Feed",
    description: "Signals, ideas, and incoming work",
    status: "healthy",
    detail: "The feed is current. Three new signals match active project worlds.",
    metric: "3 signals",
  },
  {
    id: "deployment-pipeline",
    name: "Deployment Pipeline",
    description: "Builds, checks, and releases",
    status: "unavailable",
    detail: "The staging runner stopped responding 18 minutes ago. Production is unaffected.",
    metric: "1 blocked",
  },
];

const priorities = [
  {
    title: "Restore the staging runner",
    context: "Deployment Pipeline",
    detail: "A release candidate is waiting for staging verification.",
    tone: "rose",
  },
  {
    title: "Review two pull requests",
    context: "Source Control",
    detail: "Both passed automated checks and are ready for a decision.",
    tone: "gold",
  },
  {
    title: "Approve workspace access",
    context: "Identity Provider",
    detail: "One collaborator is waiting for project access.",
    tone: "teal",
  },
] as const;

const activity = [
  {
    title: "Release candidate built",
    detail: "Project Atlas · build 284",
    time: "8m ago",
  },
  {
    title: "Staging runner became unavailable",
    detail: "Deployment Pipeline",
    time: "18m ago",
  },
  {
    title: "Pull request checks passed",
    detail: "Project Hearth · PR #142",
    time: "36m ago",
  },
  {
    title: "Discovery signal added",
    detail: "Research note linked to Project Tide",
    time: "1h ago",
  },
  {
    title: "Workspace access requested",
    detail: "Identity Provider",
    time: "2h ago",
  },
];

const alerts = [
  {
    title: "Staging deployment is blocked",
    detail: "The staging runner is unavailable and needs investigation.",
    status: "unavailable" as Status,
  },
  {
    title: "Access approval is waiting",
    detail: "One workspace request has been pending for two hours.",
    status: "waiting" as Status,
  },
];

const statusStyles: Record<
  Status,
  { dot: string; badge: string; label: string }
> = {
  healthy: {
    dot: "bg-[#72b1b1]",
    badge: "border-[#72b1b1]/30 bg-[#72b1b1]/10 text-[#9bd0d0]",
    label: "Healthy",
  },
  waiting: {
    dot: "bg-[#e4c58d]",
    badge: "border-[#e4c58d]/30 bg-[#e4c58d]/10 text-[#e4c58d]",
    label: "Waiting",
  },
  unavailable: {
    dot: "bg-[#b57f8b]",
    badge: "border-[#b57f8b]/30 bg-[#b57f8b]/10 text-[#d9a3af]",
    label: "Unavailable",
  },
};

function CapabilityCard({
  capability,
  expanded,
  onToggle,
}: {
  capability: Capability;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps, isPressed } = useButton(
    {
      onPress: onToggle,
      "aria-expanded": expanded,
      "aria-controls": `${capability.id}-details`,
    },
    ref,
  );

  const status = statusStyles[capability.status];

  return (
    <button
      {...buttonProps}
      ref={ref}
      type="button"
      className={[
        "group w-full rounded-2xl border bg-[#12101a] p-5 text-left",
        "transition-all duration-300 motion-reduce:transition-none",
        "hover:-translate-y-0.5 hover:border-[#72b1b1]/50 hover:bg-[#1a1724]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810]",
        expanded
          ? "border-[#72b1b1]/50 bg-[#1a1724] shadow-[0_18px_50px_rgba(0,0,0,0.25)]"
          : "border-[#2a2538]",
        isPressed ? "scale-[0.99]" : "",
      ].join(" ")}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-base font-semibold text-[#f0eaff]">
            {capability.name}
          </span>
          <span className="mt-1 block text-sm leading-6 text-[#a397b8]">
            {capability.description}
          </span>
        </span>

        <span
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${status.badge}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
          />
          {status.label}
        </span>
      </span>

      <span className="mt-6 flex items-center justify-between gap-4">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-[#a397b8]">
          {capability.metric}
        </span>
        <span
          aria-hidden="true"
          className={`text-[#72b1b1] transition-transform duration-300 motion-reduce:transition-none ${
            expanded ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </span>

      <span
        id={`${capability.id}-details`}
        className={[
          "grid overflow-hidden transition-all duration-300 motion-reduce:transition-none",
          expanded
            ? "mt-4 grid-rows-[1fr] opacity-100"
            : "mt-0 grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <span className="min-h-0">
          <span className="block border-t border-[#2a2538] pt-4 text-sm leading-6 text-[#a397b8]">
            {capability.detail}
          </span>
        </span>
      </span>
    </button>
  );
}

function MermaidCompanion() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-10 right-0 hidden h-64 w-48 overflow-hidden opacity-30 lg:block"
    >
      <div className="mermaid-pulse absolute inset-0 bg-[radial-gradient(circle_at_70%_55%,rgba(114,177,177,0.2),transparent_58%)]" />
      <svg
        viewBox="0 0 180 260"
        className="absolute bottom-0 right-[-38px] h-64 w-44 text-[#72b1b1]"
        fill="none"
      >
        <path
          d="M115 50c-21 5-36 24-36 46 0 19 10 33 24 43-5 20-17 37-35 51 17 1 33-5 45-15 0 21 8 39 23 53-2-18 4-36 17-49-2 18 4 34 18 47-1-28 4-52 16-72 8-14 10-31 5-46-7-25-31-40-57-38Z"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeOpacity="0.24"
        />
        <path
          d="M96 84c10-9 25-13 39-9M93 103c12 4 25 3 36-3M113 139c13 8 29 9 43 3"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeLinecap="round"
        />
        <circle cx="117" cy="94" r="2.5" fill="currentColor" fillOpacity="0.5" />
      </svg>
    </div>
  );
}

export default function ProjectWorldsTodayDashboard() {
  const [selectedTab, setSelectedTab] = useState<Key>("overview");
  const [expandedCard, setExpandedCard] = useState<string | null>(
    "deployment-pipeline",
  );

  return (
    <div className="min-h-screen bg-[#0a0810] font-sans text-[#f0eaff]">
      <style>{`
        @keyframes mermaidPulse {
          0%, 100% { opacity: 0.45; transform: scale(0.98); }
          50% { opacity: 0.8; transform: scale(1.03); }
        }

        .mermaid-pulse {
          animation: mermaidPulse 7s ease-in-out infinite;
          transform-origin: center;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div className="relative flex min-h-screen flex-col overflow-hidden">
        <header className="border-b border-[#2a2538] bg-[#0a0810]/90">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 py-6 sm:px-8 lg:px-10">
            <div>
              <div className="flex items-center gap-3">
                <span
                  aria-label="Workspace online"
                  className="h-2.5 w-2.5 rounded-full bg-[#72b1b1] shadow-[0_0_14px_rgba(114,177,177,0.7)]"
                />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a397b8]">
                  Project Worlds
                </p>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[#f0eaff] sm:text-3xl">
                Good morning, Rylee
              </h1>
            </div>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-[#f0eaff]">Today</p>
              <p className="mt-1 text-xs text-[#a397b8]">
                Four worlds in view
              </p>
            </div>
          </div>
        </header>

        <main className="relative mx-auto flex w-full max-w-7xl flex-1 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
          <MermaidCompanion />

          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={setSelectedTab}
            className="relative z-10 w-full"
          >
            <TabList
              aria-label="Dashboard views"
              className="mb-8 flex w-full gap-1 overflow-x-auto rounded-xl border border-[#2a2538] bg-[#12101a] p-1 sm:w-fit"
            >
              {[
                ["overview", "Overview"],
                ["activity", "Activity"],
                ["alerts", "Alerts"],
              ].map(([id, label]) => (
                <Tab
                  key={id}
                  id={id}
                  className={({ isSelected, isFocusVisible }) =>
                    [
                      "cursor-pointer rounded-lg px-5 py-2.5 text-sm font-medium outline-none",
                      "transition-all duration-300 motion-reduce:transition-none",
                      isSelected
                        ? "bg-[#1a1724] text-[#f0eaff] shadow-sm"
                        : "text-[#a397b8] hover:bg-[#1a1724]/60 hover:text-[#f0eaff]",
                      isFocusVisible
                        ? "ring-2 ring-[#72b1b1] ring-offset-1 ring-offset-[#12101a]"
                        : "",
                    ].join(" ")
                  }
                >
                  {label}
                </Tab>
              ))}
            </TabList>

            <TabPanel id="overview" className="outline-none">
              <section aria-labelledby="capabilities-title">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#72b1b1]">
                    System view
                  </p>
                  <h2
                    id="capabilities-title"
                    className="mt-2 text-xl font-semibold text-[#f0eaff]"
                  >
                    Capabilities
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {capabilities.map((capability) => (
                    <CapabilityCard
                      key={capability.id}
                      capability={capability}
                      expanded={expandedCard === capability.id}
                      onToggle={() =>
                        setExpandedCard((current) =>
                          current === capability.id ? null : capability.id,
                        )
                      }
                    />
                  ))}
                </div>
              </section>

              <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <section aria-labelledby="priorities-title">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e4c58d]">
                    Priority
                  </p>
                  <h2
                    id="priorities-title"
                    className="mt-2 text-xl font-semibold text-[#f0eaff]"
                  >
                    What needs you now
                  </h2>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#2a2538] bg-[#12101a]">
                    {priorities.map((priority, index) => {
                      const accent = {
                        rose: "bg-[#b57f8b]",
                        gold: "bg-[#e4c58d]",
                        teal: "bg-[#72b1b1]",
                      }[priority.tone];

                      return (
                        <div
                          key={priority.title}
                          className={`flex gap-4 p-5 ${
                            index !== priorities.length - 1
                              ? "border-b border-[#2a2538]"
                              : ""
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1 h-10 w-1 shrink-0 rounded-full ${accent}`}
                          />
                          <div>
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <h3 className="font-medium text-[#f0eaff]">
                                {priority.title}
                              </h3>
                              <span className="text-xs text-[#72b1b1]">
                                {priority.context}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[#a397b8]">
                              {priority.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <ActivityTimeline />
              </div>
            </TabPanel>

            <TabPanel id="activity" className="outline-none">
              <div className="max-w-3xl">
                <ActivityTimeline expanded />
              </div>
            </TabPanel>

            <TabPanel id="alerts" className="outline-none">
              <section aria-labelledby="alerts-title" className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b57f8b]">
                  Attention
                </p>
                <h2
                  id="alerts-title"
                  className="mt-2 text-xl font-semibold text-[#f0eaff]"
                >
                  Active alerts
                </h2>

                <div className="mt-5 space-y-4">
                  {alerts.map((alert) => {
                    const status = statusStyles[alert.status];

                    return (
                      <article
                        key={alert.title}
                        className="rounded-2xl border border-[#2a2538] bg-[#12101a] p-5"
                      >
                        <div className="flex items-start gap-4">
                          <span
                            aria-hidden="true"
                            className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`}
                          />
                          <div>
                            <h3 className="font-medium text-[#f0eaff]">
                              {alert.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-[#a397b8]">
                              {alert.detail}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </TabPanel>
          </Tabs>
        </main>

        <footer className="border-t border-[#2a2538]">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-5 sm:px-8 lg:px-10">
            <span className="text-sm font-medium text-[#f0eaff]">Rylee</span>
            <span
              aria-hidden="true"
              className="h-px flex-1 bg-gradient-to-r from-[#72b1b1] via-[#72b1b1]/20 to-transparent"
            />
            <span className="text-xs text-[#a397b8]">Project Worlds</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ActivityTimeline({ expanded = false }: { expanded?: boolean }) {
  return (
    <section aria-labelledby={expanded ? "activity-page-title" : "activity-title"}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#72b1b1]">
        Live history
      </p>
      <h2
        id={expanded ? "activity-page-title" : "activity-title"}
        className="mt-2 text-xl font-semibold text-[#f0eaff]"
      >
        Recent activity
      </h2>

      <ol className="mt-5 rounded-2xl border border-[#2a2538] bg-[#12101a] px-5 py-1">
        {activity.map((item, index) => (
          <li key={`${item.title}-${item.time}`} className="relative pl-7">
            {index !== activity.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[5px] top-7 h-full w-px bg-[#2a2538]"
              />
            )}
            <span
              aria-hidden="true"
              className="absolute left-0 top-6 h-2.5 w-2.5 rounded-full border-2 border-[#12101a] bg-[#72b1b1] ring-1 ring-[#72b1b1]/40"
            />
            <div
              className={`flex gap-4 py-5 ${
                index !== activity.length - 1
                  ? "border-b border-[#2a2538]"
                  : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-[#f0eaff]">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-[#a397b8]">{item.detail}</p>
              </div>
              <time className="shrink-0 text-xs text-[#a397b8]">
                {item.time}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}