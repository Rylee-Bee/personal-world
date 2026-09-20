import React, { useState, useEffect, useRef } from 'react';
import { useButton } from 'react-aria';

/* Tailwind CDN reference (not executed, for reference only):
   <script src="https://cdn.tailwindcss.com"></script>
*/

interface Milestone {
  year: string;
  title: string;
  description: string;
  status: string;
  statusColor: 'teal' | 'rose' | 'gold';
}

const milestones: Milestone[] = [
  {
    year: '2016',
    title: 'First homelab',
    description:
      'Built a Proxmox cluster from recycled hardware — three beige boxes wired into a wall of VLANs. Virtualization, networking, and the hum of fans became a kind of meditation. The first server I ever named.',
    status: 'Origin',
    statusColor: 'rose',
  },
  {
    year: '2019',
    title: 'Automation era',
    description:
      'Ansible playbooks took over the manual rebuilds. Docker images became the unit of deployment. CI/CD pipelines turned weekend chores into five-minute merges and made room for new experiments.',
    status: 'Scaling',
    statusColor: 'teal',
  },
  {
    year: '2022',
    title: 'Security pivot',
    description:
      'Authelia in front of every service. Zero Trust segments between subnets. OpenBao vault for secrets, rotated on a schedule. Paranoia, formalized and documented. Sleep, slightly improved.',
    status: 'Hardened',
    statusColor: 'gold',
  },
  {
    year: '2024',
    title: 'Agent era',
    description:
      'AI coding assistants joined the workflow — not as oracles but as collaborators. Semantic memory across projects. Multi-model orchestration for the messy parts of thinking. The IDE became a conversation.',
    status: 'Active',
    statusColor: 'teal',
  },
  {
    year: '2026',
    title: 'Project Worlds',
    description:
      'A story-first portfolio. Each project is a place you visit rather than a page you scroll — an immersive workspace where the work has a sense of place. You are standing in it now.',
    status: 'Now',
    statusColor: 'rose',
  },
];

const statusStyles: Record<Milestone['statusColor'], string> = {
  teal: 'text-[#72b1b1] border-[#72b1b1]/40 bg-[#72b1b1]/10',
  rose: 'text-[#b57f8b] border-[#b57f8b]/40 bg-[#b57f8b]/10',
  gold: 'text-[#e4c58d] border-[#e4c58d]/40 bg-[#e4c58d]/10',
};

interface NodeProps {
  milestone: Milestone;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const MilestoneNode: React.FC<NodeProps> = ({ milestone, index, isExpanded, onToggle }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton(
    {
      onPress: onToggle,
      'aria-label': `${milestone.year} ${milestone.title}, status ${milestone.status}`,
    },
    ref
  );

  return (
    <li
      className="reveal relative pb-10 sm:pb-14 last:pb-0 opacity-0 translate-y-3 transition-all duration-700 ease-out will-change-transform [&.revealed]:opacity-100 [&.revealed]:translate-y-0 motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none"
      style={{ transitionDelay: `${index * 90}ms` }}
    >
      {/* Timeline dot */}
      <span
        aria-hidden="true"
        className={`absolute left-5 top-2.5 -translate-x-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1724] border-2 transition-all duration-500 ${
          isExpanded
            ? 'border-[#e4c58d] shadow-[0_0_22px_rgba(228,197,141,0.5)]'
            : 'border-[#72b1b1] shadow-[0_0_16px_rgba(114,177,177,0.3)]'
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
            isExpanded ? 'bg-[#e4c58d] scale-125' : 'bg-[#72b1b1]'
          }`}
        />
      </span>

      {/* Card (entire row is the button) */}
      <button
        {...buttonProps}
        ref={ref}
        aria-expanded={isExpanded}
        className="group block w-full text-left pl-14 sm:pl-20 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810]"
      >
        <div
          className={`relative bg-[#12101a] border rounded-xl p-4 sm:p-5 transition-all duration-300 group-hover:bg-[#1a1724] group-hover:translate-x-1 motion-reduce:transform-none ${
            isExpanded
              ? 'border-[#72b1b1]/50 shadow-[0_0_28px_rgba(114,177,177,0.12)]'
              : 'border-[#2a2538] group-hover:border-[#72b1b1]/40'
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
            <span className="font-mono text-[#e4c58d] text-xs sm:text-sm tracking-[0.25em] uppercase">
              {milestone.year}
            </span>
            <span
              className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-full border font-medium tracking-wide uppercase ${statusStyles[milestone.statusColor]}`}
            >
              {milestone.status}
            </span>
          </div>
          <h3 className="text-[#f0eaff] text-base sm:text-lg font-medium mb-2 leading-snug">
            {milestone.title}
          </h3>
          <p
            className={`text-[#a397b8] text-sm leading-relaxed transition-all duration-300 ${
              isExpanded ? '' : 'line-clamp-2'
            }`}
          >
            {milestone.description}
          </p>
          <div
            aria-hidden="true"
            className={`mt-3 text-[10px] sm:text-xs tracking-[0.2em] uppercase font-mono transition-colors duration-300 ${
              isExpanded
                ? 'text-[#e4c58d]'
                : 'text-[#a397b8]/50 group-hover:text-[#72b1b1]'
            }`}
          >
            {isExpanded ? '— collapse —' : '— tap to expand —'}
          </div>
        </div>
      </button>
    </li>
  );
};

const MermaidCompanion: React.FC = () => (
  <div className="reveal relative w-28 h-32 sm:w-32 sm:h-36 mx-auto opacity-0 transition-opacity duration-1000 [&.revealed]:opacity-100 motion-reduce:opacity-100 motion-reduce:transition-none">
    <div className="absolute inset-0 bg-[#72b1b1] rounded-full blur-3xl opacity-30 motion-safe:animate-[mermaidPulse_6s_ease-in-out_infinite]" />
    <svg
      viewBox="0 0 120 160"
      className="relative w-full h-full"
      role="img"
      aria-label="Mermaid companion, ambient presence"
    >
      <defs>
        <linearGradient id="tailGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#72b1b1" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#72b1b1" stopOpacity="0.05" />
        </linearGradient>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      <g
        stroke="#72b1b1"
        fill="none"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#softGlow)"
      >
        {/* Floating hair */}
        <path d="M50 18 Q36 12 40 32 Q44 48 34 60" opacity="0.45" />
        <path d="M70 18 Q84 12 80 32 Q76 48 86 60" opacity="0.45" />
        {/* Head */}
        <ellipse cx="60" cy="28" rx="7" ry="9" opacity="0.85" />
        {/* Body */}
        <path d="M60 37 Q58 56 60 76" opacity="0.85" />
        {/* Arms */}
        <path d="M60 46 Q46 50 42 64" opacity="0.55" />
        <path d="M60 46 Q74 50 80 58" opacity="0.55" />
        {/* Tail */}
        <path d="M60 76 Q54 96 46 116" opacity="0.7" />
        <path d="M60 76 Q66 96 74 116" opacity="0.7" />
        {/* Tail fin */}
        <path d="M46 116 L34 142 L58 122 Z" fill="url(#tailGrad)" opacity="0.6" />
        <path d="M74 116 L86 142 L62 122 Z" fill="url(#tailGrad)" opacity="0.6" />
      </g>
      {/* Bubbles */}
      <g fill="#72b1b1">
        <circle cx="22" cy="60" r="1.4" opacity="0.5" className="motion-safe:animate-[bubbleRise_7s_ease-in-out_infinite]" />
        <circle cx="100" cy="80" r="1" opacity="0.4" className="motion-safe:animate-[bubbleRise_9s_ease-in-out_infinite_2s]" />
        <circle cx="92" cy="110" r="1.2" opacity="0.45" className="motion-safe:animate-[bubbleRise_8s_ease-in-out_infinite_4s]" />
        <circle cx="28" cy="100" r="0.9" opacity="0.35" className="motion-safe:animate-[bubbleRise_10s_ease-in-out_infinite_1s]" />
      </g>
    </svg>
  </div>
);

const CornerGlyph: React.FC = () => (
  <div
    aria-hidden="true"
    className="hidden lg:block fixed bottom-32 right-8 w-12 h-14 opacity-30 mix-blend-screen pointer-events-none"
  >
    <svg viewBox="0 0 60 80" className="w-full h-full">
      <defs>
        <filter id="cornerGlow">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
      <g stroke="#72b1b1" fill="none" strokeWidth="0.8" strokeLinecap="round" filter="url(#cornerGlow)" opacity="0.7">
        <ellipse cx="30" cy="14" rx="4" ry="5" />
        <path d="M30 19 Q29 28 30 38" />
        <path d="M30 24 Q22 26 19 32" />
        <path d="M30 24 Q38 26 41 30" />
        <path d="M30 38 Q26 48 22 58" />
        <path d="M30 38 Q34 48 38 58" />
        <path d="M22 58 L16 72 L29 62 Z" fill="#72b1b1" fillOpacity="0.25" />
        <path d="M38 58 L44 72 L31 62 Z" fill="#72b1b1" fillOpacity="0.25" />
      </g>
    </svg>
  </div>
);

export default function JournalTimeline() {
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduce) {
      els.forEach((el) => el.classList.add('revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0810] text-[#f0eaff] flex flex-col font-sans antialiased">
      <style>{`
          @keyframes mermaidPulse {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 0.45; transform: scale(1.12); }
          }
          @keyframes bubbleRise {
            0% { transform: translateY(0); opacity: 0; }
            20% { opacity: 0.5; }
            100% { transform: translateY(-50px); opacity: 0; }
          }
        `}</style>

      {/* Header */}
      <header className="border-b border-[#2a2538] px-4 sm:px-6 lg:px-10 py-4 sticky top-0 z-20 backdrop-blur-md bg-[#0a0810]/80">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#72b1b1] via-[#b57f8b] to-[#e4c58d] flex items-center justify-center text-[#0a0810] font-bold text-sm shadow-[0_0_18px_rgba(114,177,177,0.25)]"
              aria-hidden="true"
            >
              R
            </div>
            <div className="min-w-0">
              <p className="text-[#a397b8] text-[10px] uppercase tracking-[0.3em] truncate">
                Project Worlds
              </p>
              <h1 className="text-[#f0eaff] text-sm sm:text-base font-medium truncate">
                Good morning, Rylee
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#12101a] border border-[#2a2538] shrink-0">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[#a397b8] text-xs">Online</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 sm:py-12 lg:py-16">
        <div className="max-w-2xl mx-auto">
          <section className="mb-10 sm:mb-14 reveal opacity-0 transition-all duration-700 [&.revealed]:opacity-100 motion-reduce:opacity-100 motion-reduce:transition-none">
            <p className="text-[#72b1b1] text-xs font-mono tracking-[0.3em] uppercase mb-3">
              ◦ journal
            </p>
            <h2 className="text-[#f0eaff] text-3xl sm:text-4xl lg:text-5xl font-light leading-[1.1] tracking-tight">
              Timeline of a{' '}
              <span className="text-[#e4c58d] italic">quiet build</span>
            </h2>
            <p className="text-[#a397b8] text-sm sm:text-base mt-4 leading-relaxed max-w-prose">
              Five stops on the way to now. Tap any node to expand.
            </p>
          </section>

          <div className="relative">
            {/* Vertical timeline line */}
            <div
              className="absolute left-5 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-[#72b1b1]/60 to-transparent"
              aria-hidden="true"
            />

            <ol className="relative" role="list" aria-label="Journal timeline">
              {milestones.map((m, i) => (
                <MilestoneNode
                  key={m.year}
                  milestone={m}
                  index={i}
                  isExpanded={expanded === i}
                  onToggle={() => setExpanded((cur) => (cur === i ? null : i))}
                />
              ))}
            </ol>

            {/* Mermaid companion */}
            <div className="mt-10 sm:mt-14 flex flex-col items-center gap-3">
              <MermaidCompanion />
              <p className="text-[#a397b8]/60 text-[10px] uppercase tracking-[0.4em] font-mono">
                still here
              </p>
            </div>
          </div>
        </div>
      </main>

      <CornerGlyph />

      {/* Footer */}
      <footer className="border-t border-[#2a2538] px-4 sm:px-6 lg:px-10 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="w-5 h-5 rounded-full bg-gradient-to-br from-[#72b1b1] to-[#b57f8b]"
              aria-hidden="true"
            />
            <span className="text-[#f0eaff] text-sm font-medium">Rylee</span>
          </div>
          <div
            className="flex-1 h-px bg-gradient-to-r from-[#72b1b1]/70 via-[#b57f8b]/40 to-transparent"
            aria-hidden="true"
          />
          <span className="text-[#a397b8] text-xs font-mono shrink-0">v2026.01</span>
        </div>
      </footer>
    </div>
  );
}