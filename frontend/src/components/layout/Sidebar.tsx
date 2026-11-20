import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Film,
  Sparkles,
  FileText,
  Sliders,
  PlaySquare,
  Download,
  Share2,
  BarChart3,
  Settings,
  Cpu,
  HardDrive,
  Zap,
  TrendingUp
} from 'lucide-react';
import { HardwareStatus } from '../../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  hardware: HardwareStatus | null;
}

const navItems = [
  { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
  { id: 'creator-strategy', label: 'Creator Strategy', icon: TrendingUp, highlight: true },
  { id: 'new-project', label: 'New Project', icon: PlusCircle },
  { id: 'video-library', label: 'Video Library', icon: Film },
  { id: 'clip-finder', label: 'AI Clip Finder', icon: Sparkles },
  { id: 'transcript', label: 'Transcript', icon: FileText },
  { id: 'clip-editor', label: 'Clip Editor', icon: Sliders },
  { id: 'generated-shorts', label: 'Generated Shorts', icon: PlaySquare },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'publishing', label: 'Publishing Kit', icon: Share2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, hardware }) => {
  return (
    <aside className="w-64 bg-surface flex flex-col border-r border-surface-border select-none h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-purple flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-bold">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
              AI Shorts Studio
            </h1>
            <span className="text-[10px] font-semibold tracking-wider text-brand-400 uppercase">
              100% Free & Local
            </span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-surface-lighter'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.highlight && !isActive && (
                <span className="w-2 h-2 rounded-full bg-accent-purple animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Hardware / Engine Status Footer */}
      <div className="p-3.5 border-t border-surface-border bg-surface/50 text-xs space-y-2">
        <div className="flex items-center justify-between text-gray-400 font-semibold text-[11px] uppercase tracking-wider">
          <span>Engine Status</span>
          <span className="flex items-center space-x-1 text-accent-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
            <span>Active</span>
          </span>
        </div>

        <div className="bg-surface-lighter/80 rounded-lg p-2.5 border border-surface-border space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-brand-400" />
              {hardware?.gpu.has_nvidia_gpu ? 'GPU' : 'CPU'}
            </span>
            <span className="font-mono text-gray-200 truncate max-w-[120px]" title={hardware?.gpu.name || 'CPU Mode'}>
              {hardware?.gpu.has_nvidia_gpu ? 'RTX 3050 (4GB)' : '12 Cores CPU'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400 flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-accent-amber" />
              Storage
            </span>
            <span className="font-mono text-gray-200">
              D:\AI-Shorts-Studio
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
