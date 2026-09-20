import React, { useRef, useState } from 'react';
import { useButton } from 'react-aria';

// Tailwind CDN reference only: <script src="https://cdn.tailwindcss.com"></script>

type ProjectStatus = 'Live' | 'Private Alpha' | 'In Progress';

type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  modified: string;
  detail: string;
};

const projects: Project[] = [
  {
    id: 'homelab',
    name: 'The Homelab',
    description: 'Proxmox, Traefik, Authelia. DR drills run.',
    status: 'Live',
    modified: 'Modified today',
    detail:
      'Infrastructure services are healthy. Recovery procedures, routing, and identity boundaries are documented.',
  },
  {
    id: 'personal-world',
    name: 'Personal World',
    description: 'Story-first portfolio. Immersive workspace.',
    status: 'Private Alpha',
    modified: 'Modified yesterday',
    detail:
      'A quiet, narrative workspace connecting projects, writing, experiments, and personal context.',
  },
  {
    id: 'vefr',
    name: 'vefr',
    description: 'Worldbuilding engine. Cast, chronicle, map, vault.',
    status: 'In Progress',
    modified: 'Modified 3 days ago',
    detail:
      'Core world models are taking shape across characters, events, places, relationships, and source material.',
  },
  {
    id: 'play-nice-contracts',
    name: 'play-nice-contracts',
    description: '66-contract constitution for humans/agents/tools.',
    status: 'Live',
    modified: 'Modified 5 days ago',
    detail:
      'Shared behavioral contracts provide clear expectations across people, agents, tools, and environments.',
  },
];

const activity = [
  {
    time: '09:42',
    title: 'Recovery drill completed',
    detail: 'The Homelab · all validation checks passed',
  },
  {
    time: 'Yesterday',
    title: 'Workspace scene refined',
    detail: 'Personal World · navigation and atmosphere updated',
  },
  {
    time: 'Sep 16',
    title: 'Chronicle schema expanded',
    detail: 'vefr · event relationships added',
  },
  {
    time: 'Sep 15',
    title: 'Contract 66 published',
    detail: 'play-nice-contracts · release marked live',
  },
  {
    time: 'Sep 12',
    title: 'World overview created',
    detail: 'Four active project worlds connected',
  },
];

const statusStyles: Record<ProjectStatus, string> = {
  Live: 'border-[#72b1b1]/35 bg-[#72b1b1]/10 text-[#72b1b1]',
  'Private Alpha': 'border-[#e4c58d]/35 bg-[#e4c58d]/10 text-[#e4c58d]',
  'In Progress': 'border-[#b57f8b]/35 bg-[#b57f8b]/10 text-[#b57f8b]',
};

interface ProjectCardProps {
  project: Project;
  selected: boolean;
  expanded: boolean;
  onSelect: (id: string) => void;
  onExpand: (id: string | null) => void;
}

