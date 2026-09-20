// ============================================================================
// Project Worlds — Journal Timeline
// ----------------------------------------------------------------------------
// Tailwind (reference only — not executed here):
//   <script src="https://cdn.tailwindcss.com"></script>
//   tailwind.config content glob: ./src/ doublestar  tsx + ts
// Dependencies: react, react-dom, react-aria
// ============================================================================

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useButton } from 'react-aria';

/* ---------------------------------------------------------------- tokens -- */

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
};

type Tone = 'teal' | 'gold' | 'rose' | 'muted';

const TONES: Record<Tone, { fg: string; bg: string; bd: string }> = {
  teal: { fg: T.teal, bg: 'rgba(114,177,177,.10)', bd: 'rgba(114,177,177,.34)' },
  gold: { fg: T.gold, bg: 'rgba(228,197,141,.10)', bd: 'rgba(228,197,141,.32)' },
  rose: { fg: T.rose, bg: 'rgba(181,127,139,.10)', bd: 'rgba(181,127,139,.32)' },
  muted: { fg: T.dim, bg: 'rgba(163,151,184,.07)', bd: 'rgba(163,151,184,.26)' },
};

/* ------------------------------------------------------------------ data -- */

type Metric = { label: string; value: string };

type Milestone = {
  id: string;
  year: string;
  title: string;
  kicker: string;
  summary: string;
  detail: string;
  log: string;
  status: { label: string; tone: Tone };
  tags: string[];
  metrics: Metric[];
  bridge: string;
};

const MILESTONES: Milestone[] = [
  {
    id: 'm-2016',
    year: '2016',
    title: 'First homelab',
    kicker: 'recycled iron',
    summary: 'Built a Proxmox cluster from hardware three office towers threw away.',
    detail:
      'Two dead OptiPlex towers, a secondhand switch with one burnt port, and a UPS bought at a hamfest for the price of lunch. Proxmox VE on top, a bridged VLAN carved out of the household network, and a hall closet that ran forty degrees warmer than the hallway. Nothing about it was elegant. The first time a VM migrated between nodes without dropping a single ping, I understood what I wanted to do with my life.',
    log: 'Entry 001 — first commit to the ops notebook. Ink still wet.',
    status: { label: 'archived', tone: 'rose' },
    tags: ['proxmox', 'debian', 'vlan', 'hall-closet', 'ups'],
    metrics: [
      { label: 'nodes', value: '02' },
      { label: 'uptime', value: '214d' },
      { label: 'draw', value: '180W' },
      { label: 'spent', value: '$62' },
    ],
    bridge: '→ 2019 · The closet got loud. Time to stop doing this by hand.',
  },
  {
    id: 'm-2019',
    year: '2019',
    title: 'Automation era',
    kicker: 'write it down once',
    summary: 'Ansible, Docker, and CI/CD pipelines replaced the twelve commands I kept retyping.',
    detail:
      'Playbooks turned a rebuild into a coffee break. Compose files made dependencies honest instead of folkloric. A self-hosted runner started building, testing, and deploying at 3am without asking anyone permission. Somewhere in that year the cluster stopped being a place I visited on weekends and became a thing that simply ran — and I stopped being its operator and became its author.',
    log: 'Entry 118 — "if it isn\u2019t in git, it doesn\u2019t exist."',
    status: { label: 'superseded', tone: 'muted' },
    tags: ['ansible', 'docker', 'gitlab-ci', 'terraform', 'cron'],
    metrics: [
      { label: 'playbooks', value: '34' },
      { label: 'images', value: '58' },
      { label: 'deploys/day', value: '09' },
      { label: 'manual steps', value: '00' },
    ],
    bridge: '→ 2022 · Everything was automated. Everything was also open.',
  },
  {
    id: 'm-2022',
    year: '2022',
    title: 'Security pivot',
    kicker: 'locks on the locks',
    summary: 'Authelia, Zero Trust, and an OpenBao vault — every service pulled off the public internet.',
    detail:
      'One auth portal in front, WireGuard for the roads, OpenBao holding the secrets that had previously lived in a file called notes.txt. mTLS between services that only ever talked to each other. Zero trust is not paranoia once you have read your own access logs — it is hygiene. The public surface of my infrastructure went from a fistful of ports to a single, polite door.',
    log: 'Entry 204 — deleted the last public-facing nginx config. Felt like closing a window in a storm.',
    status: { label: 'hardened', tone: 'teal' },
    tags: ['authelia', 'wireguard', 'openbao', 'oidc', 'mtls'],
    metrics: [
      { label: 'open ports', value: '00' },
      { label: 'secrets', value: '412' },
      { label: 'policies', value: '26' },
      { label: 'incidents', value: '00' },
    ],
    bridge: '→ 2024 · The network went quiet. The agents did not.',
  },
  {
    id: 'm-2024',
    year: '2024',
    title: 'Agent era',
    kicker: 'the librarian who never sleeps',
    summary: 'AI coding assistants, semantic memory, and multi-model routing by task instead of hype.',
    detail:
      'Local models for anything that leaves the house, hosted models for everything that does not. A semantic memory layer so the assistant remembers why the VLAN is shaped that way and does not suggest unshaping it. Tool-use contracts, evaluation harnesses, and a review gate the agent cannot open by itself. The pair programmer turned out to be the best documentation writer I have ever employed — and the worst driver, so I stopped letting it steer.',
    log: 'Entry 331 — agent opened its own PR. Human merged it. Balance restored.',
    status: { label: 'active', tone: 'teal' },
    tags: ['ollama', 'pgvector', 'mcp', 'embeddings', 'routing'],
    metrics: [
      { label: 'models', value: '06' },
      { label: 'memories', value: '12.4k' },
      { label: 'tokens/day', value: '2.1M' },
      { label: 'lies caught', value: '41' },
    ],
    bridge: '→ 2026 · A decade of infrastructure, finally with a plot.',
  },
  {
    id: 'm-2026',
    year: '2026',
    title: 'Project Worlds',
    kicker: 'story-first',
    summary: 'A portfolio that behaves like a place you can visit, not a page you scroll past.',
    detail:
      'Every artifact gets a room; every room gets a reason to exist. The journal you are reading is the spine, the homelab is the foundation, the agents are the weather. Built on the same stack I have been tuning for ten years — accessibility primitives, an obsession with uptime, and a mermaid who swims the log behind you while you read. Still under construction. That is not a disclaimer, it is the feature.',
    log: 'Entry 402 — still writing. The notebook has outlived every version of me that started it.',
    status: { label: 'current', tone: 'gold' },
    tags: ['react', 'react-aria', 'tailwind', 'webgpu', 'mermaid'],
    metrics: [
      { label: 'entries', value: '402' },
      { label: 'worlds', value: '03' },
      { label: 'uptime', value: '99.98%' },
      { label: 'depth', value: '220m' },
    ],
    bridge: '→ 2028 · Unwritten. That is the entire point.',
  },
];

