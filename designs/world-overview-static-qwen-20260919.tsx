import React, { useRef } from 'react';
import { useButton, useLink } from 'react-aria';

/*
  Tailwind reference (not executed — host app is expected to provide Tailwind + React Aria):
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { darkMode: 'class' }</script>
*/

type BadgeTone = 'teal' | 'gold' | 'rose' | 'green';

interface Metric {
  label: string;
  value: string;
}

interface Project {
  id: string;
  index: string;
  kind: string;
  name: string;
  tagline: string;
  status: string;
  tone: BadgeTone;
  href: string;
  modified: string;
  metrics: Metric[];
  stack: string[];
  note: string;
}

interface ActivityEntry {
  time: string;
  world: string;
  targetId: string;
  tone: BadgeTone;
  title: string;
  detail: string;
}

interface NodeStatus {
  name: string;
  state: string;
  tone: BadgeTone;
}

interface WorldsOverviewProps {
  greeting?: string;
  name?: string;
  dateLine?: string;
  statusLine?: string;
  sectionLabel?: string;
  sectionTitle?: string;
  projects?: Project[];
  activity?: ActivityEntry[];
  nodes?: NodeStatus[];
  tabs?: { label: string; href: string; current?: boolean }[];
}

const TONE: Record<BadgeTone, { hex: string; soft: string; line: string }> = {
  teal: { hex: '#72b1b1', soft: 'rgba(114,177,177,0.13)', line: 'rgba(114,177,177,0.42)' },
  gold: { hex: '#e4c58d', soft: 'rgba(228,197,141,0.13)', line: 'rgba(228,197,141,0.42)' },
  rose: { hex: '#b57f8b', soft: 'rgba(181,127,139,0.14)', line: 'rgba(181,127,139,0.44)' },
  green: { hex: '#7ddc9a', soft: 'rgba(125,220,154,0.13)', line: 'rgba(125,220,154,0.42)' },
};

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'homelab',
    index: '01',
    kind: 'infrastructure',
    name: 'The Homelab',
    tagline: 'Proxmox, Traefik, Authelia. DR drills run.',
    status: 'Live',
    tone: 'teal',
    href: 'https://homelab.rylee.world',
    modified: 'Modified 2 hours ago',
    metrics: [
      { label: 'nodes', value: '5' },
      { label: 'uptime', value: '99.98%' },
      { label: 'drills', value: '14' },
    ],
    stack: ['Proxmox VE 8.2', 'Traefik v3', 'Authelia 4.37', 'restic → B2'],
    note: 'Last disaster-recovery drill restored the full vault in 4m 12s. Backup rotation is 7 daily / 4 weekly / 6 monthly, off-site copy verified nightly.',
  },
  {
    id: 'personal-world',
    index: '02',
    kind: 'portfolio',
    name: 'Personal World',
    tagline: 'Story-first portfolio. Immersive workspace.',
    status: 'Private Alpha',
    tone: 'gold',
    href: 'https://world.rylee.world',
    modified: 'Modified yesterday',
    metrics: [
      { label: 'build', value: 'v0.4.2' },
      { label: 'chapters', value: '6' },
      { label: 'invite', value: '12' },
    ],
    stack: ['React 19', 'Three.js rooms', 'MDX chapters', 'WebAudio ambience'],
    note: 'Navigation is spatial rather than scroll-based — each chapter is a room you enter. Copy is locked through chapter 03; the workbench sequence still needs a pass.',
  },
  {
    id: 'vefr',
    index: '03',
    kind: 'engine',
    name: 'vefr',
    tagline: 'Worldbuilding engine. Cast, chronicle, map, vault.',
    status: 'In Progress',
    tone: 'rose',
    href: 'https://vefr.dev',
    modified: 'Modified 3 days ago',
    metrics: [
      { label: 'modules', value: '4/7' },
      { label: 'entities', value: '318' },
      { label: 'schema', value: 'rev 9' },
    ],
    stack: ['TypeScript core', 'SQLite + vectors', 'Timeline algebra', 'Canvas map'],
    note: 'Cast and chronicle are wired together through lineage edges, so an event in the chronicle can resolve backwards to every person it touched. Map layer is next.',
  },
  {
    id: 'play-nice-contracts',
    index: '04',
    kind: 'protocol',
    name: 'play-nice-contracts',
    tagline: '66-contract constitution for humans/agents/tools.',
    status: 'Live',
    tone: 'teal',
    href: 'https://github.com/rylee/play-nice-contracts',
    modified: 'Modified 5 days ago',
    metrics: [
      { label: 'contracts', value: '66' },
      { label: 'signatories', value: '9' },
      { label: 'violations', value: '0' },
    ],
    stack: ['JSON Schema 2020-12', 'Capability tokens', 'Audit ledger', 'Reference runner'],
    note: 'Contract 66 ratified Sunday: agent tool handoff must declare state explicitly — nothing is inferred from a previous caller. Runner enforces it at the boundary.',
  },
];

