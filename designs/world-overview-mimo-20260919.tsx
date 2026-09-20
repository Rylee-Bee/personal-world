// @ts-ignore
// Tailwind CDN reference: <script src="https://cdn.tailwindcss.com"></script>
import { useButton } from 'react-aria';
import { useRef, useState, useEffect } from 'react';

interface Project {
  name: string;
  description: string;
  status: 'Live' | 'Private Alpha' | 'In Progress';
  lastModified: string;
}

interface Activity {
  time: string;
  action: string;
  project: string;
}

const PROJECTS: Project[] = [
  {
    name: 'The Homelab',
    description: 'Proxmox, Traefik, Authelia. DR drills run.',
    status: 'Live',
    lastModified: '2024-08-15'
  },
  {
    name: 'Personal World',
    description: 'Story-first portfolio. Immersive workspace.',
    status: 'Private Alpha',
    lastModified: '2024-08-14'
  },
  {
    name: 'vefr',
    description: 'Worldbuilding engine. Cast, chronicle, map, vault.',
    status: 'In Progress',
    lastModified: '2024-08-12'
  },
  {
    name: 'play-nice-contracts',
    description: '66-contract constitution for humans/agents/tools.',
    status: 'Live',
    lastModified: '2024-08-10'
  }
];

const ACTIVITIES: Activity[] = [
  { time: '2h ago', action: 'Updated security policies', project: 'The Homelab' },
  { time: '1d ago', action: 'Deployed new story section', project: 'Personal World' },
  { time: '2d ago', action: 'Refined character system', project: 'vefr' },
  { time: '3d ago', action: 'Finalized agent protocols', project: 'play-nice-contracts' },
  { time: '5d ago', action: 'Initial DR drill completed', project: 'The Homelab' }
];

export default function ProjectWorlds() {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'Live': return 'bg-[#72b1b1] text-[#0a0810]';
      case 'Private Alpha': return 'bg-[#e4c58d] text-[#0a0810]';
      case 'In Progress': return 'bg-[#b57f8b] text-[#f0eaff]';
    }
  };

  const ProjectCard = ({ project, index }: { project: Project; index: number }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const { buttonProps } = useButton({}, ref);
    const isExpanded = expandedCard === index;
    const isSelected = selectedCard === index;

    const handleHover = (hovering: boolean) => {
      if (!reducedMotion) {
        setExpandedCard(hovering ? index : null);
      }
    };

    const handleClick = () => {
      setSelectedCard(selectedCard === index ? null : index);
      if (reducedMotion) {
        setExpandedCard(expandedCard === index ? null : index);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        ref={ref}
        {...buttonProps}
        className={`relative text-left w-full p-6 bg-[#12101a] border border-[#2a2538] rounded-xl 
                    transition-all duration-300 ease-out transform hover:bg-[#1a1724] 
                    focus:outline-none focus:ring-2 focus:ring-[#72b1b1] focus:ring-offset-2 
                    focus:ring-offset-[#0a0810] ${isSelected ? 'ring-2 ring-[#72b1b1]' : ''}
                    ${reducedMotion ? 'transition-none' : ''}`}
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${project.name} project card. Status: ${project.status}. Press to expand.`}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold text-[#f0eaff]">{project.name}</h3>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
            {project.status}
          </span>
        </div>
        
        <p className="text-[#a397b8] text-sm mb-4">{project.description}</p>
        
        <div className="flex items-center justify-between">
          <span className="text-[#a397b8] text-xs">Modified: {project.lastModified}</span>
          <span className="text-[#72b1b1] text-sm font-medium">Open →</span>
        </div>
        
        {/* Expanded Detail Panel */}
        <div className={`overflow-hidden transition-all duration-300 ease-out
                        ${reducedMotion ? 'transition-none' : ''}
                        ${isExpanded || isSelected ? 'max-h-40 mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="pt-4 border-t border-[#2a2538]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#a397b8]">Last activity: {ACTIVITIES.find(a => a.project === project.name)?.time}</span>
              <div className="flex gap-2">
                <button 
                  className="px-3 py-1 bg-[#1a1724] text-[#72b1b1] rounded text-xs hover:bg-[#2a2538]"
                  aria-label="Configure settings for ${project.name}"
                >
                  Settings
                </button>
                <button 
                  className="px-3 py-1 bg-[#72b1b1] text-[#0a0810] rounded text-xs hover:bg-[#5a9a9a]"
                  aria-label="View details for ${project.name}"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Ambient Glow Effect */}
        <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-[#72b1b1] rounded-full 
                       opacity-5 blur-xl pointer-events-none" 
             aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0810] flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="p-6 border-b border-[#2a2538]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#f0eaff]">Good morning, Rylee</h1>
            <p className="text-[#a397b8] mt-1">Here's your world overview</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#a397b8]">System Status</span>
            <div className="w-3 h-3 bg-[#72b1b1] rounded-full animate-pulse" 
                 aria-label="System online" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-semibold text-[#f0eaff] mb-6">Your World Overview</h2>
          
          {/* Project Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {PROJECTS.map((project, index) => (
              <ProjectCard key={project.name} project={project} index={index} />
            ))}
          </div>

          {/* Activity Timeline */}
          <div className="bg-[#12101a] border border-[#2a2538] rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f0eaff] mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {ACTIVITIES.map((activity, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-[#72b1b1] rounded-full mt-1" />
                    {index < ACTIVITIES.length - 1 && (
                      <div className="w-px h-6 bg-[#2a2538]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[#f0eaff]">{activity.action}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#a397b8]">{activity.time}</span>
                      <span className="text-xs text-[#72b1b1]">•</span>
                      <span className="text-xs text-[#a397b8]">{activity.project}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 border-t border-[#2a2538]">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#f0eaff] font-medium">Rylee</span>
            <span className="text-[#a397b8] text-sm ml-2">World Architect</span>
          </div>
          <div className="h-1 w-24 bg-gradient-to-r from-[#72b1b1] to-transparent rounded-full" />
        </div>
      </footer>

      {/* Mermaid Ambient Glow */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 pointer-events-none" 
           aria-hidden="true">
        <div className="absolute inset-0 bg-[#72b1b1] opacity-[0.03] blur-3xl rounded-full 
                       transform -rotate-45 scale-150" />
        <div className="absolute inset-0 bg-[#72b1b1] opacity-[0.02] blur-3xl rounded-full 
                       transform rotate-12 scale-125 translate-x-12" />
      </div>
    </div>
  );
}