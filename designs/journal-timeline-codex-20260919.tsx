import React, { useEffect, useRef, useState } from "react";
import { useButton } from "react-aria";
import type { AriaButtonProps } from "react-aria";

// Tailwind CDN reference only: <script src="https://cdn.tailwindcss.com"></script>

type Milestone = {
  year: string;
  title: string;
  summary: string;
  details: string;
  status: string;
};

const milestones: Milestone[] = [
  {
    year: "2016",
    title: "First homelab",
    summary: "Built Proxmox cluster from recycled hardware",
    details:
      "Turned discarded machines into a practical Proxmox lab for learning virtualization, networking, storage, and resilient infrastructure.",
    status: "Foundation",
  },
  {
    year: "2019",
    title: "Automation era",
    summary: "Ansible, Docker, CI/CD pipelines",
    details:
      "Moved repeatable work into code with Ansible playbooks, containerized services, and CI/CD pipelines that made deployments predictable.",
    status: "Automated",
  },
  {
    year: "2022",
    title: "Security pivot",
    summary: "Authelia, Zero Trust, OpenBao vault",
    details:
      "Reframed the homelab around identity-aware access, Zero Trust boundaries, centralized secrets, and safer defaults across every service.",
    status: "Hardened",
  },
  {
    year: "2024",
    title: "Agent era",
    summary: "AI coding assistants, semantic memory, multi-model",
    details:
      "Built workflows where coding agents, semantic memory, and multiple models collaborate without losing project history or human intent.",
    status: "Augmented",
  },
  {
    year: "2026",
    title: "Project Worlds",
    summary: "Story-first portfolio, immersive workspace",
    details:
      "Created a living portfolio where projects become explorable worlds—combining technical evidence, narrative, memory, and atmosphere.",
    status: "Now",
  },
];

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}

type TimelineNodeProps = {
  milestone: Milestone;
  index: number;
  expanded: boolean;
  onToggle: () => void;
};