const DEFAULT_ACTIVITY: ActivityEntry[] = [
  {
    time: '06:42',
    world: 'The Homelab',
    targetId: 'homelab',
    tone: 'teal',
    title: 'DR drill #14 complete',
    detail: 'Full vault restore from B2 in 4m 12s — 1m 48s under budget. No drift detected.',
  },
  {
    time: '05:58',
    world: 'The Homelab',
    targetId: 'homelab',
    tone: 'teal',
    title: 'Authelia policy tightened',
    detail: '/vault now requires group rylee-admin plus TOTP. Two legacy sessions revoked.',
  },
  {
    time: 'Yesterday',
    world: 'Personal World',
    targetId: 'personal-world',
    tone: 'gold',
    title: 'Chapter 03 copy pass',
    detail: 'Rewrote the workbench sequence, trimmed 40% of the prose, kept the sound cue.',
  },
  {
    time: 'Mon',
    world: 'vefr',
    targetId: 'vefr',
    tone: 'rose',
    title: 'Cast schema: lineage edges',
    detail: 'Parent → child edges landed, plus chronicle back-references on every entity.',
  },
  {
    time: 'Sun',
    world: 'play-nice-contracts',
    targetId: 'play-nice-contracts',
    tone: 'teal',
    title: 'Contract 66 ratified',
    detail: 'Agent tool handoff: state must be declared, never inferred from a prior caller.',
  },
];

const DEFAULT_NODES: NodeStatus[] = [
  { name: 'proxmox-01', state: 'up', tone: 'teal' },
  { name: 'traefik', state: 'up', tone: 'teal' },
  { name: 'authelia', state: 'up', tone: 'teal' },
  { name: 'vefr-core', state: 'build', tone: 'rose' },
  { name: 'contracts', state: 'up', tone: 'teal' },
];

