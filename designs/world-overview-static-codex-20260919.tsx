import React from 'react';
import { Link } from 'react-aria-components';

/* Tailwind CDN reference only:
<script src="https://cdn.tailwindcss.com"></script>
*/

type ProjectStatus = 'Live' | 'Private Alpha' | 'In Progress';

export interface ProjectWorldsOverviewProps {
  greeting?: string;
  owner?: string;
}

const projects: Array<{
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  modified: string;
  details: string;
}> = [
  {
    id: 'homelab',
    name: 'The Homelab',
    description: 'Proxmox, Traefik, Authelia. DR drills run.',
    status: 'Live',
    modified: 'Modified today',
    details:
      'Infrastructure, identity, routing, and recovery practices gathered into one operational world.',
  },
  {
    id: 'personal-world',
    name: 'Personal World',
    description: 'Story-first portfolio. Immersive workspace.',
    status: 'Private Alpha',
    modified: 'Modified yesterday',
    details:
      'A personal space where projects, identity, and narrative form a connected experience.',
  },
  {
    id: 'vefr',
    name: 'vefr',
    description: 'Worldbuilding engine. Cast, chronicle, map, vault.',
    status: 'In Progress',
    modified: 'Modified 3 days ago',
    details:
      'A structured worldbuilding system for characters, events, places, and enduring knowledge.',
  },
  {
    id: 'play-nice-contracts',
    name: 'play-nice-contracts',
    description: '66-contract constitution for humans/agents/tools.',
    status: 'Live',
    modified: 'Modified 5 days ago',
    details:
      'Shared behavioral contracts that keep collaboration predictable across people, agents, and tools.',
  },
];

const activity = [
  {
    title: 'Recovery drill completed',
    context: 'The Homelab',
    time: 'Today, 08:42',
  },
  {
    title: 'Workspace narrative revised',
    context: 'Personal World',
    time: 'Yesterday, 19:16',
  },
  {
    title: 'Chronicle indexing connected',
    context: 'vefr',
    time: 'Sep 16, 14:30',
  },
  {
    title: 'Contract 66 validation passed',
    context: 'play-nice-contracts',
    time: 'Sep 15, 10:04',
  },
  {
    title: 'World overview refreshed',
    context: 'Project Worlds',
    time: 'Sep 14, 17:51',
  },
];

const statusClasses: Record<ProjectStatus, string> = {
  Live: 'border-[#72b1b1]/40 bg-[#72b1b1]/10 text-[#72b1b1]',
  'Private Alpha':
    'border-[#e4c58d]/40 bg-[#e4c58d]/10 text-[#e4c58d]',
  'In Progress': 'border-[#b57f8b]/40 bg-[#b57f8b]/10 text-[#b57f8b]',
};

