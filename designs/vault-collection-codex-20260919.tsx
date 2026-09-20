import React, { Key, useMemo, useRef, useState } from 'react';
import {
  AriaTabProps,
  mergeProps,
  useButton,
  useSearchField,
  useTab,
  useTabList,
} from 'react-aria';
import {
  Item,
  useSearchFieldState,
  useTabListState,
} from 'react-stately';

// Tailwind CDN reference only: <script src="https://cdn.tailwindcss.com"></script>

type Category =
  | 'Infrastructure'
  | 'Automation'
  | 'Security'
  | 'Data'
  | 'Observability';

type ToolStatus = 'active' | 'retired' | 'experimental';

interface Tool {
  name: string;
  description: string;
  category: Category;
  status: ToolStatus;
  lastUsed: string;
  tone: 'teal' | 'rose' | 'gold';
}

const categories = [
  'All',
  'Infrastructure',
  'Automation',
  'Security',
  'Data',
  'Observability',
] as const;

const tools: Tool[] = [
  {
    name: 'Proxmox',
    description: 'Virtualization platform for the home lab and clustered services.',
    category: 'Infrastructure',
    status: 'active',
    lastUsed: 'Today, 09:42',
    tone: 'teal',
  },
  {
    name: 'Traefik',
    description: 'Edge routing, TLS termination, and service discovery.',
    category: 'Infrastructure',
    status: 'active',
    lastUsed: 'Yesterday',
    tone: 'teal',
  },
  {
    name: 'Authelia',
    description: 'Identity gateway and policy enforcement for private services.',
    category: 'Security',
    status: 'active',
    lastUsed: '2 days ago',
    tone: 'rose',
  },
  {
    name: 'Docker',
    description: 'Portable containers for local and hosted workloads.',
    category: 'Infrastructure',
    status: 'active',
    lastUsed: 'Today, 08:16',
    tone: 'teal',
  },
  {
    name: 'Ansible',
    description: 'Repeatable configuration and fleet maintenance automation.',
    category: 'Automation',
    status: 'active',
    lastUsed: '3 days ago',
    tone: 'gold',
  },
  {
    name: 'Git',
    description: 'Versioned project history and collaborative source control.',
    category: 'Automation',
    status: 'active',
    lastUsed: 'Today, 10:05',
    tone: 'gold',
  },
  {
    name: 'Bash',
    description: 'Small, dependable scripts for systems and developer workflows.',
    category: 'Automation',
    status: 'active',
    lastUsed: 'Yesterday',
    tone: 'gold',
  },
  {
    name: 'Python',
    description: 'General automation, data processing, and service development.',
    category: 'Data',
    status: 'active',
    lastUsed: 'Today, 09:18',
    tone: 'teal',
  },
  {
    name: 'Kubernetes',
    description: 'Declarative orchestration for distributed container workloads.',
    category: 'Infrastructure',
    status: 'experimental',
    lastUsed: '2 weeks ago',
    tone: 'rose',
  },
  {
    name: 'SQLite',
    description: 'Compact relational storage for local tools and prototypes.',
    category: 'Data',
    status: 'active',
    lastUsed: '5 days ago',
    tone: 'teal',
  },
  {
    name: 'GitHub Actions',
    description: 'Automated checks, releases, and repository maintenance.',
    category: 'Observability',
    status: 'retired',
    lastUsed: '1 month ago',
    tone: 'gold',
  },
];

const toneClasses = {
  teal: 'border-[#72b1b1]/35 bg-[#72b1b1]/10 text-[#72b1b1]',
  rose: 'border-[#b57f8b]/35 bg-[#b57f8b]/10 text-[#b57f8b]',
  gold: 'border-[#e4c58d]/35 bg-[#e4c58d]/10 text-[#e4c58d]',
};

const statusClasses: Record<ToolStatus, string> = {
  active: 'bg-[#72b1b1]',
  retired: 'bg-[#a397b8]',
  experimental: 'bg-[#e4c58d]',
};

interface VaultTabProps extends AriaTabProps {
  itemKey: Key;
  state: ReturnType<typeof useTabListState>;
}

