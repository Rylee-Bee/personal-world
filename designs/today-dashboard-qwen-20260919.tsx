{/* Tailwind reference (not executed):
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces&family=IBM+Plex+Sans&family=IBM+Plex+Mono&display=swap" rel="stylesheet" />
*/}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useButton } from 'react-aria';

/* ────────────────────────────────────────────────────────────
   Tokens
   ──────────────────────────────────────────────────────────── */
const T = {
  canvas: '#0a0810',
  panel: '#12101a',
  raised: '#1a1724',
  border: '#2a2538',
  ink: '#f0eaff',
  dim: '#a397b8',
  teal: '#72b1b1',
  rose: '#b57f8b',
  gold: '#e4c58d',
} as const;

type Health = 'healthy' | 'waiting' | 'unavailable';

const HEALTH: Record<Health, { label: string; hex: string; soft: string }> = {
  healthy: { label: 'Healthy', hex: T.teal, soft: 'rgba(114,177,177,.14)' },
  waiting: { label: 'Waiting', hex: T.gold, soft: 'rgba(228,197,141,.14)' },
  unavailable: { label: 'Unavailable', hex: T.rose, soft: 'rgba(181,127,139,.16)' },
};

/* ────────────────────────────────────────────────────────────
   Data
   ──────────────────────────────────────────────────────────── */
interface Capability {
  id: string;
  index: string;
  name: string;
  kind: string;
  status: Health;
  headline: string;
  summary: string;
  spark: number[];
  meters: { label: string; value: number }[];
  metrics: [string, string][];
  log: [string, string][];
}

const CAPABILITIES: Capability[] = [
  {
    id: 'scm',
    index: '01',
    name: 'Source Control',
    kind: 'git · 3 remotes · atlas-org',
    status: 'healthy',
    headline: 'All branches in sync',
    summary:
      'Last push landed from atlas-frontend@main. No drift detected across the three active worlds; merge train is moving clean.',
    spark: [4, 6, 5, 9, 7, 11, 10, 14, 12, 16, 15, 19],
    meters: [
      { label: 'Index freshness', value: 0.96 },
      { label: 'Review load', value: 0.42 },
    ],
    metrics: [
      ['Open PRs', '3'],
      ['Active branches', '12'],
      ['Merge rate', '94%'],
      ['Unpushed drift', '0 bytes'],
    ],
    log: [
      ['06:44', 'merge #418 · tide-window scheduler · 21 files'],
      ['06:12', 'push atlas-frontend@main · 4 commits'],
      ['04:58', 'tag v2.14.0 → released'],
    ],
  },
  {
    id: 'idp',
    index: '02',
    name: 'Identity Provider',
    kind: 'oidc · 1,284 live sessions',
    status: 'waiting',
    headline: 'Token refresh stalled',
    summary:
      'The refresh loop for the discovery scope is waiting on a rotated signing key. Sessions remain valid for 3h 41m.',
    spark: [12, 11, 13, 10, 11, 8, 9, 6, 7, 5, 6, 4],
    meters: [
      { label: 'MFA coverage', value: 0.92 },
      { label: 'Key rotation due', value: 0.68 },
    ],
    metrics: [
      ['Sessions', '1,284'],
      ['Pending scopes', '2'],
      ['Failed logins (1h)', '7'],
      ['Signing key', 'rotates 18:00'],
    ],
    log: [
      ['05:58', 'refresh loop paused · awaiting key material'],
      ['04:31', 'scope discovery.read granted to 3 worlds'],
      ['01:02', 'session store compacted · 12.4 MB'],
    ],
  },
  {
    id: 'feed',
    index: '03',
    name: 'Discovery Feed',
    kind: 'crawler · 87% index depth',
    status: 'healthy',
    headline: 'Surfacing new worlds',
    summary:
      'The crawler is riding the current as expected. Ranking weights were re-fit at 05:10 after a 4-day drift window.',
    spark: [2, 5, 4, 8, 12, 10, 15, 18, 16, 22, 25, 29],
    meters: [
      { label: 'Index depth', value: 0.87 },
      { label: 'Dedup pressure', value: 0.31 },
    ],
    metrics: [
      ['Docs (24h)', '1,204'],
      ['New worlds', '142'],
      ['Ranking drift', '0.04'],
      ['Cold queries', '112 ms'],
    ],
    log: [
      ['06:20', 're-index 1,204 documents · 0 failures'],
      ['05:10', 'ranking weights re-fit'],
      ['02:07', '142 new worlds surfaced'],
    ],
  },
  {
    id: 'ci',
    index: '04',
    name: 'Deployment Pipeline',
    kind: 'edge · 6 regions · 1 unreachable',
    status: 'unavailable',
    headline: 'eu-west-2 unreachable',
    summary:
      'Promotion halted after three failed health probes in the edge region. Rollback to v2.13.9 is staged and one action away.',
    spark: [18, 17, 19, 15, 12, 9, 8, 4, 3, 2, 1, 1],
    meters: [
      { label: 'Regions live', value: 0.83 },
      { label: 'Queue pressure', value: 0.74 },
    ],
    metrics: [
      ['Last good deploy', '06:42'],
      ['Failed probes', '3 / 3'],
      ['Rollback', 'staged'],
      ['Blocked runs', '2'],
    ],
    log: [
      ['06:47', 'probe fail eu-west-2 · 503 from /healthz'],
      ['06:42', 'v2.14.0 promoted to staging'],
      ['06:03', 'build #2291 · 4m 12s · green'],
    ],
  },
];

interface Priority {
  id: string;
  weight: 'critical' | 'notable' | 'routine';
  title: string;
  context: string;
  source: string;
  dueInMin: number;
  progress: number;
  action: string;
}

const PRIORITIES: Priority[] = [
  {
    id: 'p1',
    weight: 'critical',
    title: 'Approve the schema migration before the tide window closes',
    context: 'worlds.tide_slots needs a non-reversible column swap. Two services depend on it.',
    source: 'Source Control',
    dueInMin: 42,
    progress: 0.66,
    action: 'Review migration',
  },
  {
    id: 'p2',
    weight: 'notable',
    title: 'Answer three reviewer notes on PR #418',
    context: 'Odin is asking about the retry budget; the other two are nits you can batch.',
    source: 'Deployment Pipeline',
    dueInMin: 96,
    progress: 0.34,
    action: 'Open PR #418',
  },
  {
    id: 'p3',
    weight: 'routine',
    title: 'Rotate the expiring webhook secret',
    context: 'Discovery Feed still posts with the 2023 secret. Rotation takes about four minutes.',
    source: 'Identity Provider',
    dueInMin: 214,
    progress: 0.12,
    action: 'Start rotation',
  },
];

interface Activity {
  id: string;
  minutesAgo: number;
  lane: 'deploys' | 'security' | 'feed';
  status: Health;
  title: string;
  body: string;
  actor: string;
}