/* -------------------------------------------------------------- helpers -- */

const prefersReduced = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function frac(seed: number, n: number): number {
  const x = Math.sin((seed + 1) * n) * 10000;
  return x - Math.floor(x);
}

const BUBBLES = Array.from({ length: 24 }, (_, i) => ({
  left: frac(i, 12.9898) * 100,
  size: 2 + frac(i, 78.233) * 7,
  dur: 17 + frac(i, 43.12) * 26,
  delay: -frac(i, 91.7) * 40,
  drift: (frac(i, 31.3) - 0.5) * 90,
}));

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReduced()) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}

function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.65;
      const v = total > 0 ? Math.min(1, Math.max(0, (window.innerHeight * 0.35 - r.top) / total)) : 0;
      setP(v);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return { ref, p };
}

/* ------------------------------------------------------------------ css --- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

.pw-root{font-family:'IBM Plex Sans',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;}
.pw-display{font-family:'Fraunces','Iowan Old Style',Georgia,serif;font-optical-sizing:auto;font-variation-settings:'SOFT' 18,'WONK' 1;}
.pw-mono{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace;}

@keyframes pw-rise{0%{transform:translate3d(0,0,0) scale(.5);opacity:0}12%{opacity:.5}88%{opacity:.10}100%{transform:translate3d(var(--drift,0px),-110vh,0) scale(1);opacity:0}}
@keyframes pw-caustic{0%{transform:translate3d(-3%,0,0) scale(1.06)}50%{transform:translate3d(4%,-3%,0) scale(1.14)}100%{transform:translate3d(-3%,0,0) scale(1.06)}}
@keyframes pw-breathe{0%,100%{opacity:.42;transform:scale(1)}50%{opacity:.85;transform:scale(1.06)}}
@keyframes pw-ping{0%{box-shadow:0 0 0 0 rgba(114,177,177,.55)}70%{box-shadow:0 0 0 9px rgba(114,177,177,0)}100%{box-shadow:0 0 0 0 rgba(114,177,177,0)}}
@keyframes pw-glow{0%,100%{filter:drop-shadow(0 0 5px rgba(114,177,177,.30)) drop-shadow(0 0 18px rgba(114,177,177,.12));opacity:.75}50%{filter:drop-shadow(0 0 14px rgba(114,177,177,.65)) drop-shadow(0 0 42px rgba(114,177,177,.28));opacity:1}}
@keyframes pw-sway{0%,100%{transform:rotate(-2.4deg) translateY(0)}50%{transform:rotate(2.4deg) translateY(-9px)}}
@keyframes pw-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(14px,-20px,0)}}
@keyframes pw-sheen{0%{transform:translateX(-130%) skewX(-14deg)}100%{transform:translateX(260%) skewX(-14deg)}}
@keyframes pw-blink{0%,100%{opacity:1}50%{opacity:.18}}
@keyframes pw-wave{0%,100%{transform:scaleY(.28)}50%{transform:scaleY(1)}}
@keyframes pw-scan{0%{transform:translateY(-110%)}100%{transform:translateY(560%)}}

.pw-bubble{position:absolute;bottom:-60px;border-radius:9999px;background:radial-gradient(circle at 32% 28%,rgba(240,234,255,.55),rgba(114,177,177,.14) 58%,transparent 72%);animation:pw-rise linear infinite;}
.pw-caustics{background:repeating-linear-gradient(114deg,rgba(114,177,177,.17) 0 2px,transparent 2px 27px),repeating-linear-gradient(64deg,rgba(163,151,184,.11) 0 1px,transparent 1px 36px);filter:blur(7px);animation:pw-caustic 30s ease-in-out infinite;}
.pw-ping{animation:pwinf .9s ease-out infinite;}
.pw-ping{animation:pwinf 2.6s ease-out infinite;}
.pw-blink{animation:pw-blink 1.6s steps(1,end) infinite;}
.pw-mermaid{animation:pw-glow 6.5s ease-in-out infinite;}
.pw-sway{animation:pw-sway 9s ease-in-out infinite;transform-origin:52% 12%;}
.pw-drifty{animation:pw-drift 16s ease-in-out infinite;}
.pw-wave span{display:block;width:2px;background:${T.teal};transform-origin:bottom;animation:pw-wave 1.1s ease-in-out infinite;}
.pw-scan{animation:pw-scan 7s linear infinite;}

.pw-reveal{opacity:0;transform:translateY(28px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1);}
.pw-reveal[data-shown="true"]{opacity:1;transform:none;}

.pw-collapse{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .55s cubic-bezier(.22,1,.36,1),opacity .4s ease;}
.pw-collapse[data-open="true"]{grid-template-rows:1fr;opacity:1;}
.pw-collapse>.pw-collapse-in{overflow:hidden;min-height:0;visibility:hidden;transition:visibility 0s linear .55s;}
.pw-collapse[data-open="true"]>.pw-collapse-in{visibility:visible;transition-delay:0s;}

.pw-card{transition:transform .4s cubic-bezier(.22,1,.36,1),background-color .4s ease,border-color .4s ease,box-shadow .4s ease;}
.pw-card:hover{transform:translateY(-3px);box-shadow:0 22px 46px -28px rgba(114,177,177,.6);}
.pw-card:focus-visible{outline:1px solid ${T.teal};outline-offset:3px;box-shadow:0 0 0 4px rgba(114,177,177,.14);}
.pw-card::before,.pw-card::after{content:'';position:absolute;width:9px;height:9px;pointer-events:none;transition:width .35s ease,height .35s ease,border-color .35s ease;}
.pw-card::before{top:-1px;left:-1px;border-top:1px solid rgba(114,177,177,.35);border-left:1px solid rgba(114,177,177,.35);}
.pw-card::after{bottom:-1px;right:-1px;border-bottom:1px solid rgba(114,177,177,.35);border-right:1px solid rgba(114,177,177,.35);}
.pw-card:hover::before,.pw-card:hover::after,.pw-card[data-open="true"]::before,.pw-card[data-open="true"]::after{width:18px;height:18px;border-color:${T.teal};}

.pw-year{position:relative;overflow:hidden;}
.pw-year::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 32%,rgba(228,197,141,.42) 50%,transparent 68%);transform:translateX(-130%);}
.pw-card:hover .pw-year::after,.pw-tick:hover .pw-year::after{animation:pw-sheen .95s ease;}

.pw-numeral{transition:color .5s ease,transform .6s cubic-bezier(.22,1,.36,1);}
.pw-card:hover .pw-numeral{transform:translateY(-4px);}

.pw-tick{transition:color .3s ease,background-color .3s ease;}
.pw-tick:focus-visible{outline:1px solid ${T.teal};outline-offset:2px;}
.pw-tick:hover .pw-tick-dot{transform:scale(1.7);}
.pw-tick-dot{transition:transform .3s cubic-bezier(.22,1,.36,1),background-color .3s ease,box-shadow .3s ease;}

.pw-btn:focus-visible{outline:1px solid ${T.teal};outline-offset:3px;}
.pw-chev{transition:transform .45s cubic-bezier(.22,1,.36,1);}
.pw-chev[data-open="true"]{transform:rotate(135deg);}
.pw-dot-core{transition:transform .4s cubic-bezier(.22,1,.36,1),background-color .4s ease,box-shadow .4s ease;}
.pw-card:hover ~ .pw-rail .pw-dot-core,.pw-dot-live .pw-dot-core{transform:scale(1.35);}
.pw-rule{transition:width .6s cubic-bezier(.22,1,.36,1);}

@media (prefers-reduced-motion: reduce){
  .pw-root *,.pw-root *::before,.pw-root *::after{
    animation-duration:.001ms !important;animation-iteration-count:1 !important;
    transition-duration:.001ms !important;scroll-behavior:auto !important;
  }
  .pw-bubble,.pw-scan{display:none !important;}
  .pw-reveal{opacity:1 !important;transform:none !important;}
}
`;

/* ------------------------------------------------------- ambient layers --- */

