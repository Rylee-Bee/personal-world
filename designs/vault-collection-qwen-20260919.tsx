/* Project Worlds — Vault Collection
 *
 * Tailwind (reference only — not executed):
 *   <script src="https://cdn.tailwindcss.com"></script>
 *
 * Requires: react, react-dom, react-aria, react-stately, tailwindcss
 */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  useButton,
  useFocusRing,
  useSearchField,
  useTab,
  useTabList,
  useTabPanel,
} from 'react-aria';
import {useSearchFieldState, useTabListState, useTabState} from 'react-stately';

/* ------------------------------------------------------------------ tokens */

const TOKEN = {
  canvas: '#0a0810',
  panel: '#12101a',
  elevated: '#1a1724',
  border: '#2a2538',
  text: '#f0eaff',
  muted: '#a397b8',
  teal: '#72b1b1',
  rose: '#b57f8b',
  gold: '#e4c58d',
  alive: '#79c98f',
} as const;

type CategoryKey = 'infrastructure' | 'automation' | 'security' | 'data' | 'observability';
type StatusKey = 'active' | 'retired' | 'experimental';

const CATEGORY: Record<CategoryKey, {label: string; color: string}> = {
  infrastructure: {label: 'Infrastructure', color: TOKEN.teal},
  automation: {label: 'Automation', color: TOKEN.gold},
  security: {label: 'Security', color: TOKEN.rose},
  data: {label: 'Data', color: TOKEN.teal},
  observability: {label: 'Observability', color: TOKEN.gold},
};

const STATUS: Record<StatusKey, {label: string; color: string}> = {
  active: {label: 'active', color: TOKEN.teal},
  experimental: {label: 'experimental', color: TOKEN.gold},
  retired: {label: 'retired', color: TOKEN.muted},
};

interface VaultEntry {
  key: string;
  name: string;
  glyph: string;
  category: CategoryKey;
  status: StatusKey;
  blurb: string;
  detail: string;
  version: string;
  tags: string[];
  lastUsed: string;
  ago: number; // minutes
  usage: number[];
}

const ENTRIES: VaultEntry[] = [
  {
    key: 'proxmox', name: 'Proxmox VE', glyph: 'PX', category: 'infrastructure', status: 'active',
    blurb: 'Hypervisor cluster holding the whole rack together.',
    detail: 'Three nodes, forty-two VMs and a corosync ring that has not lost quorum since March. Every other entry in this vault eventually boots on top of it.',
    version: 'v8.2.4', tags: ['kvm', 'lxc', 'corosync'], lastUsed: '12 minutes ago', ago: 12,
    usage: [4, 6, 3, 7, 5, 8, 6],
  },
  {
    key: 'traefik', name: 'Traefik', glyph: 'TF', category: 'infrastructure', status: 'active',
    blurb: 'One front door, every service routed behind it.',
    detail: 'File-provider routers with automatic certificate issuance. Reloads are watched, not scheduled.',
    version: 'v3.1', tags: ['proxy', 'tls'], lastUsed: '38 minutes ago', ago: 38,
    usage: [6, 5, 7, 4, 6, 7, 7],
  },
  {
    key: 'authelia', name: 'Authelia', glyph: 'AU', category: 'security', status: 'active',
    blurb: 'Single sign-on and the two-factor gatekeeper.',
    detail: 'Nothing reaches the dashboard without a TOTP challenge. Sessions are short by design.',
    version: 'v4.37', tags: ['sso', 'totp'], lastUsed: '2 hours ago', ago: 120,
    usage: [3, 4, 5, 4, 6, 5, 6],
  },
  {
    key: 'docker', name: 'Docker', glyph: 'DK', category: 'infrastructure', status: 'active',
    blurb: 'The runtime most of the vault ships as.',
    detail: 'Compose files pinned by digest. Volumes live on the datastore, never on root.',
    version: 'v27.1', tags: ['compose', 'oci'], lastUsed: '3 hours ago', ago: 180,
    usage: [7, 6, 8, 7, 6, 8, 7],
  },
  {
    key: 'git', name: 'Git', glyph: 'GT', category: 'automation', status: 'active',
    blurb: 'Every config in this vault is versioned and signed.',
    detail: 'Bare repo on the homelab host; commits are signed with the YubiKey that hangs by the monitor.',
    version: 'v2.45', tags: ['vcs', 'gpg'], lastUsed: '5 hours ago', ago: 300,
    usage: [5, 7, 6, 8, 7, 6, 8],
  },
  {
    key: 'python', name: 'Python', glyph: 'PY', category: 'data', status: 'active',
    blurb: 'Glue scripts, scrapers, the nightly backup verifier.',
    detail: 'A dozen single-file scripts run from cron. The verifier is the only one with tests.',
    version: '3.12', tags: ['scripts', 'etl'], lastUsed: '1 hour ago', ago: 60,
    usage: [4, 5, 6, 5, 7, 5, 6],
  },
  {
    key: 'sqlite', name: 'SQLite', glyph: 'SL', category: 'data', status: 'active',
    blurb: 'Twelve databases pretending the cluster is not real.',
    detail: 'WAL mode, nightly snapshots, and a restore drill that actually gets run once a quarter.',
    version: '3.45', tags: ['embedded', 'wal'], lastUsed: '6 hours ago', ago: 360,
    usage: [6, 4, 5, 6, 5, 7, 5],
  },
  {
    key: 'ansible', name: 'Ansible', glyph: 'AN', category: 'automation', status: 'active',
    blurb: 'Idempotent playbooks that rebuild the rack from scratch.',
    detail: 'Inventory in one YAML file. The provision playbook is the reason the rack can be lost and recovered in an afternoon.',
    version: 'v9.6', tags: ['iac', 'playbooks'], lastUsed: 'yesterday', ago: 1440,
    usage: [3, 5, 4, 6, 3, 5, 4],
  },
  {
    key: 'kubernetes', name: 'Kubernetes', glyph: 'K8', category: 'infrastructure', status: 'experimental',
    blurb: 'Single-node k3s running behind a mental feature flag.',
    detail: 'Everything works, nothing is load-bearing. The ingress is still Traefik because Traefik was here first.',
    version: 'v1.30', tags: ['k3s', 'pilot'], lastUsed: 'a day ago', ago: 1560,
    usage: [2, 3, 2, 4, 3, 2, 3],
  },
  {
    key: 'gha', name: 'GitHub Actions', glyph: 'GA', category: 'automation', status: 'active',
    blurb: 'CI that ships the vault’s configs on every merge.',
    detail: 'Two self-hosted runners sit under the desk. Secrets stay in the vault, not the workflow.',
    version: 'runner 2.321', tags: ['ci', 'runners'], lastUsed: '2 days ago', ago: 2880,
    usage: [4, 3, 5, 4, 3, 4, 5],
  },
  {
    key: 'bash', name: 'Bash', glyph: 'SH', category: 'automation', status: 'retired',
    blurb: 'Retired for Python. The old scripts still haunt /srv.',
    detail: 'Kept in the vault for reference — six of them are still cron-scheduled and will be migrated before the next release.',
    version: '5.2', tags: ['legacy', 'cron'], lastUsed: '3 weeks ago', ago: 30240,
    usage: [1, 2, 1, 1, 2, 1, 1],
  },
];