const ACTIVITY: Activity[] = [
  {
    id: 'a1',
    minutesAgo: 18,
    lane: 'deploys',
    status: 'unavailable',
    title: 'Promotion halted in eu-west-2',
    body: 'Three consecutive health probes returned 503. Pipeline is holding v2.14.0 at the edge gate with rollback staged.',
    actor: 'pipeline/edge-gate',
  },
  {
    id: 'a2',
    minutesAgo: 34,
    lane: 'deploys',
    status: 'healthy',
    title: 'v2.14.0 promoted to staging',
    body: 'Tide-window scheduler landed. 21 files changed, 4m 12s build, zero flaky tests re-run.',
    actor: 'rylee@atlas-org',
  },
  {
    id: 'a3',
    minutesAgo: 122,
    lane: 'feed',
    status: 'healthy',
    title: 'Discovery Feed re-indexed 1,204 documents',
    body: 'Ranking weights re-fit after a four-day drift window. Cold query latency improved to 112 ms.',
    actor: 'crawler/shallows',
  },
  {
    id: 'a4',
    minutesAgo: 211,
    lane: 'security',
    status: 'waiting',
    title: 'Token refresh loop paused',
    body: 'Identity Provider is waiting on rotated signing key material. Existing sessions remain valid until 10:39.',
    actor: 'idp/refresher',
  },
  {
    id: 'a5',
    minutesAgo: 402,
    lane: 'feed',
    status: 'healthy',
    title: '142 new worlds surfaced overnight',
    body: 'Most clustered around the archive shelf. Six were flagged for duplicate coordinates and merged.',
    actor: 'crawler/deep',
  },
];

interface Alert {
  id: string;
  severity: Health;
  source: string;
  title: string;
  body: string;
  minutesAgo: number;
}

const ALERTS: Alert[] = [
  {
    id: 'al1',
    severity: 'unavailable',
    source: 'Deployment Pipeline',
    title: 'Edge region eu-west-2 unreachable',
    body: 'Health probes failing for 18 minutes. Two runs blocked behind the gate. Rollback to v2.13.9 is staged.',
    minutesAgo: 18,
  },
  {
    id: 'al2',
    severity: 'waiting',
    source: 'Identity Provider',
    title: 'Signing key rotation overdue',
    body: 'The discovery.refresh scope cannot renew tokens until the 2024 key is retired at 18:00.',
    minutesAgo: 211,
  },
  {
    id: 'al3',
    severity: 'waiting',
    source: 'Source Control',
    title: 'Review budget exceeded on PR #418',
    body: 'Open for 19 hours with three unresolved threads. Stale reviews will auto-close at 24 hours.',
    minutesAgo: 61,
  },
  {
    id: 'al4',
    severity: 'healthy',
    source: 'Discovery Feed',
    title: 'Index depth recovered to 87%',
    body: 'Informational. The crawler cleared the backlog it inherited from the weekend storm.',
    minutesAgo: 122,
  },
];

const TICKER = [
  '06:47 probe fail · eu-west-2',
  '06:44 merge #418 · 21 files',
  '06:42 v2.14.0 → staging',
  '06:20 re-index 1,204 docs',
  '05:58 idp refresh paused',
  '05:10 ranking weights re-fit',
  '04:31 discovery.read scope granted ×3',
  '02:07 142 new worlds surfaced',
];

const SIGNALS = [
  { label: 'Depth pressure', value: 0.62, hex: T.teal },
  { label: 'Current clarity', value: 0.88, hex: T.teal },
  { label: 'Surface noise', value: 0.24, hex: T.gold },
  { label: 'Reef health', value: 0.71, hex: T.rose },
];

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const pad = (n: number) => String(n).padStart(2, '0');

const clockString = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const dayString = (d: Date) =>
  d
    .toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })
    .toUpperCase();

function ago(minutes: number, now: number) {
  const mins = Math.max(0, Math.round(minutes - now / 60000) + minutes - minutes);
  const m = Math.round(minutes);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return 'yesterday';
}

function useScramble(text: string, cycle: number) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reducedMotion()) {
      setOut(text);
      return;
    }
    const glyphs = '▚▞░▒▓/\\{}[]<>#%&*+=~^·abcdefghijklmnopqrstuvwxyz';
    let frame = 0;
    let raf = 0;
    const total = 46;
    const tick = () => {
      frame += 1;
      const revealed = Math.floor((frame / total) * text.length * 1.25);
      if (frame % 2 === 0) {
        setOut(
          text
            .split('')
            .map((c, i) =>
              c === ' ' || c === ',' ? c : i < revealed ? c : glyphs[(Math.random() * glyphs.length) | 0]
            )
            .join('')
        );
      }
      if (frame < total) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, cycle]);
  return out;
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