function ProjectCard({
  project,
  selected,
  expanded,
  onSelect,
  onExpand,
}: ProjectCardProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const { buttonProps, isPressed } = useButton(
    {
      'aria-label': `Open ${project.name}`,
      'aria-expanded': expanded,
      onPress: () => onSelect(project.id),
    },
    ref,
  );

  return (
    <button
      {...buttonProps}
      ref={ref}
      type="button"
      onMouseEnter={() => onExpand(project.id)}
      onMouseLeave={() => onExpand(null)}
      onFocus={() => onExpand(project.id)}
      onBlur={() => onExpand(null)}
      className={[
        'group relative w-full overflow-hidden rounded-2xl border bg-[#12101a] p-5 text-left',
        'transition-[border-color,background-color,transform,box-shadow] duration-300 ease-out',
        'hover:-translate-y-1 hover:border-[#72b1b1]/45 hover:bg-[#1a1724]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0810]',
        'motion-reduce:transform-none motion-reduce:transition-none',
        selected
          ? 'border-[#72b1b1]/60 shadow-[0_16px_50px_rgba(114,177,177,0.09)]'
          : 'border-[#2a2538]',
        isPressed ? 'scale-[0.99]' : '',
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#72b1b1]/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#f0eaff]">
            {project.name}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#a397b8]">
            {project.description}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${statusStyles[project.status]}`}
        >
          {project.status}
        </span>
      </div>

      <div
        className={[
          'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
          expanded
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0',
        ].join(' ')}
      >
        <div className="overflow-hidden">
          <div className="mt-5 border-t border-[#2a2538] pt-4">
            <p className="text-sm leading-6 text-[#a397b8]">
              {project.detail}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <span className="text-xs text-[#a397b8]">{project.modified}</span>
        <span className="font-medium text-[#72b1b1] transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none">
          Open <span aria-hidden="true">→</span>
        </span>
      </div>
    </button>
  );
}

export default function ProjectWorldOverview() {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedCard((current) => (current === id ? null : id));
    setExpandedCard(id);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0810] text-[#f0eaff]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 bottom-4 h-72 w-72 opacity-[0.16]"
      >
        <div className="absolute inset-8 rounded-full bg-[#72b1b1]/20 blur-3xl" />
        <div className="absolute bottom-14 right-20 h-28 w-16 rotate-[-10deg] rounded-[55%_45%_65%_35%] border border-[#72b1b1]/35 shadow-[0_0_38px_rgba(114,177,177,0.18)]" />
        <div className="absolute bottom-10 right-9 h-20 w-28 rotate-[18deg] rounded-[80%_20%_70%_30%] border-b border-r border-[#72b1b1]/25" />
        <div className="absolute bottom-7 right-3 h-14 w-36 rotate-[28deg] rounded-[50%] border-b border-[#72b1b1]/20" />
      </div>

      <header className="relative z-10 border-b border-[#2a2538] bg-[#0a0810]/90 px-5 py-5 backdrop-blur md:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#a397b8]">
              Project Worlds
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#f0eaff] sm:text-2xl">
              Good morning, Rylee
            </h1>
          </div>

          <div
            className="flex items-center gap-2 rounded-full border border-[#2a2538] bg-[#12101a] px-3 py-2"
            aria-label="Workspace status: online"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[#72b1b1] shadow-[0_0_10px_rgba(114,177,177,0.8)]"
            />
            <span className="text-xs text-[#a397b8]">Online</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 py-10 md:px-8 md:py-14">
        <section aria-labelledby="overview-title">
          <div className="mb-7 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#72b1b1]">
              Your World Overview
            </p>
            <h2
              id="overview-title"
              className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#f0eaff] sm:text-4xl"
            >
              Four worlds in motion.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#a397b8] sm:text-base">
              Step into a project to see its current shape, history, and next
              point of focus.
            </p>
          </div>

          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            aria-label="Project worlds"
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                selected={selectedCard === project.id}
                expanded={
                  expandedCard === project.id || selectedCard === project.id
                }
                onSelect={handleSelect}
                onExpand={setExpandedCard}
              />
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="activity-title">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#b57f8b]">
                Recent signals
              </p>
              <h2
                id="activity-title"
                className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#f0eaff]"
              >
                Activity
              </h2>
            </div>
            <span className="text-xs text-[#a397b8]">Across all worlds</span>
          </div>

          <ol className="overflow-hidden rounded-2xl border border-[#2a2538] bg-[#12101a]">
            {activity.map((entry, index) => (
              <li
                key={`${entry.time}-${entry.title}`}
                className={`grid grid-cols-[4.5rem_1fr] gap-4 px-5 py-4 sm:grid-cols-[6rem_1fr] ${
                  index > 0 ? 'border-t border-[#2a2538]' : ''
                }`}
              >
                <time className="pt-0.5 text-xs text-[#a397b8]">
                  {entry.time}
                </time>
                <div className="relative pl-5">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#72b1b1]/80 shadow-[0_0_8px_rgba(114,177,177,0.35)]"
                  />
                  <p className="text-sm font-medium text-[#f0eaff]">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#a397b8]">
                    {entry.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#2a2538] px-5 py-6 md:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
          <span className="text-sm font-medium text-[#f0eaff]">Rylee</span>
          <span
            aria-hidden="true"
            className="h-px flex-1 bg-gradient-to-r from-[#72b1b1] via-[#72b1b1]/25 to-transparent"
          />
        </div>
      </footer>
    </div>
  );
}