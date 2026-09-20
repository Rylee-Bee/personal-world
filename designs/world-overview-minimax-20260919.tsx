import React, { useState, useRef } from 'react';
import { useButton } from 'react-aria';

type StatusKey = 'teal' | 'gold' | 'rose';

interface Project {
  id: string;
  name: string;
  description: string;
  detail: string;
  status: string;
  statusColor: StatusKey;
  lastModified: string;
  stack: string[];
}

const projects: Project[] = [
  {
    id: 'homelab',
    name: 'The Homelab',
    description: 'Proxmox, Traefik, Authelia. DR drills run.',
    detail: 'Self-hosted on Proxmox VE behind Traefik with Authelia SSO. Weekly DR drills hold recovery under 30 minutes. Three nodes, one offsite replica.',
    status: 'Live',
    statusColor: 'teal',
    lastModified: '2 hours ago',
    stack: ['Proxmox', 'Traefik', 'Authelia', 'Postgres'],
  },
  {
    id: 'personal-world',
    name: 'Personal World',
    description: 'Story-first portfolio. Immersive workspace.',
    detail: 'A narrative-driven portfolio where each project is a chapter. Currently private alpha with twelve collaborators exploring the workspace surface.',
    status: 'Private Alpha',
    statusColor: 'gold',
    lastModified: 'Yesterday',
    stack: ['Next.js', 'Motion', 'MDX'],
  },
  {
    id: 'vefr',
    name: 'vefr',
    description: 'Worldbuilding engine. Cast, chronicle, map, vault.',
    detail: 'Four pillars: character casting, chronological chronicles, interactive maps, and a secure vault for world notes. Engine v0.3 ships next sprint.',
    status: 'In Progress',
    statusColor: 'rose',
    lastModified: '3 days ago',
    stack: ['TypeScript', 'SQLite', 'WebGL'],
  },
  {
    id: 'play-nice',
    name: 'play-nice-contracts',
    description: '66-contract constitution for humans, agents, and tools.',
    detail: 'A behavioral constitution governing interactions between humans, agents, and tooling. Open-sourced under MIT, ratified by the council last week.',
    status: 'Live',
    statusColor: 'teal',
    lastModified: '1 week ago',
    stack: ['Markdown', 'JSON Schema'],
  },
];

const activities = [
  { time: '09:42', action: 'Deployed vefr v0.3.1 to staging', context: 'vefr' },
  { time: '08:15', action: 'Authelia SSO config pushed to cluster', context: 'homelab' },
  { time: 'Yesterday', action: 'Personal World alpha invite dispatched', context: 'personal-world' },
  { time: '2 days ago', action: 'Contract #47 ratified by council', context: 'play-nice' },
  { time: '4 days ago', action: 'Proxmox failover test passed (RTO 18m)', context: 'homelab' },
];

const statusStyles: Record<StatusKey, string> = {
  teal: 'bg-[#72b1b1]/10 text-[#72b1b1] border-[#72b1b1]/30',
  gold: 'bg-[#e4c58d]/10 text-[#e4c58d] border-[#e4c58d]/30',
  rose: 'bg-[#b57f8b]/10 text-[#b57f8b] border-[#b57f8b]/30',
};