const DEFAULT_TABS = [
  { label: 'Overview', href: '#overview', current: true },
  { label: 'Worlds', href: '#worlds' },
  { label: 'Chronicle', href: '#chronicle' },
  { label: 'Vault', href: '#vault' },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;0,9..144,900;1,9..144,400&family=Space+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

.pw-root{font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.pw-display{font-family:'Fraunces','Iowan Old Style',Georgia,serif;font-variation-settings:'SOFT' 0,'WONK' 1;}
.pw-mono{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace;}

.pw-root :focus-visible{outline:2px solid #72b1b1;outline-offset:3px;border-radius:6px;}
.pw-root summary:focus{outline:none;}
.pw-root summary:focus-visible{outline:2px solid #72b1b1;outline-offset:4px;}

/* ---------- ambient motion ---------- */
@keyframes pwDrift{0%{transform:translate3d(0,0,0) scale(1);}50%{transform:translate3d(4%,-6%,0) scale(1.12);}100%{transform:translate3d(-3%,4%,0) scale(1);}}
@keyframes pwDriftAlt{0%{transform:translate3d(0,0,0) scale(1.05);}50%{transform:translate3d(-6%,5%,0) scale(0.92);}100%{transform:translate3d(3%,-4%,0) scale(1.05);}}
@keyframes pwTide{0%{transform:translateX(-120%);}100%{transform:translateX(320%);}}
@keyframes pwPulse{0%{box-shadow:0 0 0 0 rgba(125,220,154,.55);}70%{box-shadow:0 0 0 9px rgba(125,220,154,0);}100%{box-shadow:0 0 0 0 rgba(125,220,154,0);}}
@keyframes pwAura{0%,100%{opacity:.32;filter:blur(16px);}50%{opacity:.62;filter:blur(22px);}}
@keyframes pwSwim{0%{transform:translateY(0) rotate(-1.2deg);}50%{transform:translateY(-14px) rotate(1.6deg);}100%{transform:translateY(0) rotate(-1.2deg);}}
@keyframes pwSway{0%{transform:rotate(-5deg);}50%{transform:rotate(6deg);}100%{transform:rotate(-5deg);}}
@keyframes pwRise{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes pwArrow{0%{transform:translateX(0);}45%{transform:translateX(7px);}55%{transform:translateX(-3px);}100%{transform:translateX(0);}}
@keyframes pwBlink{0%,100%{opacity:1;}50%{opacity:.15;}}

.pw-orb-a{animation:pwDrift 26s ease-in-out infinite alternate;}
.pw-orb-b{animation:pwDriftAlt 34s ease-in-out infinite alternate;}
.pw-orb-c{animation:pwDrift 44s ease-in-out infinite alternate-reverse;}
.pw-tide{position:absolute;inset-block:0;width:26%;background:linear-gradient(90deg,transparent,rgba(114,177,177,.09),transparent);animation:pwTide 17s linear infinite;}
.pw-live-dot{animation:pwPulse 2.6s ease-out infinite;}
.pw-caret{animation:pwBlink 1.15s steps(2,end) infinite;}

/* ---------- cards ---------- */
.pw-card{position:relative;scroll-margin-top:110px;background:#12101a;border:1px solid #2a2538;transition:transform .5s cubic-bezier(.16,1,.3,1),border-color .35s ease,background .35s ease,box-shadow .5s ease;}
.pw-card::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .5s ease;background:radial-gradient(420px 190px at 12% -10%,var(--pw-glow),transparent 70%);}
.pw-card:hover{transform:translateY(-5px);border-color:#3b3452;background:#161320;box-shadow:0 34px 70px -46px rgba(0,0,0,.95);}
.pw-card:hover::after{opacity:1;}
.pw-card:focus-within{border-color:#3b3452;}
.pw-card:target{border-color:var(--pw-accent);box-shadow:0 0 0 1px var(--pw-accent),0 30px 70px -44px var(--pw-accent);}
.pw-card:target::after{opacity:1;}
@media (min-width:640px){.pw-grid>.pw-card:nth-child(even){margin-top:24px;}}

.pw-peek{max-height:0;opacity:0;overflow:hidden;transition:max-height .55s cubic-bezier(.16,1,.3,1),opacity .4s ease;}
.pw-card:hover .pw-peek,.pw-card:focus-within .pw-peek,.pw-card:target .pw-peek{max-height:70px;opacity:1;}

.pw-root summary{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.pw-root summary::-webkit-details-marker{display:none;}
.pw-chev{transition:transform .4s cubic-bezier(.16,1,.3,1),color .3s ease;}
.pw-root details[open] .pw-chev{transform:rotate(90deg);}
.pw-root details[open] .pw-body{animation:pwRise .45s cubic-bezier(.16,1,.3,1) both;}

.pw-openlink{position:relative;display:inline-flex;align-items:center;gap:.45rem;color:#72b1b1;text-decoration:none;transition:color .3s ease;}
.pw-openlink::after{content:'';position:absolute;left:0;bottom:-3px;height:1px;width:100%;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .4s cubic-bezier(.16,1,.3,1);}
.pw-openlink:hover{color:#a9dede;}
.pw-openlink:hover::after,.pw-openlink:focus-visible::after{transform:scaleX(1);}
.pw-openlink:hover .pw-arrow{animation:pwArrow 1.1s ease-in-out infinite;}

.pw-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid #2a2538;background:#12101a;color:#a397b8;transition:color .25s,border-color .25s,background .25s,transform .25s;}
.pw-iconbtn:hover{color:#f0eaff;border-color:#72b1b1;background:#1a1724;transform:translateY(-2px);}
.pw-iconbtn[aria-pressed='true']{color:#72b1b1;border-color:#72b1b1;background:rgba(114,177,177,.1);}

.pw-tab{position:relative;color:#a397b8;text-decoration:none;transition:color .3s ease;}
.pw-tab::after{content:'';position:absolute;left:0;right:0;bottom:-9px;height:1px;background:#72b1b1;transform:scaleX(0);transform-origin:center;transition:transform .4s cubic-bezier(.16,1,.3,1);}
.pw-tab:hover{color:#f0eaff;}
.pw-tab:hover::after,.pw-tab[aria-current='page']::after{transform:scaleX(1);}
.pw-tab[aria-current='page']{color:#f0eaff;}

.pw-entry{transition:background .35s ease,transform .35s cubic-bezier(.16,1,.3,1);}
.pw-entry:hover{background:#161320;transform:translateX(6px);}
.pw-entry:hover .pw-entry-title{color:#f0eaff;}
.pw-entry:hover .pw-rail-dot{transform:scale(1.9);}
.pw-rail-dot{transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s ease;}

.pw-mermaid{animation:pwSwim 15s ease-in-out infinite;}
.pw-mermaid-aura{animation:pwAura 9s ease-in-out infinite;}
.pw-tendril{transform-box:fill-box;transform-origin:50% 0;animation:pwSway 7s ease-in-out infinite;}
.pw-tendril-2{animation-duration:9s;animation-direction:reverse;}
.pw-tendril-3{animation-duration:11s;}
.pw-bubble{transform-box:fill-box;animation:pwSwim 8s ease-in-out infinite;}

.pw-grain{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");}

@media (prefers-reduced-motion:reduce){
  .pw-root *,.pw-root *::before,.pw-root *::after{animation:none !important;transition-duration:.01ms !important;}
  .pw-card:hover{transform:none;}
  .pw-entry:hover{transform:none;}
  .pw-peek{max-height:none;opacity:1;}
}
`;

/* ------------------------------------------------------------------ */
/*  Ambient mermaid — barely-there presence, teal glow                 */
/* ------------------------------------------------------------------ */
function Mermaid({ size = 168, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.62}
      viewBox="0 0 160 260"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="pw-mermaid overflow-visible"
      style={{ opacity }}
    >
      <defs>
        <radialGradient id="pw-aura" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#72b1b1" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#72b1b1" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#72b1b1" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pw-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a9dede" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#72b1b1" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#b57f8b" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      <ellipse className="pw-mermaid-aura" cx="80" cy="120" rx="66" ry="96" fill="url(#pw-aura)" />

      <g stroke="url(#pw-stroke)" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
        {/* head + hair */}
        <circle cx="78" cy="42" r="12.5" />
        <path d="M67 36C50 46 43 74 53 100" opacity="0.75" />
        <path d="M89 34c17 11 23 34 13 55" opacity="0.6" />
        <path d="M62 44c-9 12-11 30-5 44" opacity="0.4" />
        {/* torso */}
        <path d="M71 54c-5 8-8 15-8 24 0 12 6 19 5 30" />
        <path d="M86 54c7 9 9 18 6 27-3 10-11 15-10 27" />
        {/* arm */}
        <path d="M88 66c12 6 18 16 15 28" opacity="0.7" />
        {/* tail */}
        <path d="M68 108c-2 20 12 33 8 52-4 20-16 28-10 44 4 12 18 19 24 30" />
        <path d="M90 234c-14-2-24-9-28-20" opacity="0.6" />
        {/* fin */}
        <path d="M90 234c13-8 27-6 36 5-11 3-19 10-23 20-6-10-9-17-13-25Z" opacity="0.85" />
        <path d="M90 234c-13 4-22 13-24 25 10-3 19-9 24-25Z" opacity="0.5" />
      </g>

      {/* tendrils / trailing weed */}
      <g stroke="#72b1b1" strokeWidth="0.9" strokeLinecap="round" opacity="0.45" fill="none">
        <path className="pw-tendril" d="M53 100c-6 16-2 30 4 44" />
        <path className="pw-tendril pw-tendril-2" d="M46 122c-8 14-9 28-4 42" />
        <path className="pw-tendril pw-tendril-3" d="M103 94c7 16 7 32 1 46" />
      </g>

      {/* bubbles */}
      <g fill="#72b1b1" opacity="0.5">
        <circle className="pw-bubble" cx="118" cy="70" r="2.4" />
        <circle className="pw-bubble" cx="126" cy="46" r="1.5" style={{ animationDelay: '1.4s' }} />
        <circle className="pw-bubble" cx="36" cy="88" r="1.9" style={{ animationDelay: '2.6s' }} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */
function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <span
      className="pw-mono inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-medium uppercase tracking-[0.18em] sm:text-[10px]"
      style={{ color: t.hex, borderColor: t.line, background: t.soft }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: t.hex, boxShadow: `0 0 8px ${t.hex}` }} />
      {children}
    </span>
  );
}

function WorldLink({
  href,
  children,
  ariaLabel,
  className,
}: {
  href: string;
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { linkProps } = useLink({ href, 'aria-label': ariaLabel }, ref as React.RefObject<HTMLElement>);
  return (
    <a {...linkProps} ref={ref} href={href} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  );
}

function IconAction({
  label,
  pressed = false,
  children,
}: {
  label: string;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton({ type: 'button', 'aria-label': label, 'aria-pressed': pressed }, ref);
  return (
    <button {...buttonProps} ref={ref} type="button" aria-label={label} title={label} className="pw-iconbtn rounded-md">
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Project card                                                       */
/* ------------------------------------------------------------------ */
function ProjectCard({ project, expandedLabel }: { project: Project; expandedLabel: string }) {
  const t = TONE[project.tone];
  const detailsId = `${project.id}-notes`;

  return (
    <article
      id={project.id}
      className="pw-card group overflow-hidden rounded-[14px]"
      style={{ ['--pw-accent' as string]: t.hex, ['--pw-glow' as string]: t.soft }}
    >
      <span
        aria-hidden="true"
        className="block h-px w-full"
        style={{ background: `linear-gradient(90deg, ${t.hex}, transparent 72%)` }}
      />

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="pw-mono text-[9.5px] uppercase tracking-[0.3em] text-[#a397b8]">
              {project.index} <span style={{ color: t.hex }}>/</span> {project.kind}
            </p>
            <h3 className="pw-display mt-2 truncate text-[26px] font-medium leading-none tracking-tight text-[#f0eaff] sm:text-[30px]">
              {project.name}
            </h3>
          </div>
          <StatusBadge tone={project.tone}>{project.status}</StatusBadge>
        </div>

        <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-[#a397b8]">{project.tagline}</p>

        {/* hover / focus / :target reveal */}
        <div className="pw-peek">
          <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-dashed border-[#2a2538] pt-3">
            {project.metrics.map((m) => (
              <div key={m.label} className="flex items-baseline gap-1.5">
                <dt className="pw-mono text-[9.5px] uppercase tracking-[0.16em] text-[#a397b8]">{m.label}</dt>
                <dd className="pw-mono text-[13px] font-medium" style={{ color: t.hex }}>
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <details className="pw-details mt-4" id={detailsId}>
          <summary
            className="pw-mono flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#a397b8] transition-colors hover:text-[#f0eaff]"
            aria-controls={detailsId}
          >
            <span className="pw-chev inline-block" style={{ color: t.hex }} aria-hidden="true">
              ▸
            </span>
            {expandedLabel}
          </summary>

          <div className="pw-body mt-3 rounded-lg border border-[#2a2538] bg-[#1a1724] p-4">
            <ul className="flex flex-wrap gap-1.5">
              {project.stack.map((s) => (
                <li
                  key={s}
                  className="pw-mono rounded-sm border border-[#2a2538] bg-[#12101a] px-2 py-1 text-[10.5px] text-[#a397b8]"
                >
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[#a397b8]">{project.note}</p>
          </div>
        </details>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#2a2538] pt-4">
          <WorldLink
            href={project.href}
            ariaLabel={`Open ${project.name} in a new context`}
            className="pw-openlink pw-mono text-[11px] uppercase tracking-[0.2em]"
          >
            Open <span className="pw-arrow" aria-hidden="true">→</span>
          </WorldLink>
          <span className="pw-mono text-[10.5px] tracking-wide text-[#a397b8]/80">{project.modified}</span>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity timeline                                                  */
/* ------------------------------------------------------------------ */
function ActivityTimeline({ entries, heading }: { entries: ActivityEntry[]; heading: string }) {
  return (
    <section aria-labelledby="pw-activity-heading" className="mt-14 sm:mt-20">
      <div className="flex items-end gap-4">
        <h2 id="pw-activity-heading" className="pw-display text-[26px] font-medium leading-none text-[#f0eaff] sm:text-[34px]">
          {heading}
        </h2>
        <span aria-hidden="true" className="mb-2 h-px flex-1 bg-gradient-to-r from-[#2a2538] to-transparent" />
        <span className="pw-mono mb-1 shrink-0 text-[9.5px] uppercase tracking-[0.28em] text-[#a397b8]">last 3 days</span>
      </div>

      <ol className="relative mt-6 border-l border-[#2a2538] pl-5 sm:pl-7">
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 h-24 w-px"
          style={{ background: 'linear-gradient(180deg,#72b1b1,transparent)' }}
        />
        {entries.map((e, i) => {
          const t = TONE[e.tone];
          return (
            <li
              key={`${e.time}-${e.title}`}
              className="pw-entry relative rounded-lg py-4 pl-3 pr-3 sm:pl-4"
              style={{ animation: `pwRise .6s cubic-bezier(.16,1,.3,1) ${i * 90}ms both` }}
            >
              <span
                aria-hidden="true"
                className="pw-rail-dot absolute -left-[26px] top-[26px] h-2 w-2 rounded-full sm:-left-[34px]"
                style={{ background: t.hex, boxShadow: `0 0 12px ${t.hex}` }}
              />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="pw-mono w-[68px] shrink-0 text-[10.5px] uppercase tracking-[0.14em] text-[#a397b8]">
                  {e.time}
                </span>
                <WorldLink
                  href={`#${e.targetId}`}
                  ariaLabel={`Jump to ${e.world} from the activity log`}
                  className="pw-entry-title pw-mono text-[11px] uppercase tracking-[0.18em] text-[#f0eaff] no-underline transition-colors"
                >
                  {e.world}
                </WorldLink>
              </div>
              <p className="mt-1.5 text-[15px] font-medium leading-snug text-[#a397b8] sm:text-[16.5px]">{e.title}</p>
              <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-[#a397b8]/70">{e.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar rail                                                       */
/* ------------------------------------------------------------------ */
function SidebarRail({ nodes, label }: { nodes: NodeStatus[]; label: string }) {
  return (
    <aside
      aria-label="Ambient world status"
      className="sticky top-10 hidden w-[196px] shrink-0 flex-col gap-8 self-start lg:flex"
    >
      <div className="relative flex items-center justify-center rounded-[14px] border border-[#2a2538] bg-[#12101a]/60 py-6">
        <Mermaid size={132} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[14px]"
          style={{ background: 'radial-gradient(120px 160px at 50% 45%, rgba(114,177,177,0.09), transparent 70%)' }}
        />
      </div>

      <div>
        <p className="pw-mono text-[9.5px] uppercase tracking-[0.3em] text-[#a397b8]">{label}</p>
        <ul className="mt-3 space-y-2">
          {nodes.map((n) => {
            const t = TONE[n.tone];
            return (
              <li key={n.name} className="flex items-center justify-between gap-2">
                <span className="pw-mono flex items-center gap-2 text-[11px] text-[#a397b8]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: t.hex, boxShadow: `0 0 8px ${t.hex}` }}
                    aria-hidden="true"
                  />
                  {n.name}
                </span>
                <span className="pw-mono text-[9.5px] uppercase tracking-[0.14em]" style={{ color: t.hex }}>
                  {n.state}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="pw-display text-[15px] italic leading-snug text-[#a397b8]/70">
        “A world is just a set of promises you keep on purpose.”
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function ProjectWorldsOverview({
  greeting = 'Good morning',
  name = 'Rylee',
  dateLine = 'Thu 14 Mar · 07:12 GMT+11',
  statusLine = 'All systems nominal',
  sectionLabel = '01 / worlds',
  sectionTitle = 'Your World Overview',
  projects = DEFAULT_PROJECTS,
  activity = DEFAULT_ACTIVITY,
  nodes = DEFAULT_NODES,
  tabs = DEFAULT_TABS,
}: WorldsOverviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { buttonProps: menuProps } = useButton({ type: 'button', 'aria-label': 'Open world menu' }, ref);

  return (
    <div
      ref={ref}
      className="pw-root relative flex min-h-screen flex-col overflow-hidden bg-[#0a0810] text-[#f0eaff]"
      id="overview"
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ---------------- ambient layers ---------------- */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <div
          className="pw-orb-a absolute -left-40 -top-40 h-[620px] w-[620px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(114,177,177,0.16), transparent 62%)' }}
        />
        <div
          className="pw-orb-b absolute -right-40 top-1/3 h-[560px] w-[560px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(181,127,139,0.13), transparent 62%)' }}
        />
        <div
          className="pw-orb-c absolute bottom-[-220px] left-1/3 h-[520px] w-[520px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(228,197,141,0.09), transparent 62%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #2a2538 1px, transparent 1px), linear-gradient(to bottom, #2a2538 1px, transparent 1px)',
            backgroundSize: '76px 76px',
            maskImage: 'radial-gradient(circle at 50% 30%, black, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 30%, black, transparent 78%)',
          }}
        />
        <div className="pw-grain absolute inset-0 opacity-[0.05] mix-blend-overlay" />
        <div className="absolute inset-x-0 top-0 h-px overflow-hidden bg-[#12101a]">
          <div className="pw-tide h-full" />
        </div>
      </div>

      {/* corner mermaid — mobile ambient presence */}
      <div aria-hidden="true" className="pointer-events-none fixed bottom-2 right-2 z-0 opacity-[0.14] lg:hidden">
        <Mermaid size={104} />
      </div>

      {/* ---------------- header ---------------- */}
      <header className="relative z-10 border-b border-[#2a2538] bg-[#0a0810]/70 backdrop-blur-[2px]">
        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <span
                className="pw-display grid h-9 w-9 place-items-center rounded-md border border-[#2a2538] bg-[#12101a] text-[15px] font-semibold"
                style={{ color: '#72b1b1', boxShadow: 'inset 0 0 18px rgba(114,177,177,0.16)' }}
                aria-hidden="true"
              >
                ⌘
              </span>
              <div className="leading-tight">
                <p className="pw-mono text-[9px] uppercase tracking-[0.34em] text-[#a397b8]">project worlds</p>
                <p className="pw-display text-[15px] font-medium text-[#f0eaff]">control room</p>
              </div>
            </div>

            <nav aria-label="Primary" className="hidden md:block">
              <ul className="pw-mono flex items-center gap-7 text-[10.5px] uppercase tracking-[0.22em]">
                {tabs.map((tab) => (
                  <li key={tab.label}>
                    <WorldLink
                      href={tab.href}
                      ariaLabel={tab.label}
                      className="pw-tab py-2"
                      {...(tab.current ? { 'aria-current': 'page' as const } : {})}
                    >
                      {tab.label}
                    </WorldLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center gap-2">
              <IconAction label="Grid view" pressed>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="5" height="5" stroke="currentColor" />
                  <rect x="8" y="1" width="5" height="5" stroke="currentColor" />
                  <rect x="1" y="8" width="5" height="5" stroke="currentColor" />
                  <rect x="8" y="8" width="5" height="5" stroke="currentColor" />
                </svg>
              </IconAction>
              <IconAction label="Chronological view">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 3h12M1 7h12M1 11h8" stroke="currentColor" strokeLinecap="round" />
                </svg>
              </IconAction>
              <button
                {...menuProps}
                ref={ref}
                type="button"
                className="pw-iconbtn rounded-md"
                title="Open world menu"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="7" cy="2.5" r="1.2" fill="currentColor" />
                  <circle cx="7" cy="7" r="1.2" fill="currentColor" />
                  <circle cx="7" cy="11.5" r="1.2" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6 pb-9 pt-3 sm:pb-11 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="pw-mono flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.3em] text-[#a397b8]">
                {dateLine}
                <span className="text-[#72b1b1]">·</span>
                session 04
              </p>
              <h1 className="pw-display mt-3 text-[40px] font-light leading-[0.95] tracking-[-0.02em] text-[#f0eaff] sm:text-[58px] lg:text-[68px]">
                {greeting},
                <br />
                <span className="font-semibold italic" style={{ color: '#e4c58d' }}>
                  {name}
                </span>
                <span className="pw-caret ml-1 inline-block h-[0.82em] w-[3px] translate-y-[0.06em] bg-[#72b1b1] align-baseline" />
              </h1>
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <div
                className="flex items-center gap-2.5 rounded-full border px-3.5 py-2"
                style={{ borderColor: 'rgba(125,220,154,0.35)', background: 'rgba(125,220,154,0.07)' }}
                role="status"
                aria-live="polite"
              >
                <span
                  className="pw-live-dot h-2 w-2 shrink-0 rounded-full bg-[#7ddc9a]"
                  style={{ boxShadow: '0 0 12px #7ddc9a' }}
                  aria-hidden="true"
                />
                <span className="pw-mono text-[10.5px] uppercase tracking-[0.2em]" style={{ color: '#7ddc9a' }}>
                  {statusLine}
                </span>
              </div>
              <p className="pw-mono max-w-[34ch] text-[11px] leading-relaxed text-[#a397b8] md:text-right">
                <span className="text-[#f0eaff]">{projects.length}</span> worlds ·{' '}
                <span className="text-[#72b1b1]">
                  {projects.filter((p) => p.status === 'Live').length} live
                </span>{' '}
                · <span className="text-[#b57f8b]">1 in build</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------- body ---------------- */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1240px] flex-1 gap-10 px-5 py-10 sm:px-8 lg:py-14">
        <SidebarRail nodes={nodes} label="system pulse" />

        <main id="worlds" className="min-w-0 flex-1">
          <div className="flex items-end gap-4">
            <div>
              <p className="pw-mono text-[9.5px] uppercase tracking-[0.34em] text-[#a397b8]">{sectionLabel}</p>
              <h2 className="pw-display mt-2 text-[30px] font-medium leading-none tracking-tight text-[#f0eaff] sm:text-[42px]">
                {sectionTitle}
              </h2>
            </div>
            <span
              aria-hidden="true"
              className="mb-3 h-px flex-1 bg-gradient-to-r from-[#2a2538] to-transparent"
            />
          </div>

          <p className="mt-4 max-w-[58ch] text-[14.5px] leading-relaxed text-[#a397b8]">
            Everything you maintain, in one glance. Hover a world to surface its vitals, open the notes for the
            long story, or jump straight out through the door.
          </p>

          <div className="pw-grid mt-8 grid gap-5 sm:grid-cols-2">
            {projects.map((p, i) => (
              <div key={p.id} style={{ animation: `pwRise .7s cubic-bezier(.16,1,.3,1) ${i * 110}ms both` }}>
                <ProjectCard project={p} expandedLabel="System notes" />
              </div>
            ))}
          </div>

          <ActivityTimeline entries={activity} heading="Activity" />

          <div
            id="vault"
            className="mt-14 flex flex-col gap-5 rounded-[14px] border border-[#2a2538] bg-[#12101a] p-6 sm:flex-row sm:items-center sm:justify-between"
            style={{ ['--pw-glow' as string]: 'rgba(228,197,141,0.14)' }}
          >
            <div>
              <p className="pw-mono text-[9.5px] uppercase tracking-[0.3em] text-[#e4c58d]">next up</p>
              <p className="pw-display mt-2 text-[22px] font-medium leading-tight text-[#f0eaff] sm:text-[26px]">
                Map layer for{' '}
                <span className="italic" style={{ color: '#b57f8b' }}>
                  vefr
                </span>{' '}
                — chronicle coordinates onto the atlas.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <WorldLink
                href="https://vefr.dev"
                ariaLabel="Open vefr map layer work"
                className="pw-openlink pw-mono rounded-md border border-[#2a2538] bg-[#1a1724] px-4 py-2.5 text-[10.5px] uppercase tracking-[0.2em] !text-[#f0eaff]"
              >
                Resume work <span className="pw-arrow" aria-hidden="true">→</span>
              </WorldLink>
              <WorldLink
                href="#chronicle"
                ariaLabel="Jump to chronicle"
                className="pw-mono text-[10.5px] uppercase tracking-[0.2em] text-[#a397b8] no-underline transition-colors hover:text-[#72b1b1]"
              >
                Chronicle
              </WorldLink>
            </div>
          </div>
        </main>
      </div>

      {/* ---------------- footer ---------------- */}
      <footer className="relative z-10 border-t border-[#2a2538] bg-[#0a0810]/80">
        <div
          aria-hidden="true"
          className="h-px w-full"
          style={{ background: 'linear-gradient(90deg,#72b1b1,rgba(181,127,139,0.5) 42%,transparent 88%)' }}
        />
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-baseline gap-3">
            <span className="pw-display text-[24px] font-semibold tracking-tight text-[#f0eaff]">{name}</span>
            <span className="pw-mono text-[9.5px] uppercase tracking-[0.3em] text-[#a397b8]">
              worlds · kept on purpose
            </span>
          </div>
          <p className="pw-mono text-[10px] uppercase tracking-[0.22em] text-[#a397b8]/70">
            rendered 07:12 · 4 worlds · 66 contracts · 0 violations
          </p>
        </div>
      </footer>
    </div>
  );
}