/* ────────────────────────────────────────────────────────────
   Style block
   ──────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

.pw-root{font-family:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
.pw-display{font-family:'Fraunces','Iowan Old Style',Georgia,serif;font-optical-sizing:auto;}
.pw-mono{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;}

.pw-reveal{opacity:0;transform:translate3d(0,16px,0);clip-path:inset(0 0 100% 0);
  transition:opacity .75s cubic-bezier(.22,1,.36,1),transform .75s cubic-bezier(.22,1,.36,1),clip-path .95s cubic-bezier(.22,1,.36,1);}
.pw-reveal-in{opacity:1;transform:none;clip-path:inset(-30% -30% -30% -30%);}

@keyframes pw-breathe{0%,100%{transform:translateY(0) scale(1);opacity:.55}50%{transform:translateY(-9px) scale(1.035);opacity:1}}
@keyframes pw-drift{0%,100%{transform:translate3d(0,0,0) rotate(-1.5deg)}50%{transform:translate3d(-14px,-20px,0) rotate(2deg)}}
@keyframes pw-halo{0%{transform:scale(.75);opacity:.5}70%{opacity:0}100%{transform:scale(1.7);opacity:0}}
@keyframes pw-rise{0%{transform:translateY(0) scale(.6);opacity:0}18%{opacity:.7}100%{transform:translateY(-74px) scale(1);opacity:0}}
@keyframes pw-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes pw-draw{to{stroke-dashoffset:0}}
@keyframes pw-blink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes pw-scan{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@keyframes pw-sheen{0%{transform:translateX(-120%) skewX(-14deg)}100%{transform:translateX(320%) skewX(-14deg)}}
@keyframes pw-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes pw-caustic{0%,100%{opacity:.32;transform:translate3d(0,0,0) scale(1)}50%{opacity:.6;transform:translate3d(2.5%,1.5%,0) scale(1.07)}}

.pw-draw{stroke-dasharray:260;stroke-dashoffset:260;animation:pw-draw 1.6s cubic-bezier(.22,1,.36,1) forwards;}
.pw-fade{animation:pw-fade .5s cubic-bezier(.22,1,.36,1) both;}
.pw-marquee{animation:pw-marquee 46s linear infinite;}
.pw-marquee:hover{animation-play-state:paused;}
.pw-breathe{animation:pw-breathe 7s ease-in-out infinite;}
.pw-drift{animation:pw-drift 22s ease-in-out infinite;}
.pw-halo{animation:pw-halo 4.6s ease-out infinite;}
.pw-blink{animation:pw-blink 2.6s ease-in-out infinite;}
.pw-caustic{animation:pw-caustic 18s ease-in-out infinite;}
.pw-bob{animation:pw-rise 5.5s ease-in infinite;}

.pw-card{position:relative;overflow:hidden;isolation:isolate;}
.pw-card::after{content:'';position:absolute;top:0;left:0;width:38%;height:100%;
  background:linear-gradient(100deg,transparent,rgba(240,234,255,.055),transparent);
  opacity:0;pointer-events:none;}
.pw-card:hover::after{opacity:1;animation:pw-sheen 1.15s ease-out;}

.pw-grain::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.05;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");}

.pw-tick::-webkit-scrollbar{width:8px;height:8px}
.pw-tick::-webkit-scrollbar-track{background:#0a0810}
.pw-tick::-webkit-scrollbar-thumb{background:#2a2538;border-radius:99px}
.pw-tick::-webkit-scrollbar-thumb:hover{background:#3a3350}
::selection{background:rgba(114,177,177,.32);color:#f0eaff}

@media (prefers-reduced-motion: reduce){
  .pw-reveal{opacity:1!important;transform:none!important;clip-path:none!important;}
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important;}
  .pw-draw{stroke-dashoffset:0!important;}
}
`;

/* ────────────────────────────────────────────────────────────
   Primitives
   ──────────────────────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.04, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`pw-reveal ${shown ? 'pw-reveal-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function StatusDot({ status, size = 8 }: { status: Health; size?: number }) {
  const hex = HEALTH[status].hex;
  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true">
      <span
        className="absolute inset-0 rounded-full pw-blink"
        style={{ background: hex, boxShadow: `0 0 12px ${hex}` }}
      />
      <span
        className="relative rounded-full"
        style={{ width: size, height: size, background: hex, opacity: 0.35 }}
      />
    </span>
  );
}

function Badge({ status }: { status: Health }) {
  const h = HEALTH[status];
  return (
    <span
      className="pw-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]"
      style={{ borderColor: `${h.hex}55`, background: h.soft, color: h.hex }}
    >
      <StatusDot status={status} size={6} />
      {h.label}
    </span>
  );
}

function Sparkline({
  data,
  color,
  w = 96,
  h = 30,
  cycle,
}: {
  data: number[];
  color: string;
  w?: number;
  h?: number;
  cycle: number;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map(
    (v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 8) - 4}`
  );
  const last = pts[pts.length - 1].split(',');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden="true">
      <polyline
        key={`${cycle}-${color}`}
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pw-draw"
        opacity={0.85}
      />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} className="pw-blink" />
    </svg>
  );
}

function Meter({ label, value, hex }: { label: string; value: number; hex: string }) {
  return (
    <div>
      <div className="pw-mono flex items-baseline justify-between text-[10px] uppercase tracking-[0.16em] text-[#a397b8]">
        <span>{label}</span>
        <span style={{ color: hex }}>{Math.round(value * 100)}%</span>
      </div>
      <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[#2a2538]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${value * 100}%`,
            background: `linear-gradient(90deg, ${hex}44, ${hex})`,
            boxShadow: `0 0 10px ${hex}66`,
          }}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Mermaid companion
   ──────────────────────────────────────────────────────────── */
function MermaidGlyph({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 196" fill="none" className={className} style={style} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="64" cy="26" r="10" />
        <path d="M55 18c-9 2-14 10-12 18 1 6 5 9 5 14 0 6-4 9-8 12" opacity=".65" />
        <path d="M73 17c8 4 11 11 9 19" opacity=".5" />
        <path d="M64 36c0 6-2 9-5 13-5 8-7 15-5 23 2 9 8 13 9 22" />
        <path d="M59 53c-7 3-12 10-13 18" opacity=".6" />
        <path d="M63 94c1 12-4 20-9 30-5 10-7 21-3 31" />
        <path d="M51 145c-11-4-20-1-25 9 12 3 20 0 25-9z" opacity=".85" />
        <path d="M51 145c8 6 18 7 26 3-9-7-18-8-26-3z" opacity=".85" />
      </g>
    </svg>
  );
}

function AmbientMermaid() {
  return (
    <div
      className="pointer-events-none fixed -bottom-16 -right-10 z-0 hidden select-none sm:block lg:-bottom-8 lg:right-2"
      aria-hidden="true"
    >
      <div className="pw-drift">
        <div
          className="pw-breathe rounded-full"
          style={{
            color: T.teal,
            filter: 'drop-shadow(0 0 26px rgba(114,177,177,.55))',
            opacity: 0.14,
          }}
        >
          <MermaidGlyph className="w-[220px] lg:w-[280px]" />
        </div>
      </div>
    </div>
  );
}

function Companion({ cycle }: { cycle: number }) {
  const [awake, setAwake] = useState(false);
  const { buttonProps } = useButton(
    {
      onPress: () => setAwake((a) => !a),
      'aria-pressed': awake,
      'aria-label': awake ? 'Let the companion rest' : 'Wake the companion',
    },
    useRef<HTMLButtonElement>(null)
  );

  return (
    <section
      className="pw-card relative rounded-[4px] border border-[#2a2538] bg-[#12101a] p-4"
      aria-label="Companion"
    >
      <div className="pw-mono flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-[#a397b8]">
        <span>Companion</span>
        <span style={{ color: awake ? T.teal : T.dim }}>{awake ? 'awake' : 'resting'}</span>
      </div>

      <div className="relative mt-3 flex items-center justify-center py-2">
        {/* halo rings */}
        <span
          className="pw-halo absolute h-24 w-24 rounded-full border"
          style={{ borderColor: `${T.teal}44`, animationDelay: '0s' }}
          aria-hidden="true"
        />
        <span
          className="pw-halo absolute h-24 w-24 rounded-full border"
          style={{ borderColor: `${T.teal}22`, animationDelay: '1.6s' }}
          aria-hidden="true"
        />
        <span
          className="absolute h-28 w-28 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${T.teal}2e, transparent 70%)` }}
          aria-hidden="true"
        />
        {/* bubbles */}
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={`${i}-${cycle}`}
            className="pw-bob absolute bottom-3 h-1 w-1 rounded-full"
            style={{
              left: `${38 + i * 8}%`,
              background: `${T.teal}88`,
              animationDelay: `${i * 0.9}s`,
              animationDuration: `${5 + i}s`,
            }}
            aria-hidden="true"
          />
        ))}
        <div
          className="pw-breathe relative"
          style={{
            color: T.teal,
            opacity: awake ? 0.95 : 0.5,
            filter: `drop-shadow(0 0 ${awake ? 18 : 9}px rgba(114,177,177,${awake ? 0.6 : 0.3}))`,
            transition: 'opacity .6s ease, filter .6s ease',
          }}
        >
          <MermaidGlyph className="w-[74px]" />
        </div>
      </div>

      <p className="pw-display mt-1 text-center text-[15px] leading-snug text-[#f0eaff]">
        Nyx <span className="text-[#a397b8]">· {awake ? 'watching the gate' : 'dreaming in the shallows'}</span>
      </p>
      <p className="pw-mono mt-1 text-center text-[10px] leading-relaxed tracking-[0.1em] text-[#a397b8]">
        depth 12m · temp 14.2° · mood {awake ? 'curious' : 'calm'}
      </p>

      <button
        {...buttonProps}
        ref={undefined as never}
        className="pw-mono mt-3 w-full rounded-[3px] border border-[#2a2538] bg-[#1a1724] px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-[#a397b8] transition-all duration-300 hover:border-[#72b1b1]/50 hover:text-[#72b1b1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1]/70"
      >
        {awake ? 'let her rest' : 'wake nyx'}
      </button>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Capability card
   ──────────────────────────────────────────────────────────── */