function ProjectCard({
  project,
  isExpanded,
  onPress,
}: {
  project: Project;
  isExpanded: boolean;
  onPress: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(
    {
      onPress,
      'aria-label': `${project.name} project, status ${project.status}`,
      'aria-expanded': isExpanded,
    },
    ref,
  );

  return (
    <button
      {...buttonProps}
      ref={ref}
      className={`group relative text-left bg-[#12101a] border rounded-xl p-5 transition-[background-color,border-color,transform,box-shadow] duration-300 ease-out hover:bg-[#1a1724] hover:border-[#3a3448] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        isExpanded
          ? 'border-[#72b1b1]/40 shadow-[0_0_0_1px_rgba(114,177,177,0.15)] md:col-span-2'
          : 'border-[#2a2538]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-[#f0eaff] text-base md:text-lg font-medium tracking-tight">
          {project.name}
        </h3>
        <span
          className={`shrink-0 text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border ${statusStyles[project.statusColor]}`}
        >
          {project.status}
        </span>
      </div>

      <p className="text-[#a397b8] text-sm leading-relaxed">{project.description}</p>

      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
          isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-4 border-t border-[#2a2538]">
            <p className="text-[#a397b8] text-sm leading-relaxed">{project.detail}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {project.stack.map((s) => (
                <span
                  key={s}
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#1a1724] text-[#a397b8] border border-[#2a2538]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <span className="text-[11px] text-[#a397b8]/70 font-mono">{project.lastModified}</span>
        <span
          className={`text-xs text-[#72b1b1] inline-flex items-center gap-1 transition-transform duration-200 motion-reduce:transition-none ${
            isExpanded ? 'translate-x-0.5' : 'group-hover:translate-x-0.5'
          }`}
        >
          Open <span aria-hidden="true">→</span>
        </span>
      </div>
    </button>
  );
}

function MermaidGlow() {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-28 h-28 sm:w-36 sm:h-36 opacity-50 motion-reduce:opacity-30"
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <defs>
          <filter id="mermaidGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="tailFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#72b1b1" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#72b1b1" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <g filter="url(#mermaidGlow)" fill="none" stroke="#72b1b1" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M 58 28 C 52 36, 46 46, 48 58 C 50 70, 46 80, 38 92 C 34 98, 28 102, 22 100 M 62 28 C 68 36, 74 46, 72 58 C 70 70, 74 80, 82 92 C 86 98, 92 102, 98 100"
            stroke="url(#tailFade)"
            strokeWidth="1.1"
            opacity="0.85"
          />
          <path
            d="M 36 96 C 32 104, 24 110, 18 108 M 84 96 C 88 104, 96 110, 102 108"
            stroke="url(#tailFade)"
            strokeWidth="0.9"
            opacity="0.7"
          />
          <circle cx="60" cy="22" r="2.2" fill="#72b1b1" opacity="0.6" />
          <circle cx="48" cy="50" r="0.9" fill="#72b1b1" opacity="0.5" />
          <circle cx="72" cy="46" r="0.9" fill="#72b1b1" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

export default function ProjectWorlds() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now] = useState(() => new Date('2026-01-15T09:42:00Z'));
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-[#0a0810] text-[#f0eaff] flex flex-col antialiased">
      <header className="px-5 sm:px-8 md:px-10 pt-7 sm:pt-9 pb-5 sm:pb-6 border-b border-[#2a2538]/60">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#a397b8] mb-2">
              Project Worlds
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-[2rem] font-light tracking-tight">
              {greeting}, <span className="text-[#72b1b1]">Rylee</span>
            </h1>
            <p className="text-sm text-[#a397b8] mt-1">Your World Overview</p>
          </div>
          <div
            className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-full border border-[#2a2538] bg-[#12101a]"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#72b1b1] opacity-60 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#72b1b1]" />
            </span>
            <span className="text-[11px] text-[#a397b8] font-mono">all systems nominal</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-8 md:px-10 py-8 sm:py-10">
        <div className="max-w-6xl mx-auto">
          <section aria-labelledby="projects-heading" className="mb-12 sm:mb-14">
            <div className="flex items-baseline justify-between mb-4 sm:mb-5">
              <h2
                id="projects-heading"
                className="text-[11px] uppercase tracking-[0.2em] text-[#a397b8]"
              >
                Active Worlds
              </h2>
              <span className="text-[11px] text-[#a397b8]/60 font-mono">{projects.length} total</span>
            </div>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 transition-[gap] duration-300 motion-reduce:transition-none"
              style={{ rowGap: selectedId ? '1rem' : undefined }}
            >
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isExpanded={selectedId === project.id}
                  onPress={() =>
                    setSelectedId((prev) => (prev === project.id ? null : project.id))
                  }
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="activity-heading">
            <h2
              id="activity-heading"
              className="text-[11px] uppercase tracking-[0.2em] text-[#a397b8] mb-4 sm:mb-5"
            >
              Recent Activity
            </h2>
            <ol className="relative border-l border-[#2a2538] ml-2 space-y-4 sm:space-y-5">
              {activities.map((activity, idx) => (
                <li key={idx} className="pl-5 sm:pl-6 relative">
                  <span className="absolute -left-[5px] top-[7px] w-2.5 h-2.5 rounded-full bg-[#0a0810] border border-[#72b1b1]" />
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                    <time
                      dateTime={activity.time}
                      className="text-[11px] text-[#a397b8]/70 font-mono shrink-0 sm:min-w-[6rem]"
                    >
                      {activity.time}
                    </time>
                    <p className="text-sm text-[#f0eaff] flex-1 leading-relaxed">
                      {activity.action}
                    </p>
                    <span className="text-[10px] uppercase tracking-wider text-[#72b1b1]/80 shrink-0">
                      {activity.context}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>

      <footer className="px-5 sm:px-8 md:px-10 py-5 sm:py-6 border-t border-[#2a2538]/60">
        <div className="max-w-6xl mx-auto flex items-center gap-3 sm:gap-4">
          <span className="text-sm text-[#f0eaff] font-light">Rylee</span>
          <span
            className="h-px flex-1 bg-gradient-to-r from-[#72b1b1]/70 via-[#72b1b1]/20 to-transparent"
            aria-hidden="true"
          />
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#a397b8]/70 font-mono">
            worlds · v1.0
          </span>
        </div>
      </footer>

      <MermaidGlow />
    </div>
  );
}