const TABS: Array<{key: string; label: string; match?: CategoryKey}> = [
  {key: 'all', label: 'All'},
  {key: 'infrastructure', label: 'Infrastructure', match: 'infrastructure'},
  {key: 'automation', label: 'Automation', match: 'automation'},
  {key: 'security', label: 'Security', match: 'security'},
  {key: 'data', label: 'Data', match: 'data'},
  {key: 'observability', label: 'Observability', match: 'observability'},
];

const TAB_META = Object.fromEntries(TABS.map((t) => [t.key, t]));

const LEDGER = [
  {t: '06:12', text: 'traefik reloaded 14 routers'},
  {t: '05:47', text: 'ansible proxmox.provision · ok'},
  {t: '04:02', text: 'backup verify · 12 dbs ok'},
  {t: '01:30', text: 'authelia rotated session keys'},
];

const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ style */

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');

.pw-root{font-family:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.pw-display{font-family:'Instrument Serif','Iowan Old Style',Georgia,serif;font-weight:400;}
.pw-mono{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;}

.pw-root :focus-visible{outline:2px solid ${TOKEN.teal};outline-offset:3px;border-radius:3px;}
.pw-root :focus:not(:focus-visible){outline:none;}

@keyframes pwCardIn{
  from{opacity:0;transform:translateY(12px) scale(.985);}
  to{opacity:1;transform:translateY(0) scale(1);}
}
.pw-card-in{animation:pwCardIn .5s cubic-bezier(.22,.68,.32,1) both;}

@keyframes pwFloat{
  0%{transform:translate3d(0,0,0) rotate(-1.2deg);}
  50%{transform:translate3d(-10px,-16px,0) rotate(1.4deg);}
  100%{transform:translate3d(0,0,0) rotate(-1.2deg);}
}
.pw-float{animation:pwFloat 19s ease-in-out infinite;}

@keyframes pwBreathe{0%,100%{opacity:.55;transform:scale(1);}50%{opacity:.95;transform:scale(1.07);}}
.pw-breathe{animation:pwBreathe 9s ease-in-out infinite;}

@keyframes pwPulse{0%{transform:scale(1);opacity:.55;}70%{transform:scale(2.4);opacity:0;}100%{transform:scale(2.4);opacity:0;}}
.pw-pulse{animation:pwPulse 2.8s cubic-bezier(.3,.6,.4,1) infinite;}

@keyframes pwRise{0%{transform:translateY(0);opacity:0;}12%{opacity:.8;}100%{transform:translateY(-150px);opacity:0;}}
.pw-rise{animation:pwRise 11s linear infinite;}

@keyframes pwDraw{from{stroke-dashoffset:220;}to{stroke-dashoffset:0;}}
.pw-draw{stroke-dasharray:220;animation:pwDraw 1.6s .25s cubic-bezier(.4,0,.2,1) both;}

@keyframes pwLine{from{transform:scaleX(0);}to{transform:scaleX(1);}}
.pw-line{transform-origin:left center;animation:pwLine 1.2s .1s cubic-bezier(.22,.68,.32,1) both;}

@keyframes pwSweep{from{transform:translateX(-120%) skewX(-14deg);}to{transform:translateX(240%) skewX(-14deg);}}
.pw-sheen{animation:pwSweep 1.1s cubic-bezier(.3,.7,.3,1);}

.pw-root ::selection{background:${TOKEN.teal};color:${TOKEN.canvas};}
.pw-scroll::-webkit-scrollbar{width:10px;height:10px;}
.pw-scroll::-webkit-scrollbar-track{background:${TOKEN.canvas};}
.pw-scroll::-webkit-scrollbar-thumb{background:${TOKEN.border};border-radius:99px;border:3px solid ${TOKEN.canvas};}
.pw-scroll::-webkit-scrollbar-thumb:hover{background:${TOKEN.teal};}

@media (prefers-reduced-motion: reduce){
  .pw-root *,.pw-root *::before,.pw-root *::after{
    animation-duration:.001ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.001ms !important;
    scroll-behavior:auto !important;
  }
  .pw-float,.pw-breathe,.pw-pulse,.pw-rise,.pw-sheen,.pw-draw,.pw-line,.pw-card-in{animation:none !important;opacity:1 !important;transform:none !important;}
}
`;

/* ------------------------------------------------------------------ primitives */

function PressButton({
  children, className, ariaLabel, onPress, ...rest
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  onPress: () => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onPress'>) {
  const ref = useRef<HTMLButtonElement>(null);
  const {buttonProps, isPressed} = useButton(
    {elementType: 'button', 'aria-label': ariaLabel, onPress, isDisabled: rest.disabled as boolean | undefined},
    ref,
  );
  return (
    <button
      {...buttonProps}
      ref={ref}
      aria-pressed={rest['aria-pressed'] as boolean | undefined}
      className={cn(
        'transition-[transform,background-color,border-color,color] duration-200 ease-out active:scale-[.97]',
        className,
      )}
      style={rest.style}
    >
      {children}
    </button>
  );
}

function StatusDot({color, size = 6}: {color: string; size?: number}) {
  return (
    <span className="relative inline-flex shrink-0" style={{width: size, height: size}}>
      <span
        className="pw-pulse absolute inset-0 rounded-full"
        style={{background: color}}
        aria-hidden
      />
      <span className="relative inline-block rounded-full" style={{width: size, height: size, background: color}} />
    </span>
  );
}

/* ------------------------------------------------------------------ backdrop */

function AmbientBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0810]" />
      <div
        className="pw-breathe absolute -top-56 left-1/2 h-[560px] w-[min(1100px,120vw)] -translate-x-1/2 blur-[130px]"
        style={{background: `radial-gradient(closest-side, ${TOKEN.teal}, transparent 72%)`, opacity: 0.16}}
      />
      <div
        className="absolute -bottom-40 left-[-10%] h-[520px] w-[520px] blur-[140px]"
        style={{background: `radial-gradient(closest-side, ${TOKEN.rose}, transparent 70%)`, opacity: 0.1}}
      />
      <div
        className="absolute right-[-8%] top-1/3 h-[420px] w-[420px] blur-[150px]"
        style={{background: `radial-gradient(closest-side, ${TOKEN.gold}, transparent 72%)`, opacity: 0.07}}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${TOKEN.border} 1px, transparent 1px), linear-gradient(to bottom, ${TOKEN.border} 1px, transparent 1px)`,
          backgroundSize: '72px 72px',
          opacity: 0.22,
          maskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, #000 20%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, #000 20%, transparent 78%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{background: 'radial-gradient(ellipse 120% 80% at 50% 120%, rgba(0,0,0,.75), transparent 60%)'}}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ mermaid companion */

function MermaidCompanion() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-[-10px] right-[-6px] z-0 select-none sm:right-2 lg:right-8"
    >
      <div
        className="pw-breathe absolute bottom-6 right-4 h-[300px] w-[300px] blur-[70px]"
        style={{background: `radial-gradient(closest-side, ${TOKEN.teal}, transparent 70%)`, opacity: 0.18}}
      />
      <div className="pw-float h-[190px] w-[150px] opacity-[0.17] sm:h-[270px] sm:w-[210px] lg:h-[350px] lg:w-[275px]">
        <svg viewBox="0 0 220 320" fill="none" className="h-full w-full">
          <defs>
            <filter id="pw-mermaid-glow" x="-70%" y="-40%" width="240%" height="200%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="pw-mermaid-stroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TOKEN.teal} stopOpacity="0.95" />
              <stop offset="65%" stopColor={TOKEN.teal} stopOpacity="0.5" />
              <stop offset="100%" stopColor={TOKEN.teal} stopOpacity="0.08" />
            </linearGradient>
          </defs>

          <g
            filter="url(#pw-mermaid-glow)"
            stroke="url(#pw-mermaid-stroke)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* head + hair */}
            <circle cx="120" cy="46" r="15" />
            <path d="M108 38 C 92 22, 66 34, 62 58 C 58 82, 74 94, 66 116 C 59 136, 42 142, 40 162 C 39 176, 46 186, 56 190" />
            <path d="M132 36 C 148 44, 152 62, 144 78" />
            {/* torso */}
            <path d="M120 61 C 106 70, 100 90, 105 110 C 110 130, 118 144, 116 162" />
            <path d="M134 66 C 146 76, 152 94, 148 112 C 145 126, 136 136, 128 144" />
            {/* arm */}
            <path d="M112 88 C 124 98, 130 114, 126 130" />
            {/* tail */}
            <path d="M116 162 C 112 188, 94 208, 74 224 C 56 238, 46 256, 50 272" />
            <path d="M128 150 C 126 180, 112 204, 92 222 C 74 238, 62 254, 62 268" />
            {/* fluke */}
            <path d="M50 272 C 34 262, 16 266, 6 282 C 22 284, 34 292, 40 304 C 46 290, 54 281, 64 276" />
            <path d="M62 268 C 70 284, 84 294, 100 294 C 90 282, 82 271, 74 264" />
            {/* scale hints */}
            <path d="M112 176 C 116 181, 122 181, 126 176" opacity="0.7" />
            <path d="M102 194 C 106 199, 112 199, 116 194" opacity="0.6" />
            <path d="M88 212 C 92 217, 98 217, 102 212" opacity="0.5" />
            <path d="M72 230 C 76 235, 82 235, 86 230" opacity="0.4" />
          </g>

          <g fill={TOKEN.teal}>
            <circle className="pw-rise" cx="150" cy="120" r="2.6" style={{animationDelay: '0s'}} />
            <circle className="pw-rise" cx="168" cy="160" r="1.8" style={{animationDelay: '3.4s'}} />
            <circle className="pw-rise" cx="140" cy="190" r="3.2" style={{animationDelay: '6.8s'}} />
            <circle className="pw-rise" cx="176" cy="210" r="2.1" style={{animationDelay: '9.1s'}} />
          </g>
        </svg>
      </div>
    </div>
  );
}