function Abyss(): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReduced()) return;
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const move = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth - 0.5) * 26;
      y = (e.clientY / window.innerHeight - 0.5) * 26;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          const el = rootRef.current;
          if (el) el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
        });
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 70% at 50% -12%, rgba(114,177,177,.13), transparent 58%),' +
            'radial-gradient(95% 60% at 88% 108%, rgba(181,127,139,.13), transparent 62%),' +
            'radial-gradient(60% 45% at 6% 42%, rgba(228,197,141,.055), transparent 66%)',
        }}
      />
      <div ref={rootRef} className="absolute inset-[-4%] will-change-transform">
        <div className="pw-caustics absolute inset-[-15%] opacity-[.13]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(42,37,56,.6) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(42,37,56,.6) 1px, transparent 1px)',
            backgroundSize: '76px 76px',
            maskImage: 'radial-gradient(120% 78% at 50% 0%, #000 18%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(120% 78% at 50% 0%, #000 18%, transparent 72%)',
          }}
        />
        <div
          className="absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(114,177,177,.11), transparent 68%)',
            animation: 'pw-breathe 14s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -right-32 bottom-24 h-[360px] w-[360px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(181,127,139,.10), transparent 68%)',
            animation: 'pw-breathe 19s ease-in-out 3s infinite',
          }}
        />
        <MermaidFigure
          className="pw-drifty absolute -bottom-24 left-[2%] h-[520px] w-[336px] opacity-[.055]"
          variant="ambient"
        />
      </div>
      <div className="absolute inset-0">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="pw-bubble"
            style={
              {
                left: `${b.left}%`,
                width: `${b.size}px`,
                height: `${b.size}px`,
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
                '--drift': `${b.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${T.teal}55, ${T.gold}44, transparent)` }}
      />
    </div>
  );
}

/* ---------------------------------------------------------- mermaid svg --- */

