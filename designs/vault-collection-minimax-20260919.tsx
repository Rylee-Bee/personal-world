import React, { useRef, useState, useMemo, useId, KeyboardEvent } from 'react';
import { useButton } from 'react-aria';

/*
  Self-contained .tsx file.
  Tailwind CDN reference (not executed in this file):
  <script src="https://cdn.tailwindcss.com"></script>
*/

type Status = 'active' | 'retired' | 'experimental';
type TabKey = 'all' | 'infrastructure' | 'automation' | 'security' | 'data' | 'observability';

interface VaultCard {
  id: string;
  name: string;
  description: string;
  category: Exclude<TabKey, 'all'>;
  tagColor: 'teal' | 'rose' | 'gold';
  status: Status;
  lastUsed: string;
}

const CARDS: VaultCard[] = [
  { id: 'proxmox', name: 'Proxmox', description: 'Virtualization hypervisor for homelab clusters and node orchestration', category: 'infrastructure', tagColor: 'teal', status: 'active', lastUsed: '2h ago' },
  { id: 'traefik', name: 'Traefik', description: 'Edge router and reverse proxy for containerized services', category: 'infrastructure', tagColor: 'teal', status: 'active', lastUsed: '1d ago' },
  { id: 'authelia', name: 'Authelia', description: 'SSO authentication proxy with 2FA and session control', category: 'security', tagColor: 'rose', status: 'active', lastUsed: '3d ago' },
  { id: 'docker', name: 'Docker', description: 'Container runtime for isolated service deployment', category: 'infrastructure', tagColor: 'teal', status: 'active', lastUsed: '30m ago' },
  { id: 'ansible', name: 'Ansible', description: 'Declarative automation for fleet configuration management', category: 'automation', tagColor: 'gold', status: 'active', lastUsed: '5h ago' },
  { id: 'git', name: 'Git', description: 'Version control backbone for all repositories', category: 'automation', tagColor: 'gold', status: 'active', lastUsed: '10m ago' },
  { id: 'bash', name: 'Bash', description: 'Shell scripting glue for system tasks and pipelines', category: 'automation', tagColor: 'gold', status: 'active', lastUsed: '1h ago' },
  { id: 'python', name: 'Python', description: 'General purpose scripting language for tooling and glue', category: 'automation', tagColor: 'gold', status: 'active', lastUsed: '4h ago' },
  { id: 'kubernetes', name: 'Kubernetes', description: 'Container orchestration platform for production workloads', category: 'infrastructure', tagColor: 'teal', status: 'experimental', lastUsed: '2w ago' },
  { id: 'sqlite', name: 'SQLite', description: 'Embedded relational database for local state', category: 'data', tagColor: 'rose', status: 'active', lastUsed: '6h ago' },
  { id: 'github-actions', name: 'GitHub Actions', description: 'CI/CD pipelines for automated deployments', category: 'automation', tagColor: 'gold', status: 'active', lastUsed: '1d ago' },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'automation', label: 'Automation' },
  { key: 'security', label: 'Security' },
  { key: 'data', label: 'Data' },
  { key: 'observability', label: 'Observability' },
];

const TAG: Record<VaultCard['tagColor'], { bg: string; text: string; border: string }> = {
  teal: { bg: 'bg-[#72b1b1]/10', text: 'text-[#72b1b1]', border: 'border-[#72b1b1]/30' },
  rose: { bg: 'bg-[#b57f8b]/10', text: 'text-[#b57f8b]', border: 'border-[#b57f8b]/30' },
  gold: { bg: 'bg-[#e4c58d]/10', text: 'text-[#e4c58d]', border: 'border-[#e4c58d]/30' },
};