function CapabilityCard({
  cap,
  expanded,
  onToggle,
  cycle,
}: {
  cap: Capability;
  expanded: boolean;
  onToggle: () => void;
  cycle: number;
}) {
  const h = HEALTH[cap.status];
  const ref = useRef<HTMLDivElement>(null);
  const { buttonProps } = useButton(
    {
      elementType: 'div',
      onPress: onToggle,
      'aria-expanded': expanded,
      'aria-controls': `cap-body-${cap.id}`,
    },
    ref
  );

  return (
    <div
      ref={ref}
      {...buttonProps}
      role="button"
      tabIndex={buttonProps.tabIndex ?? 0}
      aria-label={`${cap.name}. Status ${h.label}. ${expanded ? 'Collapse' : 'Expand'} details.`}
      className={`pw-card group relative cursor-pointer rounded-[4px] border bg-[#12101a] p-4 text-left transition-all duration-300 sm:p-5 ${
        expanded
          ? 'border-[#72b1b1]/45 bg-[#1a1724] shadow-[0_18px_50px_-24px_rgba(114,177,177,.5)]'
          : 'border-[#2a2538] hover:-translate-y-[3px] hover:border-[#453c5c] hover:bg-[#1a1724]'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810]`}
    >
      <span
        className="absolute left-0 top-0 h-full w-[2px] transition-all duration-300"
        style={{ background: h.hex, opacity: expanded ? 1 : 0.35, boxShadow: `0 0 14px ${h.hex}88` }}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="pw-mono flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#a397b8]">
            <span style={{ color: h.hex }}>{cap.index}</span>
            <span className="h-px w-4 bg-[#2a2538]" />
            <span className="truncate">{cap.kind}</span>
          </div>
          <h3 className="pw-display mt-1.5 truncate text-[19px] font-medium leading-tight text-[#f0eaff] sm:text-[21px]">
            {cap.name}
          </h3>
        </div>
        <Badge status={cap.status} />
      </div>

      <p className="mt-2.5 text-[13px] leading-relaxed text-[#a397b8]">
        <span className="text-[#f0eaff]">{cap.headline}.</span>{' '}
        {expanded ? cap.summary : `${cap.summary.slice(0, 74)}…`}
      </p>

      <div className="mt-4 flex items-end justify-between gap-4">
        <Sparkline data={cap.spark} color={h.hex} cycle={cycle} />
        <div className="flex-1 space-y-2">
          {cap.meters.map((m) => (
            <Meter key={m.label} label={m.label} value={m.value} hex={h.hex} />
          ))}
        </div>
      </div>

      {/* expandable body */}
      <div
        id={`cap-body-${cap.id}`}
        className={`grid transition-all duration-300 ease-out ${
          expanded ? 'mt-5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#2a2538] pt-4 sm:grid-cols-4">
            {cap.metrics.map(([label, value]) => (
              <div key={label}>
                <div className="pw-mono text-[9px] uppercase tracking-[0.16em] text-[#a397b8]">{label}</div>
                <div className="pw-display mt-0.5 text-[15px] text-[#f0eaff]">{value}</div>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-1.5">
            {cap.log.map(([t, msg]) => (
              <li key={t + msg} className="pw-mono flex gap-3 text-[11px] leading-relaxed">
                <span className="shrink-0" style={{ color: h.hex }}>
                  {t}
                </span>
                <span className="truncate text-[#a397b8]">{msg}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pw-mono mt-3.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#a397b8] transition-colors duration-300 group-hover:text-[#72b1b1]">
        <span
          className="inline-block transition-transform duration-300"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          aria-hidden="true"
        >
          ▸
        </span>
        {expanded ? 'collapse detail' : 'expand detail'}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Priority row
   ──────────────────────────────────────────────────────────── */
const WEIGHT: Record<Priority['weight'], { hex: string; label: string }> = {
  critical: { hex: T.rose, label: 'critical' },
  notable: { hex: T.gold, label: 'notable' },
  routine: { hex: T.teal, label: 'routine' },
};

function ActionButton({
  children,
  onPress,
  tone = 'ghost',
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  tone?: 'ghost' | 'solid';
  label?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton({ onPress, 'aria-label': label }, ref);
  return (
    <button
      {...buttonProps}
      className={`pw-mono rounded-[3px] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#12101a] ${
        tone === 'solid'
          ? 'border border-[#72b1b1]/45 bg-[#72b1b1]/12 text-[#72b1b1] hover:bg-[#72b1b1]/22 hover:border-[#72b1b1]/70'
          : 'border border-[#2a2538] bg-[#1a1724] text-[#a397b8] hover:border-[#453c5c] hover:text-[#f0eaff]'
      }`}
    >
      {children}
    </button>
  );
}

function PriorityRow({
  item,
  now,
  state,
  onHandle,
  onSnooze,
}: {
  item: Priority;
  now: number;
  state: 'open' | 'done';
  onHandle: () => void;
  onSnooze: () => void;
}) {
  const w = WEIGHT[item.weight];
  const remaining = Math.max(0, item.dueInMin * 60 - now / 1000);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const urgent = remaining < 3600;

  return (
    <li
      className={`pw-card relative rounded-[4px] border p-4 pl-5 transition-all duration-300 ${
        state === 'done'
          ? 'border-[#2a2538]/70 bg-[#12101a]/40 opacity-60'
          : 'border-[#2a2538] bg-[#12101a] hover:border-[#453c5c] hover:bg-[#1a1724]'
      }`}
    >
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: state === 'done' ? T.dim : w.hex, opacity: state === 'done' ? 0.4 : 0.85 }}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="pw-mono flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
            <span style={{ color: w.hex }}>{state === 'done' ? 'resolved' : w.label}</span>
            <span className="h-px w-4 bg-[#2a2538]" aria-hidden="true" />
            <span className="text-[#a397b8]">{item.source}</span>
          </div>
          <h4
            className={`pw-display mt-1.5 text-[17px] leading-snug text-[#f0eaff] sm:text-[18px] ${
              state === 'done' ? 'line-through decoration-[#a397b8]/50' : ''
            }`}
          >
            {item.title}
          </h4>
          <p className="mt-1 max-w-[54ch] text-[13px] leading-relaxed text-[#a397b8]">{item.context}</p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div
            className="pw-mono tabular-nums text-[12px]"
            style={{ color: state === 'done' ? T.dim : urgent ? T.rose : T.gold }}
            aria-live="off"
          >
            {state === 'done' ? 'cleared' : `${pad(mins)}:${pad(secs)} left`}
          </div>
          <div className="h-[3px] w-28 overflow-hidden rounded-full bg-[#2a2538]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(state === 'done' ? 1 : item.progress) * 100}%`,
                background: `linear-gradient(90deg, ${w.hex}55, ${w.hex})`,
              }}
            />
          </div>
          {state === 'open' && (
            <div className="flex gap-2">
              <ActionButton onPress={onHandle} tone="solid">
                {item.action}
              </ActionButton>
              <ActionButton onPress={onSnooze}>Snooze</ActionButton>
            </div>
          )}
          {state === 'done' && (
            <ActionButton onPress={onHandle}>Reopen</ActionButton>
          )}
        </div>
      </div>
    </li>
  );
}

