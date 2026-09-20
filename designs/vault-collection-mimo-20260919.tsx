import React, { useState, useMemo } from 'react';
import { 
  useSearchField, 
  useTabList, 
  useTab, 
  useTabPanel 
} from 'react-aria';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'Infrastructure' | 'Automation' | 'Security' | 'Data' | 'Observability';
  status: 'active' | 'retired' | 'experimental';
  lastUsed: string;
}

const tools: Tool[] = [
  { id: 'proxmox', name: 'Proxmox', description: 'Open-source server virtualization management platform', category: 'Infrastructure', status: 'active', lastUsed: '2 hours ago' },
  { id: 'traefik', name: 'Traefik', description: 'Cloud-native edge router and reverse proxy', category: 'Infrastructure', status: 'active', lastUsed: '1 hour ago' },
  { id: 'authelia', name: 'Authelia', description: 'Open-source authentication and authorization server', category: 'Security', status: 'active', lastUsed: '3 hours ago' },
  { id: 'docker', name: 'Docker', description: 'Platform for developing, shipping, and running containers', category: 'Infrastructure', status: 'active', lastUsed: '30 minutes ago' },
  { id: 'ansible', name: 'Ansible', description: 'Agentless automation tool for configuration management', category: 'Automation', status: 'active', lastUsed: '4 hours ago' },
  { id: 'git', name: 'Git', description: 'Distributed version control system', category: 'Automation', status: 'active', lastUsed: '5 minutes ago' },
  { id: 'bash', name: 'Bash', description: 'Unix shell and command language', category: 'Automation', status: 'active', lastUsed: '10 minutes ago' },
  { id: 'python', name: 'Python', description: 'High-level programming language for automation and scripting', category: 'Automation', status: 'active', lastUsed: '1 hour ago' },
  { id: 'kubernetes', name: 'Kubernetes', description: 'Container orchestration platform for deployment scaling and management', category: 'Infrastructure', status: 'experimental', lastUsed: '2 days ago' },
  { id: 'sqlite', name: 'SQLite', description: 'Self-contained serverless relational database engine', category: 'Data', status: 'active', lastUsed: '20 minutes ago' },
  { id: 'github-actions', name: 'GitHub Actions', description: 'CI/CD automation platform for GitHub repositories', category: 'Automation', status: 'active', lastUsed: '45 minutes ago' },
];

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'Infrastructure', label: 'Infrastructure' },
  { id: 'Automation', label: 'Automation' },
  { id: 'Security', label: 'Security' },
  { id: 'Data', label: 'Data' },
  { id: 'Observability', label: 'Observability' },
];

const VaultCollection: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const searchFieldProps = {
    label: 'Filter tools',
    placeholder: 'Search vault collection...',
    value: searchQuery,
    onChange: setSearchQuery
  };
  
  const { labelProps, inputProps } = useSearchField(searchFieldProps);
  
  const tabListProps = {
    'aria-label': 'Tool categories',
    selectedKey: activeTab,
    onSelectionChange: setActiveTab
  };
  
  const { tabListProps: tabListContainerProps, tabProps: getTabProps } = useTabList(tabListProps);
  
  const filteredTools = useMemo(() => {
    let result = tools;
    
    if (activeTab !== 'all') {
      result = result.filter(tool => tool.category === activeTab);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(tool => 
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [activeTab, searchQuery]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Infrastructure':
      case 'Automation':
        return 'bg-[#72b1b1]/20 text-[#72b1b1] border-[#72b1b1]/30';
      case 'Security':
        return 'bg-[#b57f8b]/20 text-[#b57f8b] border-[#b57f8b]/30';
      case 'Data':
      case 'Observability':
        return 'bg-[#e4c58d]/20 text-[#e4c58d] border-[#e4c58d]/30';
      default:
        return 'bg-[#72b1b1]/20 text-[#72b1b1] border-[#72b1b1]/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500';
      case 'experimental':
        return 'bg-amber-500';
      case 'retired':
        return 'bg-slate-500';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0810] text-[#f0eaff] flex flex-col relative overflow-hidden">
      {/* Mermaid Companion */}
      <div className="absolute bottom-0 right-0 pointer-events-none opacity-20">
        <svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M180 150C180 150 200 120 190 90C180 60 150 40 130 50C110 60 100 80 80 70C60 60 40 30 20 40C0 50 -10 80 10 100C30 120 60 130 80 120C100 110 120 90 140 100C160 110 170 130 180 150Z" fill="#72b1b1" fillOpacity="0.15"/>
          <path d="M160 140C160 140 180 110 170 80C160 50 130 30 110 40C90 50 80 70 60 60C40 50 20 20 0 30C-20 40 -30 70 -10 90C10 110 40 120 60 110C80 100 100 80 120 90C140 100 150 120 160 140Z" fill="#72b1b1" fillOpacity="0.1"/>
        </svg>
      </div>

      {/* Header */}
      <header className="p-6 border-b border-[#2a2538] bg-[#12101a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <h1 className="text-xl font-medium text-[#f0eaff]">Good morning, Rylee</h1>
          </div>
          <div className="text-[#a397b8] text-sm">Project Worlds</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Search Field */}
        <div className="mb-8">
          <label {...labelProps} className="block text-sm font-medium text-[#a397b8] mb-2">
            Filter Vault Collection
          </label>
          <div className="relative">
            <input
              {...inputProps}
              className="w-full bg-[#1a1724] border border-[#2a2538] rounded-lg py-3 px-4 text-[#f0eaff] placeholder-[#a397b8]/50 focus:outline-none focus:ring-2 focus:ring-[#72b1b1]/50 focus:border-[#72b1b1] transition-all duration-200"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a397b8]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
        </div>

        {/* Tab Bar */}
        <div 
          {...tabListContainerProps} 
          className="flex flex-wrap gap-2 mb-8"
          role="tablist"
        >
          {tabs.map((tab) => {
            const { key, ...tabProps } = getTabProps({ id: tab.id });
            return (
              <button
                key={tab.id}
                {...tabProps}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-[#72b1b1] text-[#0a0810]' 
                    : 'bg-[#1a1724] text-[#a397b8] hover:bg-[#2a2538] hover:text-[#f0eaff]'
                }`}
                aria-selected={activeTab === tab.id}
                role="tab"
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Cards Grid */}
        <div 
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredTools.map((tool) => (
            <div 
              key={tool.id}
              className="bg-[#1a1724] border border-[#2a2538] rounded-xl p-5 hover:border-[#72b1b1]/30 transition-all duration-200 hover:shadow-lg hover:shadow-[#72b1b1]/5"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getCategoryColor(tool.category)}`}>
                  {tool.category}
                </span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(tool.status)}`}></div>
                  <span className="text-xs text-[#a397b8] capitalize">{tool.status}</span>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-[#f0eaff] mb-1">{tool.name}</h3>
              <p className="text-sm text-[#a397b8] mb-3 leading-relaxed">{tool.description}</p>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#a397b8]">Last used: {tool.lastUsed}</span>
              </div>
            </div>
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#a397b8]">No tools found matching your criteria</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-6 border-t border-[#2a2538] bg-[#12101a]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-medium text-[#f0eaff]">Rylee</span>
            <div className="h-1 flex-1 bg-gradient-to-r from-[#72b1b1] to-[#b57f8b] rounded-full"></div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default VaultCollection;