function VaultTab({ itemKey, state, ...props }: VaultTabProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { tabProps, isSelected, isDisabled } = useTab(
    { key: itemKey, ...props },
    state,
    ref,
  );

  return (
    <button
      {...tabProps}
      ref={ref}
      className={[
        'relative shrink-0 rounded-lg px-3 py-2 text-sm font-medium outline-none',
        'transition-colors duration-200 motion-reduce:transition-none',
        'focus-visible:ring-2 focus-visible:ring-[#72b1b1] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#12101a]',
        isSelected
          ? 'bg-[#1a1724] text-[#f0eaff]'
          : 'text-[#a397b8] hover:bg-[#1a1724]/60 hover:text-[#f0eaff]',
        isDisabled ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      {props.children}
      <span
        aria-hidden="true"
        className={[
          'absolute inset-x-3 bottom-0 h-px bg-[#72b1b1]',
          'transition-opacity duration-200 motion-reduce:transition-none',
          isSelected ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
    </button>
  );
}

function MermaidCompanion() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-10 right-0 h-48 w-40 overflow-hidden opacity-40 sm:h-56 sm:w-48"
    >
      <div className="absolute bottom-3 right-[-2rem] h-32 w-32 rounded-full bg-[#72b1b1]/10 blur-3xl" />
      <div className="absolute bottom-5 right-4 h-20 w-16 rounded-[50%_50%_42%_42%] border border-[#72b1b1]/15 bg-[#72b1b1]/[0.025] shadow-[0_0_28px_rgba(114,177,177,0.08)]" />
      <div className="absolute bottom-[5.2rem] right-[2.2rem] h-6 w-9 rounded-[50%_50%_35%_35%] border border-[#72b1b1]/15 bg-[#72b1b1]/[0.025]" />
      <div className="absolute bottom-[6.25rem] right-[2.45rem] h-2 w-2 rounded-full bg-[#72b1b1]/20 blur-[1px]" />
      <div className="absolute bottom-[6.25rem] right-[3.55rem] h-2 w-2 rounded-full bg-[#72b1b1]/20 blur-[1px]" />
      <div className="absolute bottom-[6.5rem] right-[1.8rem] h-10 w-px origin-bottom rotate-[28deg] bg-gradient-to-t from-[#72b1b1]/15 to-transparent" />
      <div className="absolute bottom-[6.5rem] right-[4.5rem] h-10 w-px origin-bottom rotate-[-28deg] bg-gradient-to-t from-[#72b1b1]/15 to-transparent" />
      <div className="absolute bottom-0 right-7 h-12 w-px rotate-[8deg] bg-gradient-to-b from-[#72b1b1]/15 to-transparent" />
      <div className="absolute bottom-0 right-12 h-10 w-px rotate-[-6deg] bg-gradient-to-b from-[#72b1b1]/15 to-transparent" />
      <div className="absolute bottom-0 right-[4.2rem] h-12 w-px rotate-[12deg] bg-gradient-to-b from-[#72b1b1]/15 to-transparent" />
    </div>
  );
}

export default function ProjectWorldsVaultCollection() {
  const [activeTab, setActiveTab] = useState<Key>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const searchState = useSearchFieldState({
    'aria-label': 'Search the vault collection',
    value: searchQuery,
    onChange: setSearchQuery,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);

  const { labelProps, inputProps, clearButtonProps } = useSearchField(
    {
      'aria-label': 'Search the vault collection',
      value: searchQuery,
      onChange: setSearchQuery,
    },
    searchState,
    searchInputRef,
  );

  const { buttonProps: clearProps } = useButton(
    clearButtonProps,
    clearButtonRef,
  );

  const tabState = useTabListState({
    'aria-label': 'Vault categories',
    selectedKey: activeTab,
    onSelectionChange: setActiveTab,
    children: categories.map((category) => (
      <Item key={category} title={category}>
        {category}
      </Item>
    )),
  });

  const tabListRef = useRef<HTMLDivElement>(null);
  const { tabListProps } = useTabList(
    { 'aria-label': 'Vault categories' },
    tabState,
    tabListRef,
  );

  const filteredTools = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    return tools.filter((tool) => {
      const matchesCategory =
        activeTab === 'All' || tool.category === activeTab;

      const matchesQuery =
        normalizedQuery.length === 0 ||
        [tool.name, tool.description, tool.category, tool.status].some(
          (value) => value.toLocaleLowerCase().includes(normalizedQuery),
        );

      return matchesCategory && matchesQuery;
    });
  }, [activeTab, searchQuery]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0810] font-sans text-[#f0eaff]">
      <style>{`
        @keyframes vault-enter {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .vault-results {
          animation: vault-enter 220ms ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <header className="relative z-10 border-b border-[#2a2538] bg-[#0a0810]/95">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#a397b8]">
              Project Worlds
            </p>
            <div className="mt-1 flex items-center gap-2.5">
              <span
                aria-label="Online"
                role="img"
                className="h-2 w-2 rounded-full bg-[#72b1b1] shadow-[0_0_10px_rgba(114,177,177,0.55)]"
              />
              <h1 className="text-base font-semibold tracking-tight text-[#f0eaff] sm:text-lg">
                Good morning, Rylee
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs text-[#a397b8] sm:flex">
            <span className="h-px w-8 bg-[#72b1b1]/60" />
            <span>Vault online</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section aria-labelledby="vault-title" className="w-full">
          <div className="mb-7">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-[#72b1b1]">
              Archive 01
            </p>
            <h2
              id="vault-title"
              className="text-3xl font-semibold tracking-[-0.03em] text-[#f0eaff] sm:text-4xl"
            >
              Vault Collection
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#a397b8]">
              A living index of the systems, languages, and tools shaping each
              world.
            </p>
          </div>

          <div className="rounded-2xl border border-[#2a2538] bg-[#12101a] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-4">
            <div className="relative">
              <label {...labelProps} className="sr-only">
                Search vault
              </label>

              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a397b8]"
              >
                <path
                  d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>

              <input
                {...inputProps}
                ref={searchInputRef}
                placeholder="Search tools, categories, or status…"
                className="h-11 w-full rounded-xl border border-[#2a2538] bg-[#1a1724] py-2 pl-10 pr-11 text-sm text-[#f0eaff] outline-none placeholder:text-[#a397b8]/60 focus:border-[#72b1b1]/70 focus:ring-2 focus:ring-[#72b1b1]/25"
              />

              {searchQuery && (
                <button
                  {...mergeProps(clearButtonProps, clearProps)}
                  ref={clearButtonRef}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#a397b8] outline-none transition-colors hover:bg-[#2a2538] hover:text-[#f0eaff] focus-visible:ring-2 focus-visible:ring-[#72b1b1] motion-reduce:transition-none"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-4 w-4"
                  >
                    <path
                      d="m6 6 8 8m0-8-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div
              {...tabListProps}
              ref={tabListRef}
              className="mt-3 flex gap-1 overflow-x-auto pb-1"
            >
              {[...tabState.collection].map((item) => (
                <VaultTab
                  key={item.key}
                  itemKey={item.key}
                  state={tabState}
                >
                  {item.rendered}
                </VaultTab>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-[#a397b8]">
            <p aria-live="polite">
              {filteredTools.length}{' '}
              {filteredTools.length === 1 ? 'artifact' : 'artifacts'}
            </p>
            <p className="hidden sm:block">Curated systems archive</p>
          </div>

          <div
            key={`${String(activeTab)}-${searchQuery}`}
            className="vault-results mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredTools.map((tool) => (
              <article
                key={tool.name}
                className="group flex min-h-48 flex-col rounded-2xl border border-[#2a2538] bg-[#12101a] p-5 outline-none transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#72b1b1]/35 hover:bg-[#1a1724] focus-within:ring-2 focus-within:ring-[#72b1b1] motion-reduce:transform-none motion-reduce:transition-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClasses[tool.tone]}`}
                  >
                    {tool.category}
                  </span>

                  <span className="flex items-center gap-1.5 text-[11px] capitalize text-[#a397b8]">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${statusClasses[tool.status]}`}
                    />
                    {tool.status}
                  </span>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold tracking-tight text-[#f0eaff]">
                    {tool.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#a397b8]">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-[#2a2538] pt-4 text-[11px] text-[#a397b8]">
                  <span>Last used</span>
                  <time>{tool.lastUsed}</time>
                </div>
              </article>
            ))}

            {filteredTools.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-[#2a2538] bg-[#12101a] px-6 py-14 text-center">
                <p className="text-sm font-medium text-[#f0eaff]">
                  No artifacts found
                </p>
                <p className="mt-2 text-sm text-[#a397b8]">
                  Try a different search or collection.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#2a2538] bg-[#0a0810]/90">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <span className="h-px w-10 bg-[#72b1b1]" />
          <span className="text-xs font-medium tracking-[0.16em] text-[#a397b8]">
            RYLEE
          </span>
        </div>
      </footer>

      <MermaidCompanion />
    </div>
  );
}