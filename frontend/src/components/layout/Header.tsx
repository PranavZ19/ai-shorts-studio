import React from 'react';
import { PlusCircle, HardDrive, RefreshCw, Sparkles, FolderKanban } from 'lucide-react';
import { ProjectItem } from '../../types';

interface HeaderProps {
  currentTab: string;
  onNewProject: () => void;
  projects: ProjectItem[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNewProject,
  projects,
  selectedProjectId,
  onSelectProject,
  onRefresh,
  loading
}) => {
  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Overview Dashboard';
      case 'new-project': return 'Create New Project';
      case 'video-library': return 'Video Library';
      case 'clip-finder': return 'AI Clip Finder';
      case 'transcript': return 'Interactive Transcript';
      case 'clip-editor': return 'Professional Clip Editor';
      case 'generated-shorts': return 'Generated Shorts Gallery';
      case 'downloads': return 'Download Center';
      case 'publishing': return 'Social Publishing';
      case 'analytics': return 'Performance & Analytics';
      case 'settings': return 'Studio Settings & Hardware';
      default: return 'AI Shorts Studio';
    }
  };

  return (
    <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-surface-border px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center space-x-4">
        <h2 className="text-lg font-bold text-white tracking-tight">{getTabTitle(currentTab)}</h2>
        
        {/* Project Selector */}
        {projects.length > 0 && (
          <div className="flex items-center space-x-2 bg-surface-lighter px-3 py-1.5 rounded-lg border border-surface-border text-xs">
            <FolderKanban className="w-3.5 h-3.5 text-brand-400" />
            <select
              value={selectedProjectId || ''}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-transparent text-gray-200 outline-none cursor-pointer text-xs font-medium"
            >
              <option value="" className="bg-surface text-gray-400">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface text-gray-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title="Refresh Data"
          className="p-2 rounded-lg bg-surface-lighter hover:bg-surface-border border border-surface-border text-gray-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
        </button>

        {/* Quick New Project CTA */}
        <button
          onClick={onNewProject}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-accent-purple hover:from-brand-500 hover:to-accent-purple/90 text-white text-xs font-semibold shadow-md shadow-brand-500/25 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Video</span>
        </button>
      </div>
    </header>
  );
};