/* ────────────────────────────────────────────────────────────
   Timeline
   ──────────────────────────────────────────────────────────── */
function TimelineItem({
  item,
  now,
  last,
}: {
  item: Activity;
  now: number;
  last: boolean;
}) {
  const h = HEALTH[item.status];
  return (
    <li className="relative grid grid-cols-[auto_1fr] gap-x-4 sm:grid-cols-[84px_auto_1fr]">
      <div className="pw-mono hidden pt-[3px] text-right text-[11px] tabular-nums text-[#a397b8] sm:block">
        {ago(item.minutesAgo, now)}
      </div>
      <div className="relative flex flex-col items-center">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: h.hex, boxShadow: `0 0 12px ${h.hex}` }}
          aria-hidden="true"
        />
        {!last && <span className="mt-1 w-px flex-1 bg-[#2a2538]" aria-hidden="true" />}
      </div>
      <div className={`pb-7 ${last ? 'pb-0' : ''}`}>
        <div className="pw-mono flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] sm:hidden">
          <span style={{ color: T.dim }}>{ago(item.minutesAgo, now)}</span>
        </div>
        <h4 className="pw-display text-[17px] leading-snug text-[#f0eaff]">{item.title}</h4>
        <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-[#a397b8]">{item.body}</p>
        <div className="pw-mono mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#a397b8]">
          <span style={{ color: h.hex }}>{item.status}</span>
          <span className="h-px w-4 bg-[#2a2538]" aria-hidden="true" />
          <span>{item.actor}</span>
        </div>
      </div>
    </li>
  );
}

/* ────────────────────────────────────────────────────────────
   Tabs
   ──────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview', label: 'Overview', key: '1' },
  { id: 'activity', label: 'Activity', key: '2' },
  { id: 'alerts', label: 'Alerts', key: '3' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function TabButton({
  tab,
  selected,
  count,
  onSelect,
  innerRef,
}: {
  tab: (typeof TABS)[number];
  selected: boolean;
  count: number;
  onSelect: () => void;
  innerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { buttonProps } = useButton(
    {
      onPress: onSelect,
      role: 'tab' as never,
      'aria-selected': selected,
      'aria-controls': 'pw-tabpanel',
      id: `pw-tab-${tab.id}`,
      tabIndex: selected ? 0 : -1,
    },
    innerRef
  );

  return (
    <button
      {...buttonProps}
      className={`pw-mono relative flex items-center gap-2 px-3.5 py-2.5 text-[11px] uppercase tracking-[0.2em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#72b1b1]/70 sm:px-5 ${
        selected ? 'text-[#f0eaff]' : 'text-[#a397b8] hover:text-[#f0eaff]'
      }`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full transition-all duration-300"
        style={{
          background: selected ? T.teal : T.border,
          boxShadow: selected ? `0 0 10px ${T.teal}` : 'none',
        }}
        aria-hidden="true"
      />
      {tab.label}
      <span
        className="tabular-nums transition-colors duration-300"
        style={{ color: selected ? T.teal : '#6a6080' }}
      >
        {String(count).padStart(2, '0')}
      </span>
      <span
        className="absolute inset-x-2 -bottom-px h-px origin-left transition-transform duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${T.teal}, transparent)`,
          transform: selected ? 'scaleX(1)' : 'scaleX(0)',
        }}
        aria-hidden="true"
      />
    </button>
  );
}

/* ────────────────────────────────────────────────────────────
   Main
   ──────────────────────────────────────────────────────────── */