const STATUS: Record<Status, { dot: string; text: string }> = {
  active: { dot: 'bg-[#72b1b1]', text: 'text-[#72b1b1]' },
  retired: { dot: 'bg-[#a397b8]', text: 'text-[#a397b8]' },
  experimental: { dot: 'bg-[#e4c58d]', text: 'text-[#e4c58d]' },
};

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const clearRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const { buttonProps } = useButton(
    { onPress: () => onChange(''), isDisabled: !value },
    clearRef
  );

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">Filter vault collection</label>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a397b8] pointer-events-none" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tools and skills…"
        aria-label="Filter vault collection"
        className="w-full bg-[#1a1724] border border-[#2a2538] rounded-xl pl-11 pr-11 py-3 text-sm text-[#f0eaff] placeholder:text-[#a397b8]/50 focus:outline-none focus:border-[#72b1b1] focus:ring-1 focus:ring-[#72b1b1]/40 transition-colors duration-200"
      />
      {value && (
        <button
          ref={clearRef}
          {...buttonProps}
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-[#a397b8] hover:text-[#f0eaff] hover:bg-[#2a2538] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] transition-colors"
          aria-label="Clear search"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    all: null, infrastructure: null, automation: null, security: null, data: null, observability: null,
  });

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    onChange(TABS[next].key);
    requestAnimationFrame(() => tabRefs.current[TABS[next].key]?.focus());
  };

  return (
    <div role="tablist" aria-label="Vault categories" className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide">
      {TABS.map((tab, idx) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => { tabRefs.current[tab.key] = el; }}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => handleKey(e, idx)}
            className={`relative px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810] ${
              isActive
                ? 'text-[#f0eaff] bg-[#1a1724] border border-[#2a2538]'
                : 'text-[#a397b8] hover:text-[#f0eaff] hover:bg-[#12101a] border border-transparent'
            }`}
          >
            {tab.label}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute left-4 right-4 -bottom-2 h-px bg-gradient-to-r from-transparent via-[#72b1b1] to-transparent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function VaultCardItem({ card }: { card: VaultCard }) {
  const tag = TAG[card.tagColor];
  const status = STATUS[card.status];

  return (
    <article
      tabIndex={0}
      aria-label={`${card.name}, ${card.category} category, ${card.status}, last used ${card.lastUsed}`}
      className="group relative bg-[#12101a] border border-[#2a2538] rounded-xl p-5 hover:border-[#72b1b1]/40 hover:bg-[#1a1724] hover:-translate-y-0.5 transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0810]"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded border ${tag.bg} ${tag.text} ${tag.border}`}>
          {card.category}
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] ${status.text}`}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${status.dot} ${card.status === 'active' ? 'motion-safe:animate-pulse' : ''}`}
            aria-hidden="true"
          />
          {card.status}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-[#f0eaff] mb-1 transition-colors duration-200 group-hover:text-[#72b1b1]">
        {card.name}
      </h3>
      <p className="text-sm text-[#a397b8] leading-relaxed mb-4">
        {card.description}
      </p>

      <div className="flex items-center gap-1.5 pt-3 border-t border-[#2a2538]/70">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#a397b8]/70" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="text-[11px] text-[#a397b8]/70 font-medium">
          Last used {card.lastUsed}
        </span>
      </div>
    </article>
  );
}

function MermaidCompanion() {
  return (
    <div
      aria-hidden="true"
      className="fixed bottom-0 right-0 w-72 h-80 md:w-96 md:h-[28rem] pointer-events-none z-0 select-none motion-safe:animate-[mermaidDrift_24s_ease-in-out_infinite]"
      style={{
        opacity: 0.09,
        filter: 'drop-shadow(0 0 28px rgba(114, 177, 177, 0.45))',
        WebkitMaskImage: 'radial-gradient(ellipse at 70% 80%, black 25%, transparent 75%)',
        maskImage: 'radial-gradient(ellipse at 70% 80%, black 25%, transparent 75%)',
      }}
    >
      <svg viewBox="0 0 200 240" className="w-full h-full text-[#72b1b1]">
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 80 22 L 100 12 L 120 22 L 114 32 L 86 32 Z" />
          <circle cx="100" cy="12" r="1.5" fill="currentColor" />
          <ellipse cx="100" cy="48" rx="15" ry="18" />
          <path d="M 85 38 Q 70 48 72 70" />
          <path d="M 115 38 Q 130 48 128 70" />
          <line x1="92" y1="64" x2="91" y2="78" />
          <line x1="108" y1="64" x2="109" y2="78" />
          <path d="M 78 82 Q 72 110 80 138 Q 100 148 120 138 Q 128 110 122 82 Z" />
          <path d="M 78 90 Q 56 100 54 128" />
          <path d="M 122 90 Q 144 100 146 128" />
          <circle cx="52" cy="134" r="8" />
          <path d="M 52 142 L 52 158" />
          <rect x="140" y="130" width="14" height="22" rx="1" />
          <line x1="142" y1="135" x2="152" y2="135" />
          <line x1="142" y1="140" x2="152" y2="140" />
          <line x1="142" y1="145" x2="152" y2="145" />
          <line x1="142" y1="150" x2="152" y2="150" />
          <path d="M 82 145 Q 72 175 75 205 Q 80 225 88 232" />
          <path d="M 118 145 Q 128 175 125 205 Q 120 225 112 232" />
          <path d="M 88 232 Q 65 240 58 230 Q 72 244 84 236" />
          <path d="M 112 232 Q 135 240 142 230 Q 128 244 116 236" />
          <path d="M 86 168 Q 100 164 114 168" opacity="0.5" />
          <path d="M 84 188 Q 100 184 116 188" opacity="0.5" />
          <path d="M 84 208 Q 100 204 116 208" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

export default function VaultCollection() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CARDS.filter((c) => {
      const matchTab = activeTab === 'all' || c.category === activeTab;
      const matchQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q);
      return matchTab && matchQuery;
    });
  }, [query, activeTab]);

  return (
    <div className="relative min-h-screen bg-[#0a0810] text-[#f0eaff] flex flex-col overflow-x-hidden font-sans antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 15% 0%, rgba(114,177,177,0.07), transparent 45%), radial-gradient(circle at 85% 100%, rgba(180,127,139,0.05), transparent 45%)',
        }}
      />

      <MermaidCompanion />

      <header className="relative z-10 px-5 md:px-10 pt-6 md:pt-8 pb-5 border-b border-[#2a2538]/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#a397b8] mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#72b1b1] motion-safe:animate-pulse" aria-hidden="true" />
              <span>Project Worlds</span>
              <span aria-hidden="true" className="opacity-40">/</span>
              <span className="opacity-80">Vault</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
              Good morning, <span className="text-[#72b1b1]">Rylee</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#a397b8] mt-1">
              Your curated tool &amp; skill registry
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#1a1724] border border-[#2a2538] rounded-full shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#72b1b1]" aria-hidden="true" />
            <span className="text-xs text-[#a397b8] font-medium">Online</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-5 md:px-10 py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 md:mb-8 space-y-4">
            <SearchField value={query} onChange={setQuery} />
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <TabBar active={activeTab} onChange={setActiveTab} />
              </div>
              <span
                className="hidden sm:block text-xs text-[#a397b8] whitespace-nowrap shrink-0 font-mono"
                aria-live="polite"
                aria-atomic="true"
              >
                {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          <div
            role="tabpanel"
            id="vault-panel"
            aria-label="Vault items"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
          >
            {filtered.length > 0 ? (
              filtered.map((card, idx) => (
                <div
                  key={`${activeTab}-${card.id}`}
                  style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                  className="motion-safe:animate-[vaultFadeIn_360ms_ease-out_both]"
                >
                  <VaultCardItem card={card} />
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1724] border border-[#2a2538] mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#72b1b1" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
                <div className="text-[#a397b8] text-sm">No items match your filter.</div>
                <button
                  type="button"
                  onClick={() => { setQuery(''); setActiveTab('all'); }}
                  className="mt-3 text-xs text-[#72b1b1] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#72b1b1] rounded px-2 py-1"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-5 md:px-10 py-5 border-t border-[#2a2538]/60">
        <div className="max-w-7xl mx-auto flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#72b1b1] to-[#b57f8b] flex items-center justify-center text-[#0a0810] text-xs font-bold"
              aria-hidden="true"
            >
              R
            </div>
            <span className="text-sm text-[#f0eaff] font-medium">Rylee</span>
          </div>
          <div
            aria-hidden="true"
            className="hidden md:block h-px flex-1 bg-gradient-to-r from-transparent via-[#72b1b1]/50 to-transparent"
          />
          <span className="text-xs text-[#a397b8] font-mono ml-auto md:ml-0 shrink-0">
            <span className="hidden md:inline">vault.worlds</span>
            <span className="md:hidden">v1</span>
            <span className="hidden md:inline">/v1</span>
          </span>
        </div>
      </footer>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        }
        @keyframes vaultFadeIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mermaidDrift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-4px, -6px); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}