function MermaidFigure({
  className = '',
  variant = 'companion',
  style,
}: {
  className?: string;
  variant?: 'companion' | 'ambient' | 'corner';
  style?: React.CSSProperties;
}): JSX.Element {
  const uid = useId().replace(/:/g, '');
  const g = `pw-mer-${uid}`;
  const isAmbient = variant === 'ambient';

  return (
    <svg
      viewBox="0 0 220 340"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id={g} x1="110" y1="24" x2="118" y2="316" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={T.gold} stopOpacity="0.85" />
          <stop offset="0.28" stopColor={T.teal} stopOpacity="0.95" />
          <stop offset="1" stopColor={T.teal} stopOpacity="0.42" />
        </linearGradient>
      </defs>

      {/* ripple halo */}
      <g stroke={T.teal} strokeOpacity="0.16" strokeWidth="1">
        <path d="M64 34 C 96 8, 150 8, 178 36" />
        <path d="M48 52 C 90 16, 158 16, 196 54" strokeOpacity="0.09" />
      </g>

      <g className={isAmbient ? undefined : 'pw-sway'}>
        <g stroke={`url(#${g})`} strokeLinecap="round" strokeLinejoin="round">
          {/* head */}
          <circle cx="118" cy="56" r="15" strokeWidth="1.6" />
          {/* hair */}
          <path d="M104 46 C 84 38, 62 50, 52 72 C 44 90, 32 102, 16 108" strokeWidth="1.5" strokeOpacity="0.8" />
          <path d="M106 58 C 88 62, 76 78, 72 98 C 69 114, 58 126, 44 134" strokeWidth="1.3" strokeOpacity="0.6" />
          <path d="M110 38 C 96 24, 74 26, 60 42" strokeWidth="1.2" strokeOpacity="0.5" />
          {/* torso */}
          <path d="M118 71 C 131 92, 129 114, 119 131" strokeWidth="1.7" />
          <path d="M118 71 C 106 92, 108 114, 118 131" strokeWidth="1.7" strokeOpacity="0.75" />
          {/* arm */}
          <path d="M127 96 C 144 92, 157 100, 163 114" strokeWidth="1.4" strokeOpacity="0.7" />
          <path d="M110 98 C 96 104, 89 116, 91 128" strokeWidth="1.3" strokeOpacity="0.5" />
          {/* tail spine */}
          <path d="M118 131 C 105 158, 124 186, 113 214 C 106 232, 112 250, 126 264" strokeWidth="2" />
          <path d="M122 136 C 134 160, 118 186, 127 210" strokeWidth="1.1" strokeOpacity="0.45" />
          {/* fluke */}
          <path d="M126 264 C 108 270, 88 288, 79 310 C 96 300, 115 286, 124 270" strokeWidth="1.5" strokeOpacity="0.85" />
          <path d="M126 264 C 144 270, 164 288, 173 310 C 156 300, 137 286, 128 270" strokeWidth="1.5" strokeOpacity="0.85" />
        </g>

        {/* bioluminescent nodes */}
        <g fill={T.teal}>
          {[
            [118, 140, 2.2, 0.9],
            [116, 160, 1.7, 0.62],
            [121, 180, 2, 0.8],
            [114, 200, 1.6, 0.55],
            [119, 222, 1.9, 0.7],
            [125, 244, 1.5, 0.5],
          ].map(([cx, cy, r, o], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fillOpacity={o}
              style={
                isAmbient
                  ? undefined
                  : { animation: `pw-blink ${2.4 + i * 0.45}s ease-in-out ${i * 0.3}s infinite` }
              }
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------ primitives -- */

function StatusPill({ label, tone }: { label: string; tone: Tone }): JSX.Element {
  const c = TONES[tone];
  return (
    <span
      className="pw-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[9.5px] uppercase tracking-[.2em]"
      style={{ color: c.fg, background: c.bg, borderColor: c.bd }}
    >
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: c.fg, boxShadow: `0 0 8px ${c.fg}` }} />
      {label}
    </span>
  );
}

function Clock(): JSX.Element {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const parts = now.toLocaleTimeString('en-GB', { hour12: false }).split(':');
  return (
    <span className="pw-mono text-[11px] tracking-[.22em] text-[#a397b8] tabular-nums">
      {parts[0]}
      <span className="pw-blink">:</span>
      {parts[1]}
      <span className="pw-blink">:</span>
      {parts[2]}
    </span>
  );
}

function SectionLabel({ children, tone = T.dim }: { children: React.ReactNode; tone?: string }): JSX.Element {
  return (
    <p className="pw-mono text-[10px] uppercase tracking-[.34em]" style={{ color: tone }}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------ era strip --- */

function EraTick({
  m,
  index,
  active,
  passed,
  onJump,
}: {
  m: Milestone;
  index: number;
  active: boolean;
  passed: boolean;
  onJump: (i: number) => void;
}): JSX.Element {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const { buttonProps } = useButton(
    {
      elementType: 'div',
      'aria-label': `Jump to ${m.year} — ${m.title}`,
      'aria-current': active ? 'true' : undefined,
      onPress: () => onJump(index),
    },
    ref,
  );
  const accent = active ? T.gold : passed ? T.teal : T.border;

  return (
    <div
      {...buttonProps}
      ref={ref}
      className="pw-tick group relative flex min-w-[78px] flex-1 cursor-pointer select-none flex-col items-start gap-2 pt-3 focus-visible:outline-none sm:min-w-0"
    >
      <span className="absolute left-0 right-0 top-[3px] h-px" style={{ background: passed || active ? `${T.teal}66` : T.border }} />
      <span
        className="pw-tick-dot absolute left-0 top-0 h-[7px] w-[7px] rounded-full"
        style={{ background: accent, boxShadow: active ? `0 0 12px ${T.gold}` : 'none' }}
      />
      <span
        className="pw-mono pl-0 text-[11px] tracking-[.2em] transition-colors duration-300"
        style={{ color: active ? T.gold : passed ? T.teal : T.dim }}
      >
        {m.year}
      </span>
      <span
        className="hidden truncate pr-3 text-[11px] transition-colors duration-300 sm:block"
        style={{ color: active ? T.text : 'rgba(163,151,184,.65)' }}
      >
        {m.title}
      </span>
    </div>
  );
}

/* --------------------------------------------------------- timeline node -- */

function TimelineStop({
  m,
  index,
  open,
  passed,
  onToggle,
  registerRef,
}: {
  m: Milestone;
  index: number;
  open: boolean;
  passed: boolean;
  onToggle: (i: number) => void;
  registerRef: (i: number, el: HTMLElement | null) => void;
}): JSX.Element {
  const { ref: revealRef, shown } = useReveal<HTMLLIElement>();
  const btnRef = useRef<HTMLDivElement | null>(null);
  const headId = `${m.id}-head`;
  const regionId = `${m.id}-region`;

  const { buttonProps } = useButton(
    {
      elementType: 'div',
      id: headId,
      'aria-expanded': open,
      'aria-controls': regionId,
      'aria-label': `${m.year}. ${m.title}. ${open ? 'Collapse' : 'Expand'} journal entry.`,
      onPress: () => onToggle(index),
    },
    btnRef,
  );

  const num = String(index + 1).padStart(2, '0');

  return (
    <li
      ref={(el) => {
        (revealRef as React.MutableRefObject<HTMLLIElement | null>).current = el;
        registerRef(index, btnRef.current);
      }}
      className="pw-reveal relative pl-[30px] pb-7 sm:pl-[56px]"
      data-shown={shown}
    >
      {/* rail */}
      <span aria-hidden className={`pw-rail absolute left-0 top-0 bottom-0 w-[22px] sm:w-[38px] ${open ? 'pw-dot-live' : ''}`}>
        <span
          className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
          style={{
            background: passed || open
              ? 'linear-gradient(180deg, rgba(114,177,177,.75), rgba(114,177,177,.18))'
              : 'linear-gradient(180deg, rgba(42,37,56,1), rgba(42,37,56,.4))',
          }}
        />
        <span
          className="absolute left-1/2 top-[38px] h-[13px] w-[13px] -translate-x-1/2 rounded-full border transition-all duration-500"
          style={{
            borderColor: open ? T.gold : 'rgba(114,177,177,.7)',
            background: T.canvas,
            boxShadow: open ? `0 0 0 4px rgba(228,197,141,.10), 0 0 22px rgba(228,197,141,.45)` : 'none',
          }}
        >
          <span
            className="pw-dot-core absolute inset-[3px] rounded-full"
            style={{
              background: open ? T.gold : T.teal,
              boxShadow: open ? 'none' : `0 0 10px ${T.teal}`,
            }}
          />
        </span>
      </span>

      <div className="relative">
        {/* node / card head */}
        <div
          {...buttonProps}
          ref={btnRef}
          className="pw-card relative block cursor-pointer overflow-hidden border bg-[#12101a] px-4 py-4 focus-visible:outline-none sm:px-6 sm:py-5"
          data-open={open}
          style={{
            borderColor: open ? 'rgba(114,177,177,.45)' : T.border,
            background: open
              ? 'linear-gradient(180deg, rgba(26,23,36,.92), rgba(18,16,26,.92))'
              : T.panel,
          }}
        >
          <span
            aria-hidden
            className="pw-numeral pw-display pointer-events-none absolute -bottom-8 right-1 select-none text-[86px] leading-none sm:text-[104px]"
            style={{ color: open ? 'rgba(240,234,255,.075)' : 'rgba(240,234,255,.035)' }}
          >
            {num}
          </span>

          <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              className="pw-year inline-block border px-2 py-[3px] text-[12px] font-medium tracking-[.2em]"
              style={{ color: T.gold, borderColor: 'rgba(228,197,141,.28)', background: 'rgba(228,197,141,.07)' }}
            >
              <span className="pw-mono">{m.year}</span>
            </span>
            <span className="pw-mono text-[10px] uppercase tracking-[.24em] text-[#a397b8]">{m.kicker}</span>
            <span
              className="pw-chev ml-auto flex h-6 w-6 shrink-0 items-center justify-center border text-[13px] leading-none"
              data-open={open}
              style={{ borderColor: open ? 'rgba(114,177,177,.5)' : T.border, color: open ? T.teal : T.dim }}
              aria-hidden
            >
              +
            </span>
          </div>

          <h3
            className="pw-display relative mt-3 text-[26px] font-semibold leading-[1.05] tracking-[-.01em] transition-colors duration-300 sm:text-[32px]"
            style={{ color: open ? T.text : 'rgba(240,234,255,.9)' }}
          >
            {m.title}
          </h3>

          <span
            aria-hidden
            className="pw-rule mt-3 block h-px"
            style={{ width: open ? '72px' : '28px', background: open ? T.gold : 'rgba(114,177,177,.55)' }}
          />

          <p className="pw-body relative mt-3 max-w-[54ch] text-[14.5px] leading-relaxed text-[#a397b8] sm:text-[15.5px]">
            {m.summary}
          </p>

          <div className="relative mt-4 flex items-center justify-between gap-3">
            <StatusPill label={m.status.label} tone={m.status.tone} />
            <span className="pw-mono text-[10px] uppercase tracking-[.22em]" style={{ color: open ? T.teal : 'rgba(163,151,184,.7)' }}>
              {open ? 'log open' : 'open log'}
            </span>
          </div>
        </div>

        {/* expandable detail */}
        <div className="pw-collapse mt-px" data-open={open} id={regionId} role="region" aria-labelledby={headId}>
          <div className="pw-collapse-in">
            <div
              className="border bg-[#0a0810]/70 px-4 py-5 sm:px-6 sm:py-6"
              style={{ borderColor: 'rgba(42,37,56,.85)' }}
            >
              <p
                className="pw-display border-l-2 pl-4 text-[15px] italic leading-relaxed sm:text-[16.5px]"
                style={{ borderColor: T.rose, color: 'rgba(240,234,255,.86)' }}
              >
                {m.log}
              </p>

              <p className="mt-5 max-w-[62ch] text-[14.5px] leading-[1.75] text-[#a397b8] sm:text-[15.5px]">{m.detail}</p>

              <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Technologies">
                {m.tags.map((t) => (
                  <li
                    key={t}
                    className="pw-mono rounded-[2px] border bg-[#12101a] px-2 py-[3px] text-[11px] text-[#a397b8] transition-colors duration-300 hover:border-[rgba(114,177,177,.45)] hover:text-[#72b1b1]"
                    style={{ borderColor: T.border }}
                  >
                    <span style={{ color: T.teal }}>#</span>
                    {t}
                  </li>
                ))}
              </ul>

              <dl className="mt-5 grid grid-cols-2 gap-px border sm:grid-cols-4" style={{ borderColor: T.border, background: T.border }}>
                {m.metrics.map((x) => (
                  <div key={x.label} className="bg-[#1a1724] px-3 py-2.5">
                    <dt className="pw-mono text-[9px] uppercase tracking-[.2em] text-[#a397b8]">{x.label}</dt>
                    <dd className="pw-mono mt-1 text-[15px] tabular-nums" style={{ color: T.teal }}>
                      {x.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p
                className="pw-mono mt-5 border-t pt-4 text-[11.5px] tracking-[.06em]"
                style={{ borderColor: 'rgba(42,37,56,.9)', color: 'rgba(228,197,141,.85)' }}
              >
                {m.bridge}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/* --------------------------------------------------------- dive gauge ----- */

const ZONES = [
  { at: 0.0, name: 'Sunlight', note: 'surface · light everywhere' },
  { at: 0.22, name: 'Twilight', note: 'the last of the surface noise' },
  { at: 0.45, name: 'Midnight', note: 'no sun, only instrument light' },
  { at: 0.68, name: 'Abyssal', note: 'pressure becomes the default' },
  { at: 0.88, name: 'Hadal', note: 'the log keeps going anyway' },
];

function DiveGauge({ p, openIndex }: { p: number; openIndex: number }): JSX.Element {
  const depth = Math.round(p * 1180);
  const zone = [...ZONES].reverse().find((z) => p >= z.at) ?? ZONES[0];

  return (
    <div className="border bg-[#12101a] p-4" style={{ borderColor: T.border }}>
      <div className="flex items-baseline justify-between">
        <SectionLabel>Dive gauge</SectionLabel>
        <span className="pw-mono text-[10px] tracking-[.18em]" style={{ color: T.teal }}>
          {String(Math.round(p * 100)).padStart(3, '0')}%
        </span>
      </div>

      <p className="pw-display mt-3 text-[34px] font-semibold leading-none tabular-nums" style={{ color: T.text }}>
        −{depth}
        <span className="pw-mono ml-1 text-[13px] font-normal tracking-[.12em]" style={{ color: T.dim }}>
          m
        </span>
      </p>
      <p className="pw-mono mt-1 text-[10.5px] uppercase tracking-[.24em]" style={{ color: T.gold }}>
        {zone.name}
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-[#a397b8]">{zone.note}</p>

      <div className="relative mt-5 h-[190px] w-full">
        <div className="absolute left-[7px] top-0 h-full w-px" style={{ background: T.border }} />
        <div
          className="absolute left-[7px] top-0 w-px transition-[height] duration-500 ease-out"
          style={{ height: `${p * 100}%`, background: `linear-gradient(180deg, ${T.teal}, ${T.gold})`, boxShadow: `0 0 12px rgba(114,177,177,.55)` }}
        />
        <div
          className="absolute left-[7px] h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[top] duration-500 ease-out"
          style={{ top: `${p * 100}%`, background: T.gold, boxShadow: `0 0 14px ${T.gold}` }}
        />
        {MILESTONES.map((m, i) => {
          const y = (i / (MILESTONES.length - 1)) * 100;
          const reached = p * 100 >= y - 2;
          return (
            <div key={m.id} className="absolute left-0 flex w-full items-center gap-3" style={{ top: `${y}%` }}>
              <span className="h-px w-[15px]" style={{ background: reached ? T.teal : T.border }} />
              <span
                className="pw-mono text-[10px] tracking-[.16em] transition-colors duration-300"
                style={{ color: i === openIndex ? T.gold : reached ? T.teal : 'rgba(163,151,184,.55)' }}
              >
                {m.year}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sidebar --- */

function Sidebar({
  p,
  openIndex,
  onJump,
}: {
  p: number;
  openIndex: number;
  onJump: (i: number) => void;
}): JSX.Element {
  const legend: Array<{ tone: Tone; label: string; note: string }> = [
    { tone: 'rose', label: 'archived', note: 'hardware retired, lessons kept' },
    { tone: 'muted', label: 'superseded', note: 'replaced by a better habit' },
    { tone: 'teal', label: 'hardened / active', note: 'still running tonight' },
    { tone: 'gold', label: 'current', note: 'the entry you are reading' },
  ];

  return (
    <aside className="lg:sticky lg:top-[152px] lg:self-start" aria-label="Timeline instrumentation">
      <DiveGauge p={p} openIndex={openIndex} />

      {/* companion corner */}
      <div
        className="relative mt-4 overflow-hidden border bg-[#12101a]"
        style={{ borderColor: T.border }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(70% 60% at 22% 78%, rgba(114,177,177,.16), transparent 70%)',
            opacity: 0.55 + p * 0.45,
            transition: 'opacity .8s ease',
          }}
        />
        <MermaidFigure
          variant="corner"
          className="pw-mermaid pw-drifty pointer-events-none absolute -bottom-6 -left-3 h-[168px] w-[110px] opacity-[.22]"
        />
        <div className="relative p-4 pl-[86px]">
          <SectionLabel tone={T.teal}>Companion</SectionLabel>
          <p className="pw-display mt-2 text-[19px] font-semibold leading-tight" style={{ color: T.text }}>
            Nerida
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[#a397b8]">
            Ambient process. Reads the log behind you, says nothing, glows a little.
          </p>
          <div className="pw-wave mt-3 flex h-5 items-end gap-[3px]" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <span key={i} style={{ height: '100%', animationDelay: `${i * 0.13}s`, opacity: 0.7 }} />
            ))}
          </div>
          <p className="pw-mono mt-2 text-[9.5px] uppercase tracking-[.22em] text-[#a397b8]">
            signal · {p > 0.75 ? 'deep' : p > 0.4 ? 'steady' : 'surface'}
          </p>
        </div>
      </div>

      {/* legend */}
      <div className="mt-4 border bg-[#12101a] p-4" style={{ borderColor: T.border }}>
        <SectionLabel>Status key</SectionLabel>
        <ul className="mt-3 space-y-2.5">
          {legend.map((l) => (
            <li key={l.label} className="flex flex-col gap-1">
              <StatusPill label={l.label} tone={l.tone} />
              <span className="text-[11.5px] leading-snug text-[#a397b8]">{l.note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* quick jump */}
      <div className="mt-4 border bg-[#12101a] p-4" style={{ borderColor: T.border }}>
        <SectionLabel>Jump to era</SectionLabel>
        <ul className="mt-3 space-y-1">
          {MILESTONES.map((m, i) => (
            <li key={m.id}>
              <QuickJump m={m} active={i === openIndex} onPress={() => onJump(i)} />
            </li>
          ))}
        </ul>
        <p className="pw-mono mt-4 border-t pt-3 text-[10px] leading-relaxed tracking-[.12em] text-[#a397b8]" style={{ borderColor: T.border }}>
          ↑ ↓ move · enter opens · home / end jumps
        </p>
      </div>
    </aside>
  );
}

function QuickJump({ m, active, onPress }: { m: Milestone; active: boolean; onPress: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const { buttonProps } = useButton({ elementType: 'div', onPress, 'aria-label': `Open ${m.year} — ${m.title}` }, ref);
  return (
    <div
      {...buttonProps}
      ref={ref}
      className="pw-tick flex cursor-pointer items-center gap-3 border-l-2 px-3 py-1.5 transition-colors duration-300 hover:bg-[#1a1724] focus-visible:outline-none"
      style={{
        borderLeftColor: active ? T.gold : T.border,
        background: active ? 'rgba(228,197,141,.06)' : 'transparent',
      }}
    >
      <span className="pw-mono text-[11px] tracking-[.16em]" style={{ color: active ? T.gold : T.dim }}>
        {m.year}
      </span>
      <span className="truncate text-[12.5px]" style={{ color: active ? T.text : 'rgba(163,151,184,.9)' }}>
        {m.title}
      </span>
    </div>
  );
}

/* --------------------------------------------------- companion end panel -- */

function CompanionPanel(): JSX.Element {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      data-shown={shown}
      className="pw-reveal relative mt-8 overflow-hidden border bg-[#12101a]"
      style={{ borderColor: 'rgba(114,177,177,.28)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 120% at 12% 50%, rgba(114,177,177,.17), transparent 62%),' +
            'radial-gradient(40% 90% at 90% 100%, rgba(181,127,139,.12), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pw-scan pointer-events-none absolute inset-x-0 top-0 h-24 opacity-40"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(114,177,177,.16), transparent)' }}
      />

      <div className="relative flex flex-col items-start gap-6 p-5 sm:flex-row sm:items-center sm:p-8">
        <MermaidFigure variant="companion" className="pw-mermaid h-[210px] w-[140px] shrink-0 sm:h-[250px] sm:w-[165px]" />
        <div className="min-w-0">
          <SectionLabel tone={T.teal}>Companion · end of timeline</SectionLabel>
          <h3 className="pw-display mt-3 text-[30px] font-semibold leading-[1.05] sm:text-[38px]" style={{ color: T.text }}>
            She reads the log too.
          </h3>
          <p className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-[#a397b8] sm:text-[15.5px]">
            Every entry below the waterline has a witness. The timeline ends here; the notebook does not — the next
            page is empty and the tide is on your side.
          </p>
          <div className="pw-mono mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10.5px] uppercase tracking-[.2em]">
            <span style={{ color: T.teal }}>
              mermaid.status <span className="ml-1 inline-block h-[6px] w-[6px] rounded-full align-middle" style={{ background: T.teal, boxShadow: `0 0 10px ${T.teal}` }} />
            </span>
            <span style={{ color: T.gold }}>entries 402</span>
            <span style={{ color: T.rose }}>last dive 2026</span>
            <span className="text-[#a397b8]">next · unwritten</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ app --- */

export default function JournalTimeline(): JSX.Element {
  const [openIndex, setOpenIndex] = useState<number>(0);
  const nodeRefs = useRef<Array<HTMLElement | null>>([]);
  const listRef = useRef<HTMLOListElement | null>(null);
  const { ref: trackRef, p } = useScrollProgress<HTMLDivElement>();

  const registerRef = useCallback((i: number, el: HTMLElement | null) => {
    nodeRefs.current[i] = el;
  }, []);

  const focusStop = useCallback((i: number, scroll: boolean) => {
    const el = nodeRefs.current[i];
    if (!el) return;
    if (scroll) {
      el.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center' });
    }
    el.focus({ preventScroll: true });
  }, []);

  const onToggle = useCallback(
    (i: number) => {
      setOpenIndex((cur) => (cur === i ? -1 : i));
    },
    [],
  );

  const onJump = useCallback(
    (i: number) => {
      setOpenIndex(i);
      window.setTimeout(() => focusStop(i, true), 40);
    },
    [focusStop],
  );

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const idx = nodeRefs.current.findIndex((el) => el && el === document.activeElement);
    if (idx === -1) return;
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = Math.min(idx + 1, MILESTONES.length - 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = Math.max(idx - 1, 0);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = MILESTONES.length - 1;
    if (next >= 0) {
      e.preventDefault();
      focusStop(next, true);
    }
  };

  const current = openIndex >= 0 ? MILESTONES[openIndex] : null;

  return (
    <div className="pw-root relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0810] text-[#f0eaff]">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Abyss />

      {/* ---------------------------------------------------------- header */}
      <header className="sticky top-0 z-30 border-b bg-[#0a0810]/85 backdrop-blur-sm" style={{ borderColor: T.border }}>
        <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between py-2.5">
            <p className="pw-mono flex items-center gap-2 text-[10px] uppercase tracking-[.32em] text-[#a397b8]">
              <span style={{ color: T.teal }}>◆</span>
              Project Worlds
              <span className="hidden sm:inline" style={{ color: 'rgba(163,151,184,.45)' }}>
                / journal timeline
              </span>
            </p>
            <div className="flex items-center gap-4">
              <span className="pw-mono hidden text-[10px] uppercase tracking-[.24em] text-[#a397b8] md:inline">
                node · rylee-lan-01
              </span>
              <Clock />
            </div>
          </div>

          <div className="flex flex-col gap-6 pb-5 pt-1 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative min-w-0">
              <span aria-hidden className="absolute -left-4 top-2 hidden h-[72%] w-px sm:block" style={{ background: `linear-gradient(180deg, ${T.teal}, transparent)` }} />
              <h1 className="pw-display text-[clamp(2.4rem,8.5vw,4.4rem)] font-light leading-[.95] tracking-[-.025em]" style={{ color: T.text }}>
                Good morning,
                <br />
                <span className="font-semibold italic" style={{ color: T.gold }}>
                  Rylee
                </span>
                <span className="font-light" style={{ color: T.teal }}>
                  .
                </span>
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="pw-ping h-[8px] w-[8px] rounded-full"
                    style={{ background: '#6ee7a8', boxShadow: '0 0 10px rgba(110,231,168,.8)' }}
                  />
                  <span className="pw-mono text-[10.5px] uppercase tracking-[.2em]" style={{ color: '#6ee7a8' }}>
                    workstation online
                  </span>
                </span>
                <span className="pw-mono text-[10.5px] uppercase tracking-[.18em] text-[#a397b8]">
                  log synced 4m ago · 5 entries · 10 years
                </span>
              </div>
            </div>

            <div className="shrink-0 lg:pb-2 lg:text-right">
              <p className="pw-mono text-[10px] uppercase tracking-[.28em] text-[#a397b8]">Ten years, one waterline</p>
              <p className="pw-display mt-1 text-[19px] font-medium" style={{ color: T.text }}>
                2016 <span style={{ color: T.teal }}>→</span> 2026
              </p>
            </div>
          </div>

          <nav aria-label="Era quick jump" className="-mx-1 overflow-x-auto pb-4">
            <div className="flex min-w-[560px] gap-1 sm:min-w-0">
              {MILESTONES.map((m, i) => (
                <EraTick key={m.id} m={m} index={i} active={openIndex === i} passed={openIndex > i} onJump={onJump} />
              ))}
            </div>
          </nav>
        </div>
        <div aria-hidden className="h-px w-full" style={{ background: `linear-gradient(90deg, ${T.teal}55, ${T.border} 40%, transparent)` }} />
      </header>

      {/* ------------------------------------------------------------ main */}
      <main className="relative z-10 flex-1">
        <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-9 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-12 lg:px-10 lg:py-14">
          <div ref={trackRef} className="min-w-0">
            <div className="flex items-end justify-between gap-4 border-b pb-4" style={{ borderColor: T.border }}>
              <div>
                <SectionLabel tone={T.teal}>Journal · career waterline</SectionLabel>
                <h2 className="pw-display mt-2 text-[26px] font-semibold leading-tight sm:text-[32px]">
                  The timeline, <span className="italic" style={{ color: T.teal }}>logged</span>
                </h2>
              </div>
              <p className="pw-mono hidden shrink-0 text-right text-[10px] uppercase leading-relaxed tracking-[.2em] text-[#a397b8] sm:block">
                tap a stop
                <br />
                to open the entry
              </p>
            </div>

            <p aria-live="polite" className="sr-only">
              {current ? `${current.year}, ${current.title}. Entry expanded.` : 'All entries collapsed.'}
            </p>

            <ol
              ref={listRef}
              onKeyDown={onListKeyDown}
              className="relative mt-8"
              aria-label="Career milestones, 2016 to 2026"
            >
              {MILESTONES.map((m, i) => (
                <TimelineStop
                  key={m.id}
                  m={m}
                  index={i}
                  open={openIndex === i}
                  passed={openIndex > i || (openIndex === -1 && true)}
                  onToggle={onToggle}
                  registerRef={registerRef}
                />
              ))}
            </ol>

            <CompanionPanel />
          </div>

          <Sidebar p={p} openIndex={openIndex} onJump={onJump} />
        </div>
      </main>

      {/* ---------------------------------------------------------- footer */}
      <footer className="relative z-10" style={{ borderTop: `1px solid ${T.border}` }}>
        <div aria-hidden className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${T.teal}aa, ${T.gold}88, ${T.rose}55, transparent)` }} />
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div>
            <p className="pw-display text-[22px] font-semibold leading-none" style={{ color: T.text }}>
              Rylee
              <span className="pw-mono ml-2 align-middle text-[10px] font-normal uppercase tracking-[.24em]" style={{ color: T.teal }}>
                keeper of the log
              </span>
            </p>
            <p className="pw-mono mt-2 text-[10px] uppercase tracking-[.2em] text-[#a397b8]">
              project worlds / journal timeline · 2016—2026 · depth {Math.round(p * 1180)} m
            </p>
          </div>
          <BackToTop />
        </div>
      </footer>
    </div>
  );
}

function BackToTop(): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const { buttonProps } = useButton(
    {
      elementType: 'div',
      'aria-label': 'Return to the surface',
      onPress: () => window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' }),
    },
    ref,
  );
  return (
    <div
      {...buttonProps}
      ref={ref}
      className="pw-btn group inline-flex cursor-pointer select-none items-center gap-3 self-start border bg-[#12101a] px-4 py-2.5 transition-colors duration-300 hover:bg-[#1a1724] focus-visible:outline-none sm:self-auto"
      style={{ borderColor: T.border }}
    >
      <span className="pw-mono text-[10px] uppercase tracking-[.24em] text-[#a397b8] transition-colors duration-300 group-hover:text-[#72b1b1]">
        surface
      </span>
      <span aria-hidden className="text-[13px] transition-transform duration-300 group-hover:-translate-y-[3px]" style={{ color: T.teal }}>
        ↑
      </span>
    </div>
  );
}