export default function TodayDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [cycle, setCycle] = useState(0);
  const [syncedAt, setSyncedAt] = useState(() => Date.now());
  const [resolved, setResolved] = useState<string[]>([]);
  const [snoozed, setSnoozed] = useState<string[]>([]);
  const [acked, setAcked] = useState<string[]>([]);
  const [lane, setLane] = useState<'all' | Activity['lane']>('all');
  const now = useNow(1000);
  const clock = useMemo(() => new Date(now), [now]);
  const greeting = useScramble('Good morning, Rylee', cycle);
  const tabRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({});
  TABS.forEach((t) => {
    if (!tabRefs.current[t.id]) tabRefs.current[t.id] = React.createRef<HTMLButtonElement>();
  });

  const boot = useRef(Date.now());
  const elapsed = now - boot.current;

  const toggleCard = useCallback((id: string) => {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const refresh = useCallback(() => {
    setCycle((c) => c + 1);
    setSyncedAt(Date.now());
  }, []);

  // keyboard: 1/2/3 tabs, R refresh, Esc collapse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const t = TABS[Number(e.key) - 1];
        setActiveTab(t.id);
        tabRefs.current[t.id].current?.focus();
      } else if (e.key.toLowerCase() === 'r') {
        refresh();
      } else if (e.key === 'Escape') {
        setExpanded([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refresh]);

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === activeTab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setActiveTab(TABS[next].id);
      tabRefs.current[TABS[next].id].current?.focus();
    }
  };

  const visiblePriorities = useMemo(() => {
    const open = PRIORITIES.filter((p) => !snoozed.includes(p.id));
    return [
      ...open.filter((p) => !resolved.includes(p.id)),
      ...open.filter((p) => resolved.includes(p.id)),
    ];
  }, [resolved, snoozed]);

  const openAlerts = ALERTS.filter((a) => !acked.includes(a.id));
  const filteredActivity = lane === 'all' ? ACTIVITY : ACTIVITY.filter((a) => a.lane === lane);
  const needsYou = PRIORITIES.length - resolved.length - snoozed.length;
  const tide = 0.63;

  const { buttonProps: refreshProps } = useButton(
    { onPress: refresh, 'aria-label': 'Refresh dashboard data' },
    useRef<HTMLButtonElement>(null)
  );

  const laneFilters: { id: 'all' | Activity['lane']; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'deploys', label: 'Deploys' },
    { id: 'security', label: 'Security' },
    { id: 'feed', label: 'Feed' },
  ];

  return (
    <div
      className="pw-root pw-grain relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0810] text-[#f0eaff]"
      style={{ ['--pw-teal' as string]: T.teal }}
    >
      <style>{CSS}</style>

      {/* ── ambient layers ───────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div
          className="pw-caustic absolute inset-0"
          style={{
            background:
              'radial-gradient(1100px 620px at 12% -10%, rgba(114,177,177,.16), transparent 62%), radial-gradient(760px 520px at 88% 8%, rgba(181,127,139,.11), transparent 60%), radial-gradient(900px 700px at 50% 118%, rgba(228,197,141,.07), transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(42,37,56,.55) 1px, transparent 1px), linear-gradient(90deg, rgba(42,37,56,.55) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'radial-gradient(80% 60% at 50% 0%, #000 15%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(80% 60% at 50% 0%, #000 15%, transparent 78%)',
          }}
        />
        {[
          { l: '18%', t: '22%', d: '0s', s: 3 },
          { l: '64%', t: '48%', d: '3.4s', s: 2 },
          { l: '38%', t: '72%', d: '6.1s', s: 4 },
          { l: '82%', t: '34%', d: '1.8s', s: 2 },
          { l: '8%', t: '58%', d: '4.9s', s: 3 },
        ].map((m, i) => (
          <span
            key={i}
            className="pw-bob absolute rounded-full"
            style={{
              left: m.l,
              top: m.t,
              width: m.s,
              height: m.s,
              background: 'rgba(240,234,255,.5)',
              animationDelay: m.d,
              animationDuration: '11s',
            }}
          />
        ))}
      </div>
      <AmbientMermaid />

      {/* ── header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#2a2538] bg-[#0a0810]/88 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <span
              className="pw-breathe inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#72b1b1]/40 text-[#72b1b1]"
              style={{ boxShadow: '0 0 18px rgba(114,177,177,.28)' }}
              aria-hidden="true"
            >
              <MermaidGlyph className="w-4" />
            </span>
            <div className="leading-none">
              <div className="pw-display text-[15px] font-semibold tracking-tight text-[#f0eaff]">
                Project Worlds
              </div>
              <div className="pw-mono text-[9px] uppercase tracking-[0.28em] text-[#a397b8]">
                control surface
              </div>
            </div>
          </div>

          <nav
            className="pw-mono hidden items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#a397b8] md:flex"
            aria-label="Breadcrumb"
          >
            <span className="h-px w-6 bg-[#2a2538]" aria-hidden="true" />
            <span>rylee</span>
            <span className="text-[#453c5c]">/</span>
            <span>workspace</span>
            <span className="text-[#453c5c]">/</span>
            <span className="text-[#f0eaff]">today</span>
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div
              className="pw-mono hidden items-center gap-2 rounded-full border border-[#2a2538] bg-[#12101a] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] lg:flex"
              role="status"
              aria-label="System status"
            >
              <StatusDot status="healthy" size={7} />
              <span className="text-[#a397b8]">all worlds awake</span>
            </div>

            <div className="pw-mono tabular-nums text-[12px] text-[#f0eaff]" aria-hidden="true">
              {clockString(clock)}
            </div>

            <button
              {...refreshProps}
              className="pw-mono flex items-center gap-2 rounded-[3px] border border-[#2a2538] bg-[#12101a] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#a397b8] transition-all duration-300 hover:border-[#72b1b1]/50 hover:text-[#72b1b1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1]/70"
            >
              <span key={cycle} className="pw-fade inline-block" aria-hidden="true">
                ⟳
              </span>
              <span className="hidden sm:inline">sync</span>
            </button>
          </div>
        </div>

        {/* event ticker */}
        <div className="relative overflow-hidden border-t border-[#2a2538]/70 bg-[#12101a]/60 py-1.5">
          <div className="pw-marquee flex w-max gap-8 whitespace-nowrap pw-mono text-[10px] uppercase tracking-[0.2em] text-[#a397b8]/80">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-[#72b1b1]/70" aria-hidden="true" />
                {t}
              </span>
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0a0810] to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0a0810] to-transparent"
            aria-hidden="true"
          />
        </div>
        <div className="relative h-px w-full overflow-hidden bg-[#2a2538]" aria-hidden="true">
          <span
            className="pw-scan absolute inset-y-0 w-1/3"
            style={{ background: `linear-gradient(90deg, transparent, ${T.teal}, transparent)`, animation: 'pw-scan 6s linear infinite' }}
          />
        </div>
      </header>

      {/* ── main ─────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto w-full max-w-[1440px] flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pt-9">
        {/* depth / greeting */}
        <Reveal>
          <section
            className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8"
            aria-labelledby="pw-greeting"
          >
            <div className="lg:col-span-7">
              <div className="pw-mono flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.3em] text-[#a397b8]">
                <span style={{ color: T.teal }}>{dayString(clock)}</span>
                <span className="h-px w-8 bg-[#2a2538]" aria-hidden="true" />
                <span>world cycle 218</span>
                <span className="h-px w-8 bg-[#2a2538]" aria-hidden="true" />
                <span>depth 12m</span>
              </div>

              <h1
                id="pw-greeting"
                className="pw-display mt-3 text-[clamp(2.4rem,7.2vw,4.6rem)] font-light leading-[0.98] tracking-[-0.02em] text-[#f0eaff]"
              >
                {greeting.split(',')[0]}
                <span style={{ color: T.teal }}>,</span>
                <br className="hidden sm:block" />{' '}
                <em className="font-normal italic" style={{ color: T.gold }}>
                  {greeting.split(',')[1] ?? ''}
                </em>
              </h1>

              <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-[#a397b8] sm:text-[15px]">
                Three worlds are awake and moving.{' '}
                <span className="text-[#f0eaff]">{needsYou}</span> of them need your hands before the
                09:00 tide window closes, and the edge gate is holding a promotion you started last night.
              </p>

              {/* tide window */}
              <div className="mt-6 rounded-[4px] border border-[#2a2538] bg-[#12101a] p-4">
                <div className="pw-mono flex flex-wrap items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.2em]">
                  <span className="text-[#a397b8]">tide window · 08:18 → 09:00</span>
                  <span style={{ color: T.gold }}>closes in {pad(Math.max(0, 42 - Math.floor(elapsed / 60000)))}m</span>
                </div>
                <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-[#1a1724] ring-1 ring-inset ring-[#2a2538]">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${tide * 100}%`,
                      background: `linear-gradient(90deg, ${T.teal}33, ${T.teal} 55%, ${T.gold})`,
                    }}
                  />
                  <span
                    className="absolute top-1/2 h-4 w-px -translate-y-1/2"
                    style={{ left: `${tide * 100}%`, background: T.ink, boxShadow: `0 0 10px ${T.ink}` }}
                    aria-hidden="true"
                  />
                  <span
                    className="pw-blink absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                    style={{ background: T.gold }}
                    aria-hidden="true"
                  />
                </div>
                <div className="pw-mono mt-2 flex justify-between text-[9px] uppercase tracking-[0.18em] text-[#a397b8]/80">
                  <span>low water</span>
                  <span>safe crossing</span>
                  <span style={{ color: T.rose }}>gate closes</span>
                </div>
              </div>
            </div>

            {/* vitals */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-5">
              {[
                { k: 'Uptime', v: '99.98%', s: '30-day', spark: [7, 8, 8, 9, 8, 9, 10, 9, 10, 10, 9, 10], hex: T.teal },
                { k: 'p50 latency', v: '118ms', s: 'edge · all regions', spark: [12, 10, 11, 9, 8, 9, 7, 8, 6, 7, 6, 5], hex: T.gold },
                { k: 'Queue depth', v: '34', s: '2 blocked', spark: [3, 4, 6, 5, 7, 9, 8, 11, 13, 12, 15, 17], hex: T.rose },
                { k: 'Active worlds', v: '12', s: '4 in review', spark: [6, 7, 7, 8, 8, 9, 9, 10, 11, 11, 12, 12], hex: T.teal },
              ].map((m, i) => (
                <Reveal key={m.k} delay={80 * i} className="h-full">
                  <div className="pw-card group h-full rounded-[4px] border border-[#2a2538] bg-[#12101a] p-3.5 transition-all duration-300 hover:-translate-y-[3px] hover:border-[#453c5c] hover:bg-[#1a1724]">
                    <div className="pw-mono text-[9px] uppercase tracking-[0.2em] text-[#a397b8]">{m.k}</div>
                    <div className="pw-display mt-1 text-[26px] font-light leading-none tabular-nums text-[#f0eaff]">
                      {m.v}
                    </div>
                    <div className="pw-mono mt-0.5 text-[9px] uppercase tracking-[0.16em]" style={{ color: m.hex, opacity: 0.8 }}>
                      {m.s}
                    </div>
                    <div className="mt-2.5">
                      <Sparkline data={m.spark} color={m.hex} w={110} h={26} cycle={cycle} />
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        </Reveal>

        {/* body grid */}
        <div className="mt-9 grid grid-cols-1 gap-6 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_312px] lg:gap-8">
          <div className="min-w-0">
            {/* tab bar */}
            <Reveal>
              <div className="rounded-[4px] border border-[#2a2538] bg-[#12101a]">
                <div
                  role="tablist"
                  aria-label="Dashboard views"
                  onKeyDown={onTabKeyDown}
                  className="pw-tick flex items-center gap-1 overflow-x-auto border-b border-[#2a2538] px-1"
                >
                  {TABS.map((t) => (
                    <TabButton
                      key={t.id}
                      tab={t}
                      innerRef={tabRefs.current[t.id]}
                      selected={activeTab === t.id}
                      count={
                        t.id === 'overview'
                          ? CAPABILITIES.length
                          : t.id === 'activity'
                          ? ACTIVITY.length
                          : openAlerts.length
                      }
                      onSelect={() => setActiveTab(t.id)}
                    />
                  ))}
                  <div className="pw-mono ml-auto hidden items-center gap-2 pr-3 text-[9px] uppercase tracking-[0.18em] text-[#a397b8]/70 sm:flex">
                    <kbd className="rounded-[2px] border border-[#2a2538] bg-[#1a1724] px-1.5 py-0.5">1</kbd>
                    <kbd className="rounded-[2px] border border-[#2a2538] bg-[#1a1724] px-1.5 py-0.5">2</kbd>
                    <kbd className="rounded-[2px] border border-[#2a2538] bg-[#1a1724] px-1.5 py-0.5">3</kbd>
                  </div>
                </div>

                <div
                  role="tabpanel"
                  id="pw-tabpanel"
                  aria-labelledby={`pw-tab-${activeTab}`}
                  tabIndex={0}
                  className="p-4 focus-visible:outline-none sm:p-5"
                >
                  {/* ── OVERVIEW ─────────────────────────── */}
                  {activeTab === 'overview' && (
                    <div key={`ov-${cycle}`} className="pw-fade">
                      <div className="flex items-baseline justify-between gap-4">
                        <h2 className="pw-display text-[20px] font-medium text-[#f0eaff] sm:text-[22px]">
                          Capability surface
                        </h2>
                        <span className="pw-mono text-[10px] uppercase tracking-[0.18em] text-[#a397b8]">
                          {expanded.length ? `${expanded.length} open` : 'tap to expand'}
                        </span>
                      </div>
                      <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-[#a397b8]">
                        Four systems hold today together. Expand any card for its metrics, meters and the last
                        three events it emitted.
                      </p>

                      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {CAPABILITIES.map((cap, i) => (
                          <Reveal key={cap.id} delay={70 * i} className="h-full">
                            <CapabilityCard
                              cap={cap}
                              cycle={cycle}
                              expanded={expanded.includes(cap.id)}
                              onToggle={() => toggleCard(cap.id)}
                            />
                          </Reveal>
                        ))}
                      </div>

                      {/* what needs you now */}
                      <div className="mt-10">
                        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#2a2538] pb-3">
                          <h2 className="pw-display text-[20px] font-medium text-[#f0eaff] sm:text-[22px]">
                            What needs you now{' '}
                            <span className="pw-mono align-middle text-[11px] tracking-[0.18em]" style={{ color: T.rose }}>
                              {String(needsYou).padStart(2, '0')}
                            </span>
                          </h2>
                          <span className="pw-mono text-[10px] uppercase tracking-[0.18em] text-[#a397b8]">
                            sorted by tide pressure
                          </span>
                        </div>

                        {visiblePriorities.length > 0 ? (
                          <ul className="mt-4 space-y-3">
                            {visiblePriorities.map((p, i) => (
                              <Reveal key={p.id} delay={60 * i}>
                                <PriorityRow
                                  item={p}
                                  now={now - boot.current}
                                  state={resolved.includes(p.id) ? 'done' : 'open'}
                                  onHandle={() =>
                                    setResolved((prev) =>
                                      prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                                    )
                                  }
                                  onSnooze={() => setSnoozed((prev) => [...prev, p.id])}
                                />
                              </Reveal>
                            ))}
                          </ul>
                        ) : (
                          <div className="pw-card mt-4 flex items-center gap-4 rounded-[4px] border border-[#2a2538] bg-[#12101a] p-6">
                            <div
                              className="pw-breathe shrink-0 text-[#72b1b1]"
                              style={{ filter: 'drop-shadow(0 0 14px rgba(114,177,177,.5))' }}
                            >
                              <MermaidGlyph className="w-10" />
                            </div>
                            <div>
                              <p className="pw-display text-[18px] text-[#f0eaff]">
                                Nothing needs your hands. The water is calm.
                              </p>
                              <p className="mt-1 text-[13px] text-[#a397b8]">
                                Nyx is keeping the gate. Clear items return here when the next tide rolls in.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── ACTIVITY ─────────────────────────── */}
                  {activeTab === 'activity' && (
                    <div key="ac" className="pw-fade">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h2 className="pw-display text-[20px] font-medium text-[#f0eaff] sm:text-[22px]">
                            Recent activity
                          </h2>
                          <p className="mt-1 text-[13px] text-[#a397b8]">
                            Everything that crossed the surface in the last nine hours.
                          </p>
                        </div>
                        <div
                          className="pw-mono flex gap-1 text-[10px] uppercase tracking-[0.18em]"
                          role="group"
                          aria-label="Filter activity by lane"
                        >
                          {laneFilters.map((f) => (
                            <LaneChip
                              key={f.id}
                              label={f.label}
                              active={lane === f.id}
                              onPress={() => setLane(f.id)}
                            />
                          ))}
                        </div>
                      </div>

                      <ol className="mt-6">
                        {filteredActivity.map((item, i) => (
                          <Reveal key={item.id} delay={70 * i}>
                            <TimelineItem item={item} now={now - boot.current} last={i === filteredActivity.length - 1} />
                          </Reveal>
                        ))}
                      </ol>
                      {filteredActivity.length === 0 && (
                        <p className="pw-mono mt-6 text-[11px] uppercase tracking-[0.18em] text-[#a397b8]">
                          no events in this lane yet
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── ALERTS ───────────────────────────── */}
                  {activeTab === 'alerts' && (
                    <div key="al" className="pw-fade">
                      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#2a2538] pb-3">
                        <h2 className="pw-display text-[20px] font-medium text-[#f0eaff] sm:text-[22px]">
                          Alerts
                        </h2>
                        <span className="pw-mono text-[10px] uppercase tracking-[0.18em] text-[#a397b8]">
                          {openAlerts.length} open · {acked.length} acknowledged
                        </span>
                      </div>

                      <ul className="mt-4 space-y-3">
                        {ALERTS.map((a, i) => {
                          const isAcked = acked.includes(a.id);
                          const h = HEALTH[a.severity];
                          return (
                            <Reveal key={a.id} delay={60 * i}>
                              <li
                                className={`pw-card relative rounded-[4px] border p-4 pl-5 transition-all duration-300 ${
                                  isAcked
                                    ? 'border-[#2a2538]/70 bg-[#12101a]/40 opacity-55'
                                    : 'border-[#2a2538] bg-[#12101a] hover:border-[#453c5c] hover:bg-[#1a1724]'
                                }`}
                              >
                                <span
                                  className="absolute left-0 top-0 h-full w-[3px]"
                                  style={{ background: h.hex, opacity: isAcked ? 0.35 : 0.9 }}
                                  aria-hidden="true"
                                />
                                <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="pw-mono flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
                                      <span style={{ color: h.hex }}>{a.severity}</span>
                                      <span className="h-px w-4 bg-[#2a2538]" aria-hidden="true" />
                                      <span className="text-[#a397b8]">{a.source}</span>
                                      <span className="h-px w-4 bg-[#2a2538]" aria-hidden="true" />
                                      <span className="text-[#a397b8]">{ago(a.minutesAgo, now - boot.current)}</span>
                                    </div>
                                    <h3 className="pw-display mt-1.5 text-[17px] leading-snug text-[#f0eaff]">
                                      {a.title}
                                    </h3>
                                    <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-[#a397b8]">
                                      {a.body}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    <ActionButton
                                      tone={isAcked ? 'ghost' : 'solid'}
                                      onPress={() =>
                                        setAcked((prev) =>
                                          prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                                        )
                                      }
                                    >
                                      {isAcked ? 'un-ack' : 'acknowledge'}
                                    </ActionButton>
                                    <ActionButton onPress={() => setActiveTab('activity')}>trace</ActionButton>
                                  </div>
                                </div>
                              </li>
                            </Reveal>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          </div>

          {/* ── rail ─────────────────────────────────────── */}
          <aside className="space-y-4" aria-label="Companion and system vitals">
            <Reveal delay={60}>
              <Companion cycle={cycle} />
            </Reveal>

            <Reveal delay={140}>
              <section className="pw-card rounded-[4px] border border-[#2a2538] bg-[#12101a] p-4">
                <div className="pw-mono flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-[#a397b8]">
                  <span>Signal levels</span>
                  <span className="tabular-nums" style={{ color: T.teal }}>
                    live
                  </span>
                </div>
                <div className="mt-3.5 space-y-3">
                  {SIGNALS.map((s, i) => (
                    <div key={s.label} style={{ animationDelay: `${i * 90}ms` }} className="pw-fade">
                      <Meter label={s.label} value={s.value} hex={s.hex} />
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>

            <Reveal delay={200}>
              <section className="pw-card rounded-[4px] border border-[#2a2538] bg-[#12101a] p-4">
                <div className="pw-mono text-[10px] uppercase tracking-[0.22em] text-[#a397b8]">Latest signals</div>
                <ul className="mt-3 space-y-3">
                  {ACTIVITY.slice(0, 3).map((a) => (
                    <li key={a.id} className="grid grid-cols-[auto_1fr] gap-x-3">
                      <StatusDot status={a.status} size={7} />
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] leading-snug text-[#f0eaff]">{a.title}</div>
                        <div className="pw-mono text-[9px] uppercase tracking-[0.16em] text-[#a397b8]">
                          {ago(a.minutesAgo, now - boot.current)} · {a.actor}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>

            <Reveal delay={260}>
              <section className="pw-card rounded-[4px] border border-[#2a2538] bg-[#12101a] p-4">
                <div className="pw-mono text-[10px] uppercase tracking-[0.22em] text-[#a397b8]">Shortcuts</div>
                <dl className="pw-mono mt-3 space-y-2 text-[10px] uppercase tracking-[0.14em]">
                  {[
                    ['1 · 2 · 3', 'switch view'],
                    ['R', 're-sync'],
                    ['Enter', 'expand card'],
                    ['Esc', 'collapse all'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <dt className="rounded-[2px] border border-[#2a2538] bg-[#1a1724] px-1.5 py-0.5 text-[#f0eaff]">
                        {k}
                      </dt>
                      <dd className="text-[#a397b8]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </Reveal>
          </aside>
        </div>
      </main>

      {/* ── footer ───────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[#2a2538] bg-[#0a0810]">
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${T.teal} 18%, ${T.gold} 52%, ${T.rose} 78%, transparent)`,
            boxShadow: `0 0 18px ${T.teal}55`,
          }}
          aria-hidden="true"
        />
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 sm:px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <span className="text-[#72b1b1]" style={{ filter: 'drop-shadow(0 0 8px rgba(114,177,177,.5))' }} aria-hidden="true">
              <MermaidGlyph className="w-5" />
            </span>
            <span className="pw-display text-[16px] italic text-[#f0eaff]">Rylee</span>
          </div>
          <span className="pw-mono hidden text-[10px] uppercase tracking-[0.2em] text-[#a397b8] sm:inline">
            keeper of 12 worlds
          </span>
          <div className="pw-mono ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-[9px] uppercase tracking-[0.2em] text-[#a397b8]">
            <span role="status" aria-live="polite">
              synced {Math.floor((now - syncedAt) / 1000)}s ago
            </span>
            <span>build 2.14.0-edge</span>
            <span>session {pad(new Date(now).getHours())}:{pad(new Date(now).getMinutes())}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LaneChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton({ onPress }, ref);
  return (
    <button
      {...buttonProps}
      aria-pressed={active}
      className={`rounded-[3px] border px-2.5 py-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1]/70 ${
        active
          ? 'border-[#72b1b1]/50 bg-[#72b1b1]/12 text-[#72b1b1]'
          : 'border-[#2a2538] bg-[#1a1724] text-[#a397b8] hover:border-[#453c5c] hover:text-[#f0eaff]'
      }`}
    >
      {label}
    </button>
  );
}