function TimelineNode({
  milestone,
  index,
  expanded,
  onToggle,
}: TimelineNodeProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reveal = useReveal<HTMLLIElement>();

  const ariaProps: AriaButtonProps<"button"> = {
    "aria-label": `${expanded ? "Collapse" : "Expand"} ${milestone.year}: ${milestone.title}`,
    "aria-expanded": expanded,
    onPress: onToggle,
  };

  const { buttonProps } = useButton(ariaProps, buttonRef);

  return (
    <li
      ref={reveal.ref}
      className={[
        "relative pl-12 transition-all duration-700 ease-out",
        "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        reveal.revealed
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0",
      ].join(" ")}
      style={{ transitionDelay: `${index * 70}ms` }}
    >
      <button
        {...buttonProps}
        ref={buttonRef}
        type="button"
        className={[
          "group absolute left-0 top-7 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full",
          "border border-[#72b1b1] bg-[#12101a] text-[#72b1b1] shadow-[0_0_0_5px_#0a0810]",
          "transition duration-300 hover:bg-[#1a1724] hover:shadow-[0_0_18px_rgba(114,177,177,0.38)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c58d] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0810]",
          "motion-reduce:transition-none",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "h-2.5 w-2.5 rounded-full bg-[#72b1b1] transition-transform duration-300",
            "motion-reduce:transition-none",
            expanded ? "scale-125" : "scale-100",
          ].join(" ")}
        />
      </button>

      <article
        className={[
          "overflow-hidden rounded-2xl border bg-[#12101a] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)]",
          "transition duration-300 motion-reduce:transition-none sm:p-6",
          expanded
            ? "border-[#72b1b1]/60 bg-[#1a1724]"
            : "border-[#2a2538] hover:border-[#72b1b1]/40",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full border border-[#e4c58d]/30 bg-[#e4c58d]/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[#e4c58d]">
              {milestone.year}
            </span>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-[#f0eaff] sm:text-2xl">
              {milestone.title}
            </h2>
          </div>

          <span className="rounded-full border border-[#b57f8b]/30 bg-[#b57f8b]/10 px-3 py-1 text-xs font-medium text-[#b57f8b]">
            {milestone.status}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-[#a397b8] sm:text-base">
          {milestone.summary}
        </p>

        <div
          aria-hidden={!expanded}
          className={[
            "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out",
            "motion-reduce:transition-none",
            expanded
              ? "mt-4 grid-rows-[1fr] opacity-100"
              : "mt-0 grid-rows-[0fr] opacity-0",
          ].join(" ")}
        >
          <div className="overflow-hidden">
            <div className="border-t border-[#2a2538] pt-4">
              <p className="text-sm leading-6 text-[#f0eaff]/80">
                {milestone.details}
              </p>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function MermaidCompanion() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative mx-auto h-32 w-40 animate-pulse opacity-70 motion-reduce:animate-none"
    >
      <div className="absolute inset-6 rounded-full bg-[#72b1b1]/10 blur-2xl" />
      <svg
        viewBox="0 0 180 140"
        className="relative h-full w-full drop-shadow-[0_0_14px_rgba(114,177,177,0.3)]"
        fill="none"
      >
        <path
          d="M42 76c3-24 21-44 48-44s45 20 48 44c3 28-13 48-48 48S39 104 42 76Z"
          fill="#72b1b1"
          fillOpacity="0.08"
          stroke="#72b1b1"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        <path
          d="M53 52 40 27c18 4 27 13 32 23M127 52l13-25c-18 4-27 13-32 23"
          fill="#72b1b1"
          fillOpacity="0.06"
          stroke="#72b1b1"
          strokeOpacity="0.42"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M44 89c-16 6-24 17-26 32 16-2 29-9 37-20M136 89c16 6 24 17 26 32-16-2-29-9-37-20"
          stroke="#72b1b1"
          strokeOpacity="0.38"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="74" cy="75" r="2.5" fill="#e4c58d" fillOpacity="0.7" />
        <circle cx="106" cy="75" r="2.5" fill="#e4c58d" fillOpacity="0.7" />
        <path
          d="M78 94c8 5 16 5 24 0"
          stroke="#72b1b1"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M90 84v4"
          stroke="#72b1b1"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function ProjectWorldsJournalTimeline() {
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(4);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#0a0810] text-[#f0eaff]">
      <header className="border-b border-[#2a2538] bg-[#0a0810]/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#a397b8]">
              Project Worlds
            </p>
            <p className="mt-1 text-sm font-medium text-[#f0eaff] sm:text-base">
              Good morning, Rylee
            </p>
          </div>

          <div
            className="flex items-center gap-2 rounded-full border border-[#2a2538] bg-[#12101a] px-3 py-1.5 text-xs text-[#a397b8]"
            aria-label="Workspace status: online"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[#72b1b1] shadow-[0_0_9px_rgba(114,177,177,0.8)]"
            />
            Online
          </div>
        </div>
      </header>

      <main className="relative flex-1 px-5 py-12 sm:px-8 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-[#72b1b1]/[0.04] blur-3xl"
        />

        <div className="relative mx-auto max-w-3xl">
          <div className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#72b1b1]">
              Journal 01
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#f0eaff] sm:text-5xl">
              Journal Timeline
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#a397b8] sm:text-base">
              A field record of systems built, ideas tested, and worlds still
              unfolding.
            </p>
          </div>

          <ol
            className="relative ml-4 space-y-8 border-l border-[#72b1b1]/35 sm:ml-6 sm:space-y-10"
            aria-label="Career milestones"
          >
            {milestones.map((milestone, index) => (
              <TimelineNode
                key={milestone.year}
                milestone={milestone}
                index={index}
                expanded={expandedMilestone === index}
                onToggle={() =>
                  setExpandedMilestone((current) =>
                    current === index ? null : index,
                  )
                }
              />
            ))}

            <li className="relative pl-12 pt-2">
              <span
                aria-hidden="true"
                className="absolute left-0 top-16 h-3 w-3 -translate-x-1/2 rounded-full bg-[#72b1b1]/70 shadow-[0_0_16px_rgba(114,177,177,0.55)]"
              />
              <div className="rounded-2xl border border-[#2a2538] bg-[#12101a]/70 px-5 py-6 text-center">
                <MermaidCompanion />
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#72b1b1]">
                  The story continues
                </p>
                <p className="mt-2 text-sm text-[#a397b8]">
                  Somewhere beyond the map, another world is taking shape.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </main>

      <footer className="border-t border-[#2a2538] bg-[#0a0810] px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-[#72b1b1]/70 via-[#72b1b1]/20 to-transparent" />
          <span className="text-xs font-medium uppercase tracking-[0.24em] text-[#a397b8]">
            Rylee
          </span>
        </div>
      </footer>
    </div>
  );
}