export default function ProjectWorldsOverview({
  greeting = 'Good morning, Rylee',
  owner = 'Rylee',
}: ProjectWorldsOverviewProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0810] text-[#f0eaff] antialiased selection:bg-[#72b1b1]/25 selection:text-[#f0eaff]">
      <style>{`
        @keyframes mermaid-breathe {
          0%, 100% { opacity: 0.08; filter: drop-shadow(0 0 10px rgba(114,177,177,0.12)); }
          50% { opacity: 0.17; filter: drop-shadow(0 0 24px rgba(114,177,177,0.28)); }
        }

        .mermaid-ambient {
          animation: mermaid-breathe 8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <aside
        aria-label="Ambient mermaid companion"
        className="pointer-events-none fixed -bottom-12 -right-16 z-0 h-72 w-72 sm:-right-10 sm:h-96 sm:w-96"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 320 420"
          className="mermaid-ambient h-full w-full fill-none stroke-[#72b1b1]"
        >
          <path
            d="M178 38c-18 9-31 29-30 50 0 17 8 29 20 39-8 16-10 34-5 52 8 27 31 46 37 75 7 35-7 71-36 91"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M169 126c-31 19-52 52-55 88-4 48 24 77 22 113-1 23-14 42-35 55 29 0 53-11 67-31 13 20 37 31 67 31-28-17-41-43-34-72"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M136 203c-27 13-48 37-57 66 23-15 45-17 66-5M199 205c28 11 50 34 61 62-24-13-46-14-66-1"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M157 74c9-9 22-13 35-8M177 39c8-5 18-7 27-5-3 9-9 16-17 21"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="182" cy="88" r="2" fill="#72b1b1" stroke="none" />
        </svg>
      </aside>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-[#2a2538] bg-[#0a0810]/90 px-5 py-5 backdrop-blur-md sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#a397b8]">
                Project Worlds
              </p>
              <h1 className="text-lg font-medium tracking-tight text-[#f0eaff] sm:text-xl">
                {greeting}
              </h1>
            </div>

            <div
              aria-label="All systems healthy"
              className="flex items-center gap-2 rounded-full border border-[#2a2538] bg-[#12101a] px-3 py-2 text-xs text-[#a397b8]"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-[#72b1b1] shadow-[0_0_12px_rgba(114,177,177,0.7)]"
              />
              Worlds online
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <section aria-labelledby="overview-heading">
            <div className="mb-8 max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#72b1b1]">
                Your World Overview
              </p>
              <h2
                id="overview-heading"
                className="text-3xl font-semibold tracking-[-0.03em] text-[#f0eaff] sm:text-4xl"
              >
                Four worlds, one living system.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#a397b8] sm:text-base">
                Enter a world or expand its card for a closer look.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {projects.map((project, index) => (
                <article
                  id={project.id}
                  key={project.id}
                  className="group scroll-mt-6 rounded-2xl border border-[#2a2538] bg-[#12101a] transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[#72b1b1]/50 hover:bg-[#1a1724] target:border-[#72b1b1] target:shadow-[0_0_0_1px_rgba(114,177,177,0.25),0_20px_60px_rgba(0,0,0,0.25)]"
                >
                  <details className="group/details">
                    <summary className="cursor-pointer list-none rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810] sm:p-6 [&::-webkit-details-marker]:hidden">
                      <div className="flex items-start justify-between gap-5">
                        <span className="text-xs font-medium tabular-nums text-[#a397b8]">
                          0{index + 1}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${statusClasses[project.status]}`}
                        >
                          {project.status}
                        </span>
                      </div>

                      <h3 className="mt-8 text-xl font-semibold tracking-tight text-[#f0eaff]">
                        {project.name}
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-[#a397b8]">
                        {project.description}
                      </p>

                      <div className="mt-8 flex items-end justify-between gap-4">
                        <span className="text-xs text-[#a397b8]">
                          {project.modified}
                        </span>
                        <span className="font-medium text-[#72b1b1] transition-transform duration-300 group-hover:translate-x-1 group-open/details:rotate-90">
                          Open →
                        </span>
                      </div>
                    </summary>

                    <div className="border-t border-[#2a2538] px-5 pb-6 pt-5 sm:px-6">
                      <p className="max-w-xl text-sm leading-6 text-[#a397b8]">
                        {project.details}
                      </p>
                      <Link
                        href={`#${project.id}`}
                        aria-label={`Open ${project.name}`}
                        className="mt-5 inline-flex rounded-md text-sm font-semibold text-[#72b1b1] underline decoration-[#72b1b1]/35 underline-offset-4 outline-none hover:decoration-[#72b1b1] focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-4 focus-visible:ring-offset-[#12101a]"
                      >
                        Enter world →
                      </Link>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="activity-heading"
            className="mt-14 border-t border-[#2a2538] pt-10 sm:mt-20"
          >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#b57f8b]">
                  Activity
                </p>
                <h2
                  id="activity-heading"
                  className="text-2xl font-semibold tracking-tight text-[#f0eaff]"
                >
                  Recent movement
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[#a397b8]">
                  The latest changes across your connected project worlds.
                </p>
              </div>

              <ol className="relative border-l border-[#2a2538]">
                {activity.map((item, index) => (
                  <li
                    key={`${item.title}-${item.time}`}
                    className="group relative ml-5 border-b border-[#2a2538] py-5 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[1.55rem] top-6 h-2 w-2 rounded-full border-2 border-[#0a0810] transition-[transform,box-shadow] group-hover:scale-150 group-hover:shadow-[0_0_12px_rgba(114,177,177,0.45)] first:top-1 ${
                        index === 0 ? 'bg-[#72b1b1]' : 'bg-[#2a2538]'
                      }`}
                    />
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
                      <div>
                        <h3 className="text-sm font-medium text-[#f0eaff]">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm text-[#a397b8]">
                          {item.context}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-[#a397b8]">
                        {item.time}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </main>

        <footer className="border-t border-[#2a2538] px-5 py-6 sm:px-8 lg:px-12">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <span className="h-px w-10 bg-[#72b1b1] shadow-[0_0_10px_rgba(114,177,177,0.45)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a397b8]">
              {owner}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}