function MermaidGlyph({size = 26}: {size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M22 7 C 15 3, 7 8, 8 15 C 9 21, 15 22, 14 28 C 13 33, 8 34, 6 37"
        stroke={TOKEN.teal}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="25" cy="11" r="4" stroke={TOKEN.teal} strokeWidth="1.4" />
      <path
        d="M14 28 C 18 32, 24 33, 30 30 C 26 27, 22 25, 18 25"
        stroke={TOKEN.teal}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ header */

function VaultMark() {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center border border-[#2a2538] bg-[#12101a] transition-colors duration-300 hover:border-[#72b1b1]/60">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z" stroke={TOKEN.teal} strokeWidth="1.2" opacity=".85" />
        <circle cx="12" cy="12" r="3.6" stroke={TOKEN.gold} strokeWidth="1.1" />
        <path d="M12 8.4 V5.6 M12 18.4 V15.6 M15.6 12 H18.4 M5.6 12 H8.4" stroke={TOKEN.rose} strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Header({clock, compact, onToggleCompact, counts, total}: {
  clock: string;
  compact: boolean;
  onToggleCompact: () => void;
  counts: {active: number; experimental: number; retired: number};
  total: number;
}) {
  return (
    <header className="relative z-10 border-b border-[#2a2538]/80">
      <div className="mx-auto w-full max-w-[1440px] px-5 pb-8 pt-6 sm:px-8 lg:px-10">
        {/* utility row */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3">
            <VaultMark />
            <div className="leading-tight">
              <p className="pw-mono text-[10px] uppercase tracking-[0.34em] text-[#a397b8]">Project Worlds</p>
              <p className="pw-display text-[19px] text-[#f0eaff]">Vault Collection</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="pw-mono hidden text-[11px] tracking-[0.14em] text-[#a397b8] sm:inline">
              {clock}
            </span>
            <PressButton
              onPress={onToggleCompact}
              ariaLabel={compact ? 'Switch to comfortable density' : 'Switch to compact density'}
              className="pw-mono border border-[#2a2538] bg-[#12101a] px-3 py-[7px] text-[10px] uppercase tracking-[0.16em] text-[#a397b8] hover:border-[#72b1b1]/50 hover:text-[#f0eaff]"
            >
              {compact ? 'comfort' : 'compact'}
            </PressButton>
            <span className="flex items-center gap-2 border border-[#2a2538] bg-[#12101a] px-3 py-[7px]">
              <StatusDot color={TOKEN.alive} size={7} />
              <span className="pw-mono text-[10px] uppercase tracking-[0.16em] text-[#a397b8]">core online</span>
            </span>
          </div>
        </div>

        {/* greeting */}
        <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="pw-mono text-[11px] uppercase tracking-[0.3em] text-[#72b1b1]/80">
              session · 07:04 · rack temp 21°C
            </p>
            <h1 className="pw-display mt-2 text-[clamp(2.6rem,8vw,4.6rem)] leading-[0.95] text-[#f0eaff]">
              Good morning,
              <span className="relative ml-[0.22em] inline-block">
                Rylee
                <svg
                  viewBox="0 0 260 16"
                  className="absolute -bottom-1 left-0 h-[12px] w-full"
                  fill="none"
                  aria-hidden
                  preserveAspectRatio="none"
                >
                  <path
                    className="pw-draw"
                    d="M2 11 C 46 3, 92 14, 136 6 C 176 0, 218 12, 258 5"
                    stroke={TOKEN.teal}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="mt-5 max-w-[54ch] text-[14px] leading-relaxed text-[#a397b8]">
              The vault holds <span className="text-[#f0eaff]">{total} catalogued tools</span> —{' '}
              {counts.active} active, {counts.experimental} experimental, {counts.retired} retired.
              Everything below is what the rack actually runs on.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-px overflow-hidden border border-[#2a2538] bg-[#2a2538] lg:w-[340px]">
            {[
              {k: 'active', v: counts.active, c: TOKEN.teal},
              {k: 'experimental', v: counts.experimental, c: TOKEN.gold},
              {k: 'retired', v: counts.retired, c: TOKEN.muted},
            ].map((s) => (
              <div key={s.k} className="bg-[#12101a] px-3 py-4 text-center transition-colors duration-300 hover:bg-[#1a1724]">
                <dt className="pw-mono text-[9px] uppercase tracking-[0.16em] text-[#a397b8]">{s.k}</dt>
                <dd className="pw-display mt-1 text-[30px] leading-none" style={{color: s.c}}>
                  {String(s.v).padStart(2, '0')}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ search */

function VaultSearch({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const clearRef = useRef<HTMLButtonElement>(null);
  const fieldProps = {
    'aria-label': 'Filter vault entries',
    placeholder: 'Search tools, categories, tags…',
    value,
    onChange,
  };
  const state = useSearchFieldState(fieldProps);
  const {labelProps, inputProps, clearButtonProps} = useSearchField(fieldProps, state, inputRef);
  const {buttonProps: clearProps} = useButton(clearButtonProps, clearRef);
  const {isFocusVisible} = useFocusRing();

  return (
    <div className="relative">
      <label
        {...labelProps}
        className="pw-mono mb-2 block text-[10px] uppercase tracking-[0.26em] text-[#a397b8]"
      >
        Filter the vault
      </label>

      <div
        className="relative flex items-center border bg-[#12101a] transition-[border-color,box-shadow] duration-300"
        style={{
          borderColor: isFocusVisible ? TOKEN.teal : TOKEN.border,
          boxShadow: isFocusVisible ? `0 0 0 3px ${TOKEN.teal}22, 0 14px 40px -22px ${TOKEN.teal}` : 'none',
        }}
      >
        <span className="pl-4 pr-2 text-[#a397b8]" aria-hidden>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.6 10.6 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>

        <input
          {...inputProps}
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.stopPropagation();
              onChange('');
            }
            inputProps.onKeyDown?.(e);
          }}
          className="pw-mono w-full bg-transparent py-3.5 pr-20 text-[13px] text-[#f0eaff] placeholder:text-[#a397b8]/55 focus:outline-none"
        />

        <div className="absolute right-3 flex items-center gap-2">
          {value ? (
            <button
              {...clearProps}
              ref={clearRef}
              className="pw-mono grid h-6 w-6 place-items-center border border-[#2a2538] text-[11px] text-[#a397b8] transition-colors duration-200 hover:border-[#b57f8b] hover:text-[#b57f8b]"
              aria-label="Clear search"
            >
              ×
            </button>
          ) : (
            <kbd className="pw-mono hidden border border-[#2a2538] px-1.5 py-0.5 text-[10px] text-[#a397b8]/80 sm:block">
              /
            </kbd>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ tabs */

function VaultTab({item, state, count}: {item: any; state: any; count: number}) {
  const ref = useRef<HTMLButtonElement>(null);
  const tabState = useTabState(state, item);
  const meta = TAB_META[item.key as string];
  const {tabProps, isSelected, isPressed} = useTab({key: item.key}, tabState, ref);
  const countRef = useRef<HTMLSpanElement>(null);

  return (
    <button
      {...tabProps}
      ref={ref}
      className={cn(
        'group relative shrink-0 overflow-hidden border px-3.5 py-2.5 text-left transition-all duration-300 ease-out sm:px-4',
        isSelected
          ? 'border-[#72b1b1]/45 bg-[#1a1724] text-[#f0eaff]'
          : 'border-[#2a2538] bg-[#12101a] text-[#a397b8] hover:border-[#2a2538] hover:bg-[#1a1724] hover:text-[#f0eaff]',
        isPressed && 'scale-[.975]',
      )}
    >
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-[2px] origin-left bg-[#72b1b1] transition-transform duration-400 ease-out',
          isSelected ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-[.35]',
        )}
        aria-hidden
      />
      <span className="flex items-baseline gap-2">
        <span className="pw-mono text-[10.5px] uppercase tracking-[0.16em]">{meta?.label ?? item.key}</span>
        <span
          ref={countRef}
          className="pw-mono text-[9.5px] tabular-nums"
          style={{color: isSelected ? TOKEN.teal : `${TOKEN.muted}99`}}
        >
          {count}
        </span>
      </span>
    </button>
  );
}

function VaultTabs({
  activeKey,
  onActiveKeyChange,
  counts,
  children,
}: {
  activeKey: string;
  onActiveKeyChange: (k: string) => void;
  counts: Record<string, number>;
  children: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const listProps = {
    'aria-label': 'Vault categories',
    selectionMode: 'single' as const,
    selectedKey: activeKey,
    onSelectionChange: (k: any) => onActiveKeyChange(String(k)),
    children: TABS.map((t) => <span key={t.key}>{t.label}</span>),
  };

  const tabListState = useTabListState(listProps);
  const {tabListProps} = useTabList(
    {'aria-label': 'Vault categories', selectionMode: 'single'},
    tabListState,
    listRef,
  );
  const {tabPanelProps} = useTabPanel({'aria-label': 'Vault entries'}, tabListState, panelRef);

  const keys = Array.from(tabListState.collection.getKeys()) as string[];

  return (
    <div>
      <div
        ref={listRef}
        {...tabListProps}
        className="pw-scroll flex gap-2 overflow-x-auto pb-2"
        style={{scrollbarWidth: 'thin'}}
      >
        {keys.map((key) => (
          <VaultTab key={key} item={tabListState.collection.getItem(key)} state={tabListState} count={counts[key] ?? 0} />
        ))}
      </div>
      <div ref={panelRef} {...tabPanelProps} className="pt-1">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ card */

function UsageBars({values, color}: {values: number[]; color: string}) {
  return (
    <div className="flex items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="w-[7px] rounded-[1px] transition-[height,opacity] duration-300 ease-out group-hover:opacity-100"
          style={{height: 4 + v * 3.4, background: color, opacity: 0.42 + i * 0.07}}
        />
      ))}
    </div>
  );
}

function VaultCard({
  entry,
  index,
  featured,
  compact,
  pinned,
  onTogglePin,
}: {
  entry: VaultEntry;
  index: number;
  featured: boolean;
  compact: boolean;
  pinned: boolean;
  onTogglePin: (key: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const cat = CATEGORY[entry.category];
  const stat = STATUS[entry.status];

  const {buttonProps, isPressed} = useButton(
    {
      'aria-label': `${entry.name}, ${cat.label}, status ${entry.status}, last used ${entry.lastUsed}. ${
        pinned ? 'Unpin' : 'Pin'
      } to vault index.`,
      'aria-pressed': pinned,
      onPress: () => onTogglePin(entry.key),
    },
    ref as any,
  );

  return (
    <div
      className="pw-card-in h-full"
      style={{animationDelay: `${Math.min(index, 12) * 55}ms`}}
    >
      <article
        {...buttonProps}
        ref={ref as any}
        className={cn(
          'group relative flex h-full cursor-pointer flex-col overflow-hidden border bg-[#12101a] transition-[transform,border-color,box-shadow,background-color] duration-300 ease-out',
          compact ? 'p-4' : 'p-5',
          featured && !compact ? 'sm:p-6' : '',
          pinned
            ? 'border-[#72b1b1]/60 shadow-[0_0_0_1px_rgba(114,177,177,0.18),0_26px_60px_-40px_rgba(114,177,177,0.9)]'
            : 'border-[#2a2538] hover:border-[#72b1b1]/45',
          'hover:-translate-y-[3px] hover:bg-[#1a1724]',
          isPressed && 'translate-y-0 scale-[.988]',
        )}
      >
        {/* sheen sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-[#72b1b1]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:animate-[pwSweep_1.1s_cubic-bezier(.3,.7,.3,1)] group-hover:opacity-100"
        />
        {/* top hairline */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2a2538] to-transparent"
        />
        {/* left accent */}
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[2px] origin-top scale-y-0 transition-transform duration-400 ease-out group-hover:scale-y-100"
          style={{background: `linear-gradient(${cat.color}, transparent)`}}
        />

        {pinned && (
          <span className="pw-mono absolute right-3 top-3 border border-[#72b1b1]/40 bg-[#0a0810] px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.18em] text-[#72b1b1]">
            pinned
          </span>
        )}

        <div className="flex items-start gap-3">
          <span
            className="pw-mono grid h-10 w-10 shrink-0 place-items-center border text-[12px] font-semibold transition-transform duration-400 ease-out group-hover:rotate-[-4deg]"
            style={{borderColor: `${cat.color}44`, color: cat.color, background: `${cat.color}0f`}}
            aria-hidden
          >
            {entry.glyph}
          </span>
          <div className="min-w-0">
            <p className="pw-mono text-[9.5px] uppercase tracking-[0.22em]" style={{color: cat.color}}>
              {cat.label}
            </p>
            <h3 className={cn('pw-display truncate text-[#f0eaff]', featured ? 'text-[26px] leading-[1.1]' : 'text-[22px] leading-tight')}>
              {entry.name}
            </h3>
          </div>
        </div>

        <p className={cn('mt-3.5 text-[13px] leading-[1.65] text-[#a397b8]', featured && 'max-w-[62ch] text-[13.5px]')}>
          {entry.blurb}
        </p>

        {featured && (
          <>
            <p className="mt-2.5 hidden text-[12.5px] leading-[1.7] text-[#a397b8]/80 sm:block">{entry.detail}</p>
            <div className="mt-4 hidden items-end justify-between gap-4 sm:flex">
              <div>
                <p className="pw-mono mb-1.5 text-[9px] uppercase tracking-[0.2em] text-[#a397b8]/70">
                  calls · last 7 days
                </p>
                <UsageBars values={entry.usage} color={cat.color} />
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {entry.tags.map((t) => (
                  <span
                    key={t}
                    className="pw-mono border border-[#2a2538] px-1.5 py-[3px] text-[9.5px] lowercase text-[#a397b8] transition-colors duration-300 group-hover:border-[#2a2538] group-hover:text-[#f0eaff]"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#2a2538] pt-3.5" style={{marginTop: featured ? 18 : 'auto'}}>
          <span className="flex items-center gap-2">
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{background: stat.color}} aria-hidden />
            <span className="pw-mono text-[10px] uppercase tracking-[0.14em]" style={{color: stat.color}}>
              {stat.label}
            </span>
          </span>
          <span className="pw-mono flex items-center gap-2 text-[10px] text-[#a397b8]/85">
            <span className="hidden text-[#a397b8]/40 sm:inline">{entry.version}</span>
            <span aria-hidden className="text-[#a397b8]/30">
              ·
            </span>
            {entry.lastUsed}
          </span>
        </div>

        <span
          className="pw-mono pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.2em] text-[#72b1b1] opacity-0 transition-opacity duration-300 group-hover:opacity-70"
          aria-hidden
        >
          {pinned ? 'press to unpin' : 'press to pin'}
        </span>
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------ empty state */

function EmptyState({query, onClear}: {query: string; onClear: () => void}) {
  return (
    <div className="pw-card-in relative overflow-hidden border border-dashed border-[#2a2538] bg-[#12101a]/70 px-6 py-14 text-center">
      <div
        aria-hidden
        className="absolute inset-x-0 -top-24 mx-auto h-48 w-48 blur-3xl"
        style={{background: `radial-gradient(closest-side, ${TOKEN.teal}, transparent 70%)`, opacity: 0.18}}
      />
      <p className="pw-mono text-[10px] uppercase tracking-[0.3em] text-[#72b1b1]/80">stratum sealed</p>
      <h3 className="pw-display mt-3 text-[30px] leading-tight text-[#f0eaff]">
        Nothing catalogued {query ? `for “${query}”` : 'in this stratum'} yet
      </h3>
      <p className="mx-auto mt-3 max-w-[46ch] text-[13px] leading-relaxed text-[#a397b8]">
        Prometheus and Grafana are queued for intake — they arrive with the next vault pass. Try a
        different category, or clear the filter.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <PressButton
          onPress={onClear}
          className="pw-mono border border-[#72b1b1]/45 bg-[#1a1724] px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#72b1b1] hover:bg-[#72b1b1] hover:text-[#0a0810]"
        >
          clear filters
        </PressButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ sidebar */

function Sidebar({
  counts,
  activeTab,
  onTab,
  pinnedEntries,
  onUnpin,
  total,
}: {
  counts: Record<string, number>;
  activeTab: string;
  onTab: (k: string) => void;
  pinnedEntries: VaultEntry[];
  onUnpin: (k: string) => void;
  total: number;
}) {
  const rows = (Object.keys(CATEGORY) as CategoryKey[]).map((k) => ({
    key: k,
    label: CATEGORY[k].label,
    color: CATEGORY[k].color,
    n: counts[k] ?? 0,
  }));
  const max = Math.max(1, ...rows.map((r) => r.n));

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[292px] lg:self-start">
      <div className="flex flex-col gap-4">
        {/* index */}
        <section className="border border-[#2a2538] bg-[#12101a] p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="pw-mono text-[10px] uppercase tracking-[0.26em] text-[#a397b8]">Vault index</h2>
            <span className="pw-mono text-[10px] text-[#72b1b1]">{total}</span>
          </div>
          <ul className="mt-3 flex flex-col gap-1">
            {rows.map((r) => {
              const isActive = activeTab === r.key;
              return (
                <li key={r.key}>
                  <PressButton
                    onPress={() => onTab(isActive ? 'all' : r.key)}
                    ariaLabel={`Filter by ${r.label}`}
                    className={cn(
                      'group flex w-full items-center gap-3 border px-2.5 py-2 text-left transition-colors duration-250',
                      isActive
                        ? 'border-[#72b1b1]/40 bg-[#1a1724]'
                        : 'border-transparent hover:border-[#2a2538] hover:bg-[#1a1724]',
                    )}
                  >
                    <span className="pw-mono w-[104px] shrink-0 text-[10.5px] uppercase tracking-[0.1em]" style={{color: isActive ? r.color : TOKEN.muted}}>
                      {r.label}
                    </span>
                    <span className="relative h-[3px] flex-1 bg-[#2a2538]">
                      <span
                        className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
                        style={{width: `${(r.n / max) * 100}%`, background: r.color, opacity: isActive ? 1 : 0.65}}
                      />
                    </span>
                    <span className="pw-mono w-4 text-right text-[10px] tabular-nums text-[#f0eaff]/70">{r.n}</span>
                  </PressButton>
                </li>
              );
            })}
          </ul>
        </section>

        {/* pinned */}
        <section className="border border-[#2a2538] bg-[#12101a] p-4">
          <h2 className="pw-mono text-[10px] uppercase tracking-[0.26em] text-[#a397b8]">Working set</h2>
          {pinnedEntries.length === 0 ? (
            <p className="mt-2.5 text-[12px] leading-relaxed text-[#a397b8]/80">
              Press any card to pin it here while you work through the rack.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {pinnedEntries.map((e) => (
                <li key={e.key}>
                  <PressButton
                    onPress={() => onUnpin(e.key)}
                    ariaLabel={`Unpin ${e.name}`}
                    className="flex w-full items-center justify-between gap-2 border border-[#2a2538] bg-[#1a1724] px-2.5 py-1.5 text-left hover:border-[#b57f8b]/50"
                  >
                    <span className="truncate text-[12.5px] text-[#f0eaff]">{e.name}</span>
                    <span className="pw-mono text-[10px] text-[#a397b8]">remove</span>
                  </PressButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ledger */}
        <section className="border border-[#2a2538] bg-[#12101a] p-4">
          <h2 className="pw-mono text-[10px] uppercase tracking-[0.26em] text-[#a397b8]">Night ledger</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {LEDGER.map((l) => (
              <li key={l.t} className="flex items-start gap-3 border-l border-[#2a2538] pl-3 transition-colors duration-300 hover:border-[#72b1b1]">
                <span className="pw-mono w-[38px] shrink-0 text-[10px] tabular-nums text-[#e4c58d]/80">{l.t}</span>
                <span className="pw-mono text-[10.5px] leading-relaxed text-[#a397b8]">{l.text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* companion */}
        <section className="relative flex items-center gap-3 overflow-hidden border border-[#2a2538] bg-[#12101a] p-4">
          <div
            aria-hidden
            className="pw-breathe absolute -right-8 -top-8 h-28 w-28 blur-2xl"
            style={{background: `radial-gradient(closest-side, ${TOKEN.teal}, transparent 70%)`, opacity: 0.35}}
          />
          <MermaidGlyph />
          <div>
            <p className="pw-display text-[17px] leading-tight text-[#f0eaff]">Nerida</p>
            <p className="pw-mono mt-0.5 text-[9.5px] uppercase tracking-[0.16em] text-[#72b1b1]/80">
              vault companion · watching
            </p>
          </div>
        </section>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ root */

export default function ProjectWorldsVaultCollection() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [pinned, setPinned] = useState<string[]>(['proxmox']);
  const [compact, setCompact] = useState(false);
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [now, setNow] = useState<Date>(() => new Date());

  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clock = now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});

  const counts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (e: VaultEntry) =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.blurb.toLowerCase().includes(q) ||
      e.tags.some((t) => t.includes(q)) ||
      CATEGORY[e.category].label.toLowerCase().includes(q) ||
      e.status.includes(q);

    const byCat: Record<string, number> = {all: 0};
    for (const k of Object.keys(CATEGORY)) byCat[k] = 0;
    for (const e of ENTRIES) {
      if (!matches(e)) continue;
      byCat.all += 1;
      byCat[e.category] = (byCat[e.category] ?? 0) + 1;
    }
    return byCat;
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tab = TABS.find((t) => t.key === activeTab);
    const list = ENTRIES.filter((e) => {
      if (tab?.match && e.category !== tab.match) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.blurb.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.tags.some((t) => t.includes(q)) ||
        CATEGORY[e.category].label.toLowerCase().includes(q) ||
        e.status.includes(q)
      );
    });
    return sort === 'name'
      ? [...list].sort((a, b) => a.name.localeCompare(b.name))
      : [...list].sort((a, b) => a.ago - b.ago);
  }, [query, activeTab, sort]);

  const statusCounts = useMemo(
    () => ({
      active: ENTRIES.filter((e) => e.status === 'active').length,
      experimental: ENTRIES.filter((e) => e.status === 'experimental').length,
      retired: ENTRIES.filter((e) => e.status === 'retired').length,
    }),
    [],
  );

  const pinnedEntries = useMemo(
    () => pinned.map((k) => ENTRIES.find((e) => e.key === k)).filter(Boolean) as VaultEntry[],
    [pinned],
  );

  const togglePin = (key: string) =>
    setPinned((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const resetFilters = () => {
    setQuery('');
    setActiveTab('all');
  };

  const gridKey = `${activeTab}|${query.trim().toLowerCase()}|${sort}`;

  return (
    <div className="pw-root relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0810] text-[#f0eaff]">
      <style dangerouslySetInnerHTML={{__html: GLOBAL_CSS}} />
      <AmbientBackdrop />
      <MermaidCompanion />

      <a
        href="#pw-vault"
        className="pw-mono sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus-border-[#72b1b1] focus:bg-[#1a1724] focus:px-3 focus:py-2 focus:text-[11px] focus:uppercase"
      >
        Skip to vault
      </a>

      <Header
        clock={clock}
        compact={compact}
        onToggleCompact={() => setCompact((c) => !c)}
        counts={statusCounts}
        total={ENTRIES.length}
      />

      <main
        id="pw-vault"
        className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-8 px-5 py-8 sm:px-8 lg:flex-row lg:gap-10 lg:px-10"
      >
        <div className="min-w-0 flex-1">
          <VaultSearch value={query} onChange={setQuery} inputRef={inputRef} />

          <div className="mt-6">
            <VaultTabs activeKey={activeTab} onActiveKeyChange={setActiveTab} counts={counts}>
              {/* meta row */}
              <div className="mb-4 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#2a2538] pt-4">
                <p className="pw-mono text-[10px] uppercase tracking-[0.2em] text-[#a397b8]">
                  <span className="text-[#f0eaff]">{String(filtered.length).padStart(2, '0')}</span>
                  <span className="text-[#a397b8]/60"> / {String(ENTRIES.length).padStart(2, '0')} entries</span>
                  {activeTab !== 'all' && (
                    <span className="ml-2 text-[#72b1b1]">· {TAB_META[activeTab]?.label}</span>
                  )}
                  {query && <span className="ml-2 text-[#b57f8b]">· “{query}”</span>}
                </p>
                <PressButton
                  onPress={() => setSort((s) => (s === 'recent' ? 'name' : 'recent'))}
                  className="pw-mono flex items-center gap-2 border border-[#2a2538] bg-[#12101a] px-3 py-1.5 text-[9.5px] uppercase tracking-[0.16em] text-[#a397b8] hover:border-[#e4c58d]/50 hover:text-[#e4c58d]"
                >
                  <span aria-hidden className="text-[#e4c58d]">
                    {sort === 'recent' ? '↓' : 'A'}
                  </span>
                  sort · {sort === 'recent' ? 'recently used' : 'name'}
                </PressButton>
              </div>

              <p className="sr-only" aria-live="polite">
                {filtered.length} vault entries shown.
              </p>

              {filtered.length === 0 ? (
                <EmptyState query={query} onClear={resetFilters} />
              ) : (
                <div
                  key={gridKey}
                  ref={gridRef}
                  className={cn(
                    'grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3',
                    compact ? 'gap-3' : 'gap-4',
                  )}
                >
                  {filtered.map((e, i) => (
                    <div key={e.key} className={cn(i === 0 && !compact && 'sm:col-span-2')}>
                      <VaultCard
                        entry={e}
                        index={i}
                        featured={i === 0 && !compact}
                        compact={compact}
                        pinned={pinned.includes(e.key)}
                        onTogglePin={togglePin}
                      />
                    </div>
                  ))}
                </div>
              )}
            </VaultTabs>
          </div>
        </div>

        <Sidebar
          counts={counts}
          activeTab={activeTab}
          onTab={setActiveTab}
          pinnedEntries={pinnedEntries}
          onUnpin={togglePin}
          total={ENTRIES.length}
        />
      </main>

      <footer className="relative z-10 border-t border-[#2a2538]/80">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-4 px-5 py-6 sm:px-8 lg:px-10">
          <p className="pw-display text-[22px] leading-none text-[#f0eaff]">Rylee</p>
          <span
            className="pw-line h-px min-w-[60px] flex-1"
            style={{background: `linear-gradient(90deg, ${TOKEN.teal}, ${TOKEN.border} 45%, transparent)`}}
            aria-hidden
          />
          <p className="pw-mono text-[9.5px] uppercase tracking-[0.2em] text-[#a397b8]">
            vault.build 2.4.1 · rack 03 · synced {clock}
          </p>
        </div>
      </footer>
    </div>
  );
}