/*
  Project Worlds — Your World Overview
  Tailwind (reference only, not executed):
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useButton } from 'react-aria';

/* ------------------------------------------------------------------ *
 * Tokens
 * ------------------------------------------------------------------ */

const T = {
  canvas: '#0a0810',
  panel: '#12101a',
  elevated: '#1a1724',
  border: '#2a2538',
  text: '#f0eaff',
  dim: '#a397b8',
  teal: '#72b1b1',
  rose: '#b57f8b',
  gold: '#e4c58d',
} as const;

const RGB: Record<Accent, string> = {
  teal: '114, 177, 177',
  gold: '228, 197, 141',
  rose: '181, 127, 139',
};

const SERIF = { fontFamily: "'Instrument Serif', 'Iowan Old Style', Georgia, serif" };
const SANS = { fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif" };
const MONO = { fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace" };

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */

type Accent = 'teal' | 'gold' | 'rose';

interface Project {
  id: string;
  no: string;
  name: string;
  desc: string;
  status: string;
  accent: Accent;
  href: string;
  modified: string;
  metrics: { label: string; value: string }[];
  tags: string[];
  progress: number;
  progressLabel: string;
  next: string;
}

const PROJECTS: Project[] = [
  {
    id: 'homelab',
    no: '01',
    name: 'The Homelab',
    desc: 'Proxmox, Traefik, Authelia. DR drills run.',
    status: 'Live',
    accent: 'teal',
    href: '#/worlds/homelab',
    modified: 'Modified 2h ago',
    metrics: [
      { label: 'Nodes', value: '3' },
      { label: 'Containers', value: '41' },
      { label: 'Uptime', value: '99.98%' },
      { label: 'Last drill', value: '6d' },
    ],
    tags: ['Proxmox', 'Traefik', 'Authelia', 'ZFS', 'Tailscale'],
    progress: 100,
    progressLabel: 'Steady state',
    next: 'Automate nightly ZFS snapshots to the offsite bucket.',
  },
  {
    id: 'personal-world',
    no: '02',
    name: 'Personal World',
    desc: 'Story-first portfolio. Immersive workspace.',
    status: 'Private Alpha',
    accent: 'gold',
    href: '#/worlds/personal-world',
    modified: 'Modified yesterday',
    metrics: [
      { label: 'Scenes', value: '5' },
      { label: 'Assets', value: '128' },
      { label: 'Bundle', value: '412kb' },
      { label: 'Reviewers', value: '3' },
    ],
    tags: ['Three.js', 'WebGPU', 'Spatial audio', 'Narrative'],
    progress: 62,
    progressLabel: 'Alpha build',
    next: 'Record the opening narration and retime the arrival beat.',
  },
  {
    id: 'vefr',
    no: '03',
    name: 'vefr',
    desc: 'Worldbuilding engine. Cast, chronicle, map, vault.',
    status: 'In Progress',
    accent: 'rose',
    href: '#/worlds/vefr',
    modified: 'Modified 3d ago',
    metrics: [
      { label: 'Cast', value: '24' },
      { label: 'Chronicle', value: '118' },
      { label: 'Maps', value: '7' },
      { label: 'Vault', value: '312' },
    ],
    tags: ['DuckDB', 'Relations', 'Cartography', 'Lore graph'],
    progress: 78,
    progressLabel: 'Engine core',
    next: 'Ship the relation-graph query so the cast map can breathe.',
  },
  {
    id: 'play-nice',
    no: '04',
    name: 'play-nice-contracts',
    desc: '66-contract constitution for humans/agents/tools.',
    status: 'Live',
    accent: 'teal',
    href: '#/worlds/play-nice-contracts',
    modified: 'Modified 5d ago',
    metrics: [
      { label: 'Contracts', value: '66' },
      { label: 'Signatories', value: '12' },
      { label: 'Audits', value: '4' },
      { label: 'Disputes', value: '0' },
    ],
    tags: ['Governance', 'Agents', 'Schema', 'Ratification'],
    progress: 91,
    progressLabel: 'v1.3 pending ratify',
    next: 'Ratify the stewardship clause (C-41) and publish the diff.',
  },
];

interface Activity {
  time: string;
  title: string;
  body: string;
  world: string;
  accent: Accent;
  kind: 'auto' | 'human' | 'alert';
}

const ACTIVITY: Activity[] = [
  {
    time: '11:47',
    title: 'Authelia policy rotated',
    body: 'Two stale sessions revoked. WebAuthn ceremony verified on the second node.',
    world: 'The Homelab',
    accent: 'rose',
    kind: 'alert',
  },
  {
    time: '09:20',
    title: 'Stewardship clause drafted',
    body: 'C-41 opened against play-nice-contracts — diff is 34 lines, waiting on ratify.',
    world: 'play-nice-contracts',
    accent: 'teal',
    kind: 'human',
  },
  {
    time: '07:02',
    title: 'Hero scene lighting pass v3',
    body: 'Warmed the rim light, dropped fog density to 0.18. Arrival reads calmer now.',
    world: 'Personal World',
    accent: 'gold',
    kind: 'human',
  },
  {
    time: '05:38',
    title: 'Relation graph merged',
    body: 'Cast → chronicle traversal lands in main. 118 entries indexed, 7 maps linked.',
    world: 'vefr',
    accent: 'rose',
    kind: 'human',
  },
  {
    time: '04:12',
    title: 'Nightly backup verified',
    body: '41 containers snapshotted, 0 drift against the manifest. Restore drill passed.',
    world: 'The Homelab',
    accent: 'teal',
    kind: 'auto',
  },
];

const CSS = `
@keyframes pw-drift{0%,100%{transform:translate3d(0,0,0) rotate(0deg)}50%{transform:translate3d(-16px,-24px,0) rotate(-1.6deg)}}
@keyframes pw-breathe{0%,100%{opacity:.30;transform:scale(1)}50%{opacity:.62;transform:scale(1.06)}}
@keyframes pw-blink{0%,100%{opacity:1}50%{opacity:.22}}
@keyframes pw-wave{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes pw-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes pw-sheen{0%{transform:translateX(-140%) skewX(-18deg)}55%,100%{transform:translateX(260%) skewX(-18deg)}}
@keyframes pw-bubble{0%{opacity:0;transform:translateY(6px) scale(.6)}30%{opacity:.7}100%{opacity:0;transform:translateY(-42px) scale(1.15)}}
.pw-rise{animation:pw-rise .8s cubic-bezier(.16,1,.3,1) both}
.pw-drift{animation:pw-drift 22s ease-in-out infinite}
.pw-breathe{animation:pw-breathe 9s ease-in-out infinite}
.pw-blink{animation:pw-blink 2.4s ease-in-out infinite}
.pw-wave{animation:pw-wave 14s linear infinite}
.pw-bubble{animation:pw-bubble 7s ease-in-out infinite}
.pw-card{transition:transform .5s cubic-bezier(.16,1,.3,1),border-color .4s ease,background-color .4s ease,box-shadow .5s ease}
.pw-detail{transition:max-height .55s cubic-bezier(.16,1,.3,1),opacity .4s ease}
.pw-bar{transition:width .9s cubic-bezier(.16,1,.3,1)}
.pw-row{transition:transform .35s cubic-bezier(.16,1,.3,1),background-color .35s ease,border-color .35s ease}
.pw-arrow{transition:transform .35s cubic-bezier(.16,1,.3,1)}
.pw-link:hover .pw-arrow,.pw-link:focus-visible .pw-arrow{transform:translateX(5px)}
.pw-sheen{position:absolute;top:0;bottom:0;width:38%;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(240,234,255,.055),transparent);animation:pw-sheen 9s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important;scroll-behavior:auto !important}
}
`;

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

function AriaButton({
  children,
  className,
  ...props
}: React.AriaAttributes & {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton({ ...props, elementType: 'button' }, ref);
  return (
    <button ref={ref} {...buttonProps} className={className}>
      {children}
    </button>
  );
}

function AriaLink({
  children,
  className,
  href,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  'aria-label'?: string;
  'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time' | true | false;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { buttonProps } = useButton({ ...props, elementType: 'a', href }, ref);
  return (
    <a ref={ref} {...buttonProps} href={href} className={className}>
      {children}
    </a>
  );
}

function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setSeen(true)),
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, seen };
}

function useCountUp(target: number, decimals = 0, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value.toFixed(decimals);
}

/* ------------------------------------------------------------------ *
 * Mermaid companion
 * ------------------------------------------------------------------ */

function MermaidMark({
  id,
  className,
  style,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 200 320" className={className} style={style} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={T.teal} stopOpacity="0.95" />
          <stop offset="60%" stopColor={T.teal} stopOpacity="0.5" />
          <stop offset="100%" stopColor={T.gold} stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor={T.teal} stopOpacity="0.55" />
          <stop offset="100%" stopColor={T.teal} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="104" cy="140" rx="96" ry="132" fill={`url(#${id}-glow)`} opacity="0.5" />

      <g
        fill="none"
        stroke={`url(#${id}-stroke)`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* hair, drifting out to the current */}
        <path d="M110 44C84 26 54 40 28 22" opacity="0.65" />
        <path d="M108 52C76 46 52 62 20 54" opacity="0.5" />
        <path d="M112 60C86 66 66 82 36 84" opacity="0.4" />
        <path d="M126 40c14-12 32-8 44-20" opacity="0.45" />
        {/* head */}
        <circle cx="118" cy="56" r="14" />
        {/* torso → tail */}
        <path d="M118 70c-8 14-12 26-8 40 4 15 12 22 10 36-2 16-16 24-14 40 2 15 16 23 30 19" />
        <path d="M118 70c6 12 10 24 8 38" opacity="0.6" />
        {/* arm */}
        <path d="M122 82c16 4 26 16 30 32" opacity="0.7" />
        {/* fluke */}
        <path d="M124 205c-16-4-30 6-38 26 20-2 32-10 38-26Z" opacity="0.85" />
        <path d="M124 205c14 4 22 18 20 38-14-14-19-24-20-38Z" opacity="0.7" />
      </g>
    </svg>
  );
}

function MermaidAmbient() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-end overflow-hidden">
      <MermaidMark
        id="ambient"
        className="pw-drift h-[52vh] w-[52vh] max-w-none translate-x-[26%] translate-y-[16%] opacity-[0.13] blur-[1.4px] sm:h-[62vh] sm:w-[62vh] lg:translate-x-[14%] lg:translate-y-[8%]"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Chrome
 * ------------------------------------------------------------------ */

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(114,177,177,0.10) 1px, transparent 0)',
          backgroundSize: '30px 30px',
          maskImage: 'radial-gradient(120% 90% at 20% 0%, #000 20%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(120% 90% at 20% 0%, #000 20%, transparent 72%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[46vh]"
        style={{ background: 'radial-gradient(80% 100% at 78% -10%, rgba(114,177,177,0.14), transparent 65%)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[38vh]"
        style={{ background: 'radial-gradient(70% 100% at 8% 110%, rgba(181,127,139,0.10), transparent 60%)' }}
      />
    </div>
  );
}

function StatusDot() {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0" role="img" aria-label="All systems online">
      <span className="pw-blink absolute inset-0 rounded-full bg-[#72b1b1]" />
      <span className="absolute inset-0 rounded-full bg-[#72b1b1]/30 blur-[6px]" />
    </span>
  );
}

function Header() {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const time = clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = clock.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const nav = [
    { label: 'Overview', href: '#overview', current: true },
    { label: 'Worlds', href: '#worlds', current: false },
    { label: 'Chronicle', href: '#chronicle', current: false },
    { label: 'Vault', href: '#vault', current: false },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#2a2538] bg-[#0a0810]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div className="flex items-start gap-4">
          <div
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#2a2538] bg-[#1a1724]"
            aria-hidden="true"
          >
            <span className="block h-4 w-4 rounded-full" style={{ background: `radial-gradient(circle at 32% 30%, ${T.teal}, #1d3b3b 70%)` }} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <StatusDot />
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#a397b8]" style={MONO}>
                Project Worlds · your world overview
              </p>
            </div>
            <h1 className="mt-1 text-[30px] leading-[1.05] text-[#f0eaff] sm:text-[38px]" style={SERIF}>
              Good morning, <span className="italic" style={{ color: T.teal }}>Rylee</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:gap-5">
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-1">
            {nav.map((n) => (
              <AriaLink
                key={n.label}
                href={n.href}
                aria-current={n.current ? 'page' : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.16em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810] ${
                  n.current
                    ? 'border-[#72b1b1]/50 bg-[#72b1b1]/10 text-[#f0eaff]'
                    : 'border-[#2a2538] text-[#a397b8] hover:border-[#72b1b1]/40 hover:text-[#f0eaff]'
                }`}
                {...{ style: MONO }}
              >
                {n.label}
              </AriaLink>
            ))}
          </nav>

          <div
            className="hidden items-center gap-3 rounded-lg border border-[#2a2538] bg-[#12101a] px-3 py-1.5 sm:flex"
            aria-live="off"
          >
            <span className="text-[11px] text-[#a397b8]" style={MONO}>
              {date}
            </span>
            <span className="h-3 w-px bg-[#2a2538]" />
            <span className="tabular-nums text-[12px] text-[#e4c58d]" style={MONO}>
              {time}
            </span>
          </div>
        </div>
      </div>
      <div
        className="h-px w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${T.teal}66 18%, ${T.gold}55 55%, transparent)` }}
      />
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-[#2a2538] bg-[#0a0810]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <div className="flex items-baseline gap-3">
          <span className="text-[22px] leading-none text-[#f0eaff]" style={SERIF}>
            Rylee
          </span>
          <span className="h-px w-24 shrink-0 sm:w-40" style={{ background: `linear-gradient(90deg, ${T.teal}, transparent)` }} />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] uppercase tracking-[0.22em] text-[#a397b8]" style={MONO}>
          <span>build 4.12.0-vefr</span>
          <span>tide · calm</span>
          <span>4 worlds tended</span>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ *
 * Instrument strip
 * ------------------------------------------------------------------ */

function Readout({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="group/ro relative flex-1 px-4 py-3.5 sm:px-5">
      <p className="text-[9.5px] uppercase tracking-[0.28em] text-[#a397b8]" style={MONO}>
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="text-[26px] leading-none tabular-nums text-[#f0eaff] sm:text-[30px]" style={SERIF}>
          {value}
        </span>
        {suffix ? (
          <span className="text-[11px] text-[#a397b8]" style={MONO}>
            {suffix}
          </span>
        ) : null}
      </p>
      <span className="absolute inset-y-3 right-0 w-px bg-[#2a2538] group-last/ro:hidden sm:block" aria-hidden="true" />
    </div>
  );
}

function InstrumentStrip() {
  const worlds = useCountUp(4);
  const services = useCountUp(41);
  const uptime = useCountUp(99.98, 2);
  const contracts = useCountUp(66);
  const entries = useCountUp(118);

  return (
    <section
      aria-label="World readouts"
      className="relative overflow-hidden rounded-xl border border-[#2a2538] bg-[#12101a]"
    >
      <div className="pw-sheen" style={{ left: '-20%' }} aria-hidden="true" />
      <div className="relative flex flex-wrap divide-x divide-[#2a2538]">
        <Readout label="Worlds" value={worlds} />
        <Readout label="Services live" value={services} />
        <Readout label="Uptime" value={uptime} suffix="%" />
        <Readout label="Contracts" value={contracts} />
        <Readout label="Chronicle" value={entries} suffix="entries" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

function StatusBadge({ status, accent }: { status: string; accent: Accent }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] uppercase tracking-[0.18em]"
      style={{
        borderColor: `rgba(${RGB[accent]}, 0.45)`,
        color: T[accent],
        backgroundColor: `rgba(${RGB[accent]}, 0.10)`,
        fontFamily: MONO.fontFamily,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: T[accent] }} aria-hidden="true" />
      {status}
    </span>
  );
}

function ProjectCard({
  project,
  expanded,
  pinned,
  onHover,
  onLeave,
  onFocus,
  onBlur,
  onToggle,
  index,
}: {
  project: Project;
  expanded: boolean;
  pinned: boolean;
  onHover: () => void;
  onLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onToggle: () => void;
  index: number;
}) {
  const a = project.accent;
  const ref = useRef<HTMLDivElement>(null);
  const { ref: inViewRef, seen } = useInView<HTMLDivElement>();
  const detailId = `detail-${project.id}`;

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--x', `${e.clientX - r.left}px`);
    el.style.setProperty('--y', `${e.clientY - r.top}px`);
  }, []);

  return (
    <div
      ref={(node) => {
        ref.current = node;
        inViewRef.current = node;
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onMouseMove={handleMove}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`pw-card group relative flex flex-col overflow-hidden rounded-xl border bg-[#12101a] focus-within:border-[rgba(${RGB[a]},0.55)] ${
        expanded
          ? 'border-[rgba(42,37,56,1)] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]'
          : 'border-[#2a2538]'
      } ${seen ? 'pw-rise' : 'opacity-0'}`}
      style={{
        animationDelay: `${index * 90}ms`,
        boxShadow: expanded ? `0 0 0 1px rgba(${RGB[a]},0.22), 0 22px 60px -30px rgba(${RGB[a]},0.35)` : undefined,
        transform: expanded ? 'translateY(-3px)' : undefined,
      }}
    >
      {/* pointer spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(340px circle at var(--x, 50%) var(--y, 0%), rgba(${RGB[a]},0.13), transparent 68%)` }}
      />
      {/* top accent rule */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px origin-left transition-transform duration-500 group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, ${T[a]}, transparent 75%)`, transform: 'scaleX(0.18)' }}
      />

      <div className="relative z-10 flex items-start justify-between gap-3 px-5 pt-5">
        <span className="text-[10px] tabular-nums tracking-[0.3em] text-[#a397b8]" style={MONO}>
          {project.no}
        </span>
        <StatusBadge status={project.status} accent={a} />
      </div>

      <div className="relative z-10 px-5 pb-5 pt-3">
        <AriaButton
          onPress={onToggle}
          aria-expanded={expanded}
          aria-controls={detailId}
          aria-label={`${project.name} — ${project.status}. ${expanded ? 'Collapse' : 'Expand'} details.`}
          className="relative w-full cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#12101a] after:absolute after:inset-x-[-20px] after:inset-y-[-14px] after:content-['']"
        >
          <h3
            className="text-[25px] leading-tight text-[#f0eaff] transition-colors duration-300 group-hover:text-white sm:text-[27px]"
            style={SERIF}
          >
            {project.name}
          </h3>
          <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-[#a397b8]" style={SANS}>
            {project.desc}
          </p>
          <span
            className="mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#a397b8]"
            style={MONO}
          >
            <span
              className={`inline-block h-1 w-1 rounded-full bg-[#72b1b1] transition-transform duration-300 ${
                expanded ? 'rotate-45 scale-125' : ''
              }`}
              aria-hidden="true"
            />
            {pinned ? 'Pinned open' : expanded ? 'Hovering' : 'Details'}
          </span>
        </AriaButton>

        {/* expanding detail panel */}
        <div
          id={detailId}
          aria-hidden={!expanded}
          className={`pw-detail overflow-hidden ${expanded ? 'max-h-[22rem] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="mt-4 border-t border-[#2a2538] pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {project.metrics.map((m) => (
                <div key={m.label}>
                  <dt className="text-[9px] uppercase tracking-[0.2em] text-[#a397b8]" style={MONO}>
                    {m.label}
                  </dt>
                  <dd className="mt-0.5 text-[16px] tabular-nums text-[#f0eaff]" style={SERIF}>
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[9.5px] uppercase tracking-[0.2em] text-[#a397b8]" style={MONO}>
                <span>{project.progressLabel}</span>
                <span className="tabular-nums" style={{ color: T[a] }}>
                  {project.progress}%
                </span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[#2a2538]" role="presentation">
                <div
                  className="pw-bar h-full rounded-full"
                  style={{
                    width: expanded ? `${project.progress}%` : '0%',
                    background: `linear-gradient(90deg, ${T[a]}, rgba(${RGB[a]},0.35))`,
                  }}
                />
              </div>
            </div>

            <p className="mt-4 text-[12.5px] leading-relaxed text-[#f0eaff]/80" style={SANS}>
              <span className="uppercase tracking-[0.2em] text-[#a397b8]" style={MONO}>
                Next ·{' '}
              </span>
              {project.next}
            </p>

            <ul className="mt-3.5 flex flex-wrap gap-1.5" aria-label={`${project.name} stack`}>
              {project.tags.map((t) => (
                <li
                  key={t}
                  className="rounded border border-[#2a2538] bg-[#1a1724] px-2 py-1 text-[9.5px] uppercase tracking-[0.14em] text-[#a397b8]"
                  style={MONO}
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-3 border-t border-[#2a2538] bg-[#0a0810]/40 px-5 py-3.5">
        <span className="text-[10px] tracking-[0.14em] text-[#a397b8]" style={MONO}>
          {project.modified}
        </span>
        <AriaLink
          href={project.href}
          aria-label={`Open ${project.name}`}
          className="pw-link relative z-20 inline-flex items-center gap-1.5 rounded text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 hover:text-[#f0eaff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#12101a]"
          {...{ style: { ...MONO, color: T[a] } }}
        >
          Open <span className="pw-arrow" aria-hidden="true">→</span>
        </AriaLink>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

function Timeline() {
  const { ref, seen } = useInView<HTMLDivElement>(0.05);
  return (
    <section aria-labelledby="activity-heading" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.32em] text-[#a397b8]" style={MONO}>
            Today · 04:12 → 11:47
          </p>
          <h2 id="activity-heading" className="mt-1 text-[28px] leading-none text-[#f0eaff] sm:text-[32px]" style={SERIF}>
            Activity across the worlds
          </h2>
        </div>
        <div className="flex items-center gap-4 text-[9.5px] uppercase tracking-[0.2em] text-[#a397b8]" style={MONO}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#72b1b1]" /> automated
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e4c58d]" /> yours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b57f8b]" /> attention
          </span>
        </div>
      </div>

      <div ref={ref} className="mt-5 overflow-hidden rounded-xl border border-[#2a2538] bg-[#12101a]">
        <ol className="relative">
          <span className="absolute left-[74px] top-0 hidden h-full w-px bg-[#2a2538] sm:block" aria-hidden="true" />
          {ACTIVITY.map((entry, i) => (
            <li
              key={`${entry.time}-${entry.title}`}
              className={`pw-row group relative grid grid-cols-[auto_1fr] gap-x-4 border-b border-[#2a2538] px-4 py-4 last:border-b-0 hover:bg-[#1a1724] sm:grid-cols-[64px_auto_1fr] sm:px-5 ${
                seen ? 'pw-rise' : 'opacity-0'
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <time className="pt-0.5 text-[12px] tabular-nums text-[#a397b8]" dateTime={`2025-01-01T${entry.time}`} style={MONO}>
                {entry.time}
              </time>

              <span className="hidden items-start sm:flex" aria-hidden="true">
                <span
                  className="mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-[#12101a] transition-transform duration-300 group-hover:scale-150"
                  style={{ backgroundColor: T[entry.accent] }}
                />
              </span>

              <div className="min-w-0">
                <p className="text-[15px] text-[#f0eaff]" style={SANS}>
                  {entry.title}
                </p>
                <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-[#a397b8]" style={SANS}>
                  {entry.body}
                </p>
                <p className="mt-2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.2em]" style={MONO}>
                  <span className="h-px w-4" style={{ backgroundColor: T[entry.accent] }} aria-hidden="true" />
                  <span style={{ color: T[entry.accent] }}>{entry.world}</span>
                  <span className="text-[#a397b8]/60">· {entry.kind}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Companion sidebar
 * ------------------------------------------------------------------ */

function Companion() {
  const [vitals, setVitals] = useState({ cpu: 12, mem: 46, pool: 61 });

  useEffect(() => {
    const t = window.setInterval(() => {
      setVitals((v) => ({
        cpu: Math.min(38, Math.max(4, v.cpu + (Math.random() * 6 - 3))),
        mem: Math.min(64, Math.max(34, v.mem + (Math.random() * 4 - 2))),
        pool: Math.min(78, Math.max(52, v.pool + (Math.random() * 3 - 1.5))),
      }));
    }, 2600);
    return () => window.clearInterval(t);
  }, []);

  const bars = [
    { label: 'Node load', value: vitals.cpu, accent: 'teal' as Accent },
    { label: 'Memory', value: vitals.mem, accent: 'gold' as Accent },
    { label: 'ZFS pool', value: vitals.pool, accent: 'rose' as Accent },
  ];

  return (
    <aside aria-label="Companion" className="flex flex-col gap-5">
      {/* mermaid companion */}
      <div className="relative overflow-hidden rounded-xl border border-[#2a2538] bg-[#12101a]">
        <div className="flex items-center justify-between px-4 pt-4">
          <p className="text-[9.5px] uppercase tracking-[0.3em] text-[#a397b8]" style={MONO}>
            Companion
          </p>
          <p className="text-[9.5px] uppercase tracking-[0.2em]" style={{ ...MONO, color: T.teal }}>
            tide · calm
          </p>
        </div>

        <div className="relative h-[240px]">
          <MermaidMark id="companion" className="pw-drift absolute inset-x-0 bottom-0 mx-auto h-[230px] opacity-70" />
          {/* bubbles */}
          <span className="pw-bubble absolute left-[58%] top-[54%] h-1.5 w-1.5 rounded-full border border-[#72b1b1]/60" style={{ animationDelay: '0s' }} aria-hidden="true" />
          <span className="pw-bubble absolute left-[52%] top-[62%] h-1 w-1 rounded-full border border-[#72b1b1]/50" style={{ animationDelay: '2.4s' }} aria-hidden="true" />
          <span className="pw-bubble absolute left-[64%] top-[58%] h-2 w-2 rounded-full border border-[#72b1b1]/40" style={{ animationDelay: '4.1s' }} aria-hidden="true" />
          {/* waterline */}
          <div className="absolute inset-x-0 bottom-0 h-14 overflow-hidden" aria-hidden="true">
            <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="pw-wave h-full w-[200%]">
              <path d="M0 22 C 25 8, 50 8, 75 22 S 125 36, 150 22 S 200 8, 225 22 S 275 36, 300 22 S 350 8, 375 22 L 400 22 L 400 40 L 0 40 Z" fill="rgba(114,177,177,0.10)" />
              <path d="M0 22 C 25 8, 50 8, 75 22 S 125 36, 150 22 S 200 8, 225 22 S 275 36, 300 22 S 350 8, 375 22" fill="none" stroke="rgba(114,177,177,0.35)" strokeWidth="1" />
            </svg>
          </div>
        </div>

        <div className="border-t border-[#2a2538] px-4 py-3.5">
          <p className="text-[13px] leading-relaxed text-[#a397b8]" style={{ ...SANS, fontStyle: 'italic' }}>
            “Four worlds awake. Nothing is on fire — the homelab hums and the chronicle grew by two.”
          </p>
        </div>
      </div>

      {/* vitals */}
      <div className="rounded-xl border border-[#2a2538] bg-[#12101a] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[9.5px] uppercase tracking-[0.3em] text-[#a397b8]" style={MONO}>
            Systems
          </p>
          <span className="inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.2em]" style={{ ...MONO, color: T.teal }}>
            <span className="pw-blink h-1.5 w-1.5 rounded-full bg-[#72b1b1]" aria-hidden="true" /> live
          </span>
        </div>
        <ul className="mt-4 space-y-4">
          {bars.map((b) => (
            <li key={b.label}>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-[#a397b8]" style={MONO}>
                  {b.label}
                </span>
                <span className="text-[12px] tabular-nums" style={{ ...MONO, color: T[b.accent] }}>
                  {b.value.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[#2a2538]" role="presentation">
                <div className="pw-bar h-full rounded-full" style={{ width: `${b.value}%`, background: T[b.accent] }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* attention list */}
      <div className="rounded-xl border border-[#2a2538] bg-[#12101a] p-4">
        <p className="text-[9.5px] uppercase tracking-[0.3em] text-[#a397b8]" style={MONO}>
          Wants attention
        </p>
        <ul className="mt-3 space-y-2.5">
          {[
            { t: 'Ratify C-41', w: 'play-nice-contracts', a: 'teal' as Accent },
            { t: 'Narration pass', w: 'Personal World', a: 'gold' as Accent },
            { t: 'Offsite snapshots', w: 'The Homelab', a: 'rose' as Accent },
          ].map((item) => (
            <li key={item.t} className="flex items-start gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: T[item.a] }} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] text-[#f0eaff]" style={SANS}>
                  {item.t}
                </span>
                <span className="block text-[9.5px] uppercase tracking-[0.18em] text-[#a397b8]" style={MONO}>
                  {item.w}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * Root
 * ------------------------------------------------------------------ */

export default function WorldOverview() {
  const [pinnedId, setPinnedId] = useState<string | null>('homelab');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    const id = 'pw-world-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }, []);

  const activeId = hoverId ?? focusId ?? pinnedId;

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0810] text-[#f0eaff] antialiased"
      style={SANS}
    >
      <style>{CSS}</style>
      <a
        href="#worlds-grid"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[#1a1724] focus:px-4 focus:py-2 focus:text-[12px] focus:outline-none focus:ring-2 focus:ring-[#72b1b1]"
      >
        Skip to worlds
      </a>

      <Backdrop />
      <MermaidAmbient />

      <Header />

      <main className="relative z-10 mx-auto w-full max-w-[1440px] flex-1 px-4 pb-16 pt-7 sm:px-6 lg:px-10">
        <InstrumentStrip />

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[9.5px] uppercase tracking-[0.32em] text-[#a397b8]" style={MONO}>
                  4 worlds · 1 keeper
                </p>
                <h2 className="mt-1 text-[28px] leading-none text-[#f0eaff] sm:text-[32px]" style={SERIF}>
                  Your worlds, <span className="italic" style={{ color: T.gold }}>at a glance</span>
                </h2>
              </div>
              <p className="max-w-[30ch] text-[11.5px] leading-relaxed text-[#a397b8]" style={MONO}>
                Hover or focus a card to open its detail panel. Click to pin it.
              </p>
            </div>

            <div
              id="worlds-grid"
              role="list"
              aria-label="Projects"
              className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5"
            >
              {PROJECTS.map((p, i) => (
                <div role="listitem" key={p.id}>
                  <ProjectCard
                    project={p}
                    index={i}
                    expanded={activeId === p.id}
                    pinned={pinnedId === p.id}
                    onHover={() => setHoverId(p.id)}
                    onLeave={() => setHoverId(null)}
                    onFocus={() => setFocusId(p.id)}
                    onBlur={() => setFocusId(null)}
                    onToggle={() => setPinnedId((cur) => (cur === p.id ? null : p.id))}
                  />
                </div>
              ))}
            </div>

            <Timeline />
          </div>

          <Companion />
        </div>
      </main>

      <Footer />
    </div>
  );
}