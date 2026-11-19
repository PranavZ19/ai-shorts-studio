import React from 'react';
import {
  FolderKanban,
  Film,
  Sparkles,
  CheckCircle2,
  Download,
  AlertTriangle,
  HardDrive,
  Cpu,
  ArrowUpRight,
  Play,
  Clock,
  Layers,
  Activity,
  Check,
  X,
  FileText
} from 'lucide-react';
import { DashboardStats, HardwareStatus } from '../types';

interface DashboardPageProps {
  stats: DashboardStats | null;
  hardware: HardwareStatus | null;
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ stats, hardware, onNavigate }) => {
  const s = stats?.stats;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Action Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-surface to-surface-lighter border border-surface-border p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-400 border border-brand-500/20">
                100% Free & Local Processing
              </span>
              <span className="text-xs text-gray-400">Zero cloud API subscriptions</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              AI Shorts Studio Dashboard
            </h1>
            <p className="text-sm text-gray-400 max-w-xl">
              Turn long videos into high-retention 9:16 vertical Shorts and Reels with Faster-Whisper, local AI, and FFmpeg NVENC.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigate('new-project')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-95 text-white font-semibold text-sm shadow-lg shadow-brand-500/20 flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Import New Video</span>
            </button>
          </div>
        </div>
      </div>

      {/* 8 Real Database & Storage Statistics Cards (Section 7) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total Source Videos */}
        <div className="bg-surface rounded-xl p-3.5 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Videos</span>
            <Film className="w-3.5 h-3.5 text-accent-purple" />
          </div>
          <div className="text-xl font-black text-white">{s?.total_source_videos ?? s?.videos_processed ?? 0}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Source files</div>
        </div>

        {/* Total AI Candidates */}
        <div className="bg-surface rounded-xl p-3.5 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Candidates</span>
            <Sparkles className="w-3.5 h-3.5 text-accent-amber" />
          </div>
          <div className="text-xl font-black text-white">{s?.total_clips_generated ?? 0}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Moments found</div>
        </div>

        {/* Total Rendered Clips */}
        <div className="bg-surface rounded-xl p-3.5 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Rendered</span>
            <Download className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400">{s?.total_rendered_clips ?? s?.downloadable_clips ?? 0}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Ready MP4s</div>
        </div>

        {/* Approved Clips */}
        <div className="bg-surface rounded-xl p-3.5 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Approved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
          </div>
          <div className="text-xl font-black text-white">{s?.approved_clips ?? 0}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Publish ready</div>
        </div>

        {/* Pending Review */}
        <div className="bg-surface rounded-xl p-3.5 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Pending</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-white">{s?.pending_clips ?? 0}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Awaiting review</div>
        </div>

        {/* Failed Renders */}
        <div className="bg-surface rounded-xl p-3.5 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Failed</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-xl font-black text-red-400">{s?.failed_renders ?? s?.failed_processing_jobs ?? 0}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Render failures</div>
        </div>

        {/* Storage Used */}
        <div className="bg-surface rounded-xl p-3.5 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Storage</span>
            <HardDrive className="w-3.5 h-3.5 text-brand-400" />
          </div>
          <div className="text-xl font-black text-white">
            {s?.storage_used_gb ? `${s.storage_used_gb} GB` : `${s?.storage_used_mb ?? 0} MB`}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Drive D: usage</div>
        </div>

        {/* Downloadable Size */}
        <div className="bg-surface rounded-xl p-3.5 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Video Size</span>
            <Layers className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-black text-sky-400">
            {s?.total_downloadable_video_mb ? `${s.total_downloadable_video_mb} MB` : '0 MB'}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Rendered MP4s</div>
        </div>
      </div>

      {/* Hardware Diagnostics Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GPU card */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                NVIDIA Acceleration
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {hardware?.gpu.cuda_available ? 'CUDA ACTIVE' : 'CPU FALLBACK'}
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">{hardware?.gpu.name || 'RTX 3050 Laptop GPU'}</div>
            <div className="text-xs text-gray-400">
              VRAM: {hardware?.gpu.vram_total_mb || 4096} MB • Driver: {hardware?.gpu.driver_version || 'Ready'}
            </div>
          </div>
        </div>

        {/* CPU & Memory card */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">System Memory</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400">{hardware?.cpu.logical_cores || 12} Threads</span>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">
              {hardware?.ram.used_gb ? `${hardware.ram.used_gb} GB` : '6.4 GB'} / {hardware?.ram.total_gb || 16} GB RAM
            </div>
            <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${hardware?.ram.percent_used || 40}%` }}
              />
            </div>
          </div>
        </div>

        {/* Storage Root card */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-accent-amber" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Studio Storage</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">ISOLATED ON D:</span>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-mono text-white truncate">D:\AI-Shorts-Studio</div>
            <div className="text-xs text-gray-400">
              Media, AI models, SQLite studio.db, and export packages.
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Timeline & Recent Projects / Shorts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Section (Requirement 7) */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-400" />
              Recent Studio Activity
            </h3>
            <span className="text-[10px] font-mono text-gray-500">Live Feed</span>
          </div>

          {stats?.recent_activities && stats.recent_activities.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_activities.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-lg bg-surface-lighter/60 border border-surface-border/60 flex items-start gap-2.5 text-xs"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {act.type === 'upload' && <Film className="w-4 h-4 text-accent-purple" />}
                    {act.type === 'render' && <Check className="w-4 h-4 text-emerald-400" />}
                    {act.type === 'clip_found' && <Sparkles className="w-4 h-4 text-amber-400" />}
                    {act.type === 'error' && <X className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white truncate">{act.action}</span>
                      <span className="text-[10px] text-gray-500 font-mono flex-shrink-0">
                        {act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 truncate">{act.title}</p>
                    <p className="text-[10px] text-gray-500 truncate">{act.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 text-xs">
              <p>No recent activity logged yet.</p>
            </div>
          )}
        </div>

        {/* Recent Projects */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-brand-400" />
              Recent Projects
            </h3>
            <button
              onClick={() => onNavigate('video-library')}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
            >
              <span>View Library</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats?.recent_projects && stats.recent_projects.length > 0 ? (
            <div className="space-y-2.5">
              {stats.recent_projects.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-surface-lighter/60 hover:bg-surface-lighter border border-surface-border flex items-center justify-between transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-white">{p.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-3">
                      <span>{p.video_count} video(s)</span>
                      <span>•</span>
                      <span>{p.clip_count} clips</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('clip-finder')}
                    className="px-2.5 py-1 rounded bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-xs font-medium border border-brand-500/20"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 text-xs space-y-2">
              <p>No projects created yet.</p>
              <button
                onClick={() => onNavigate('new-project')}
                className="text-brand-400 hover:underline font-semibold"
              >
                Create your first project
              </button>
            </div>
          )}
        </div>

        {/* Recent Generated Shorts */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-purple" />
              Recent Generated Shorts
            </h3>
            <button
              onClick={() => onNavigate('generated-shorts')}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
            >
              <span>All Shorts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats?.recent_clips && stats.recent_clips.length > 0 ? (
            <div className="space-y-2.5">
              {stats.recent_clips.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-lg bg-surface-lighter/60 hover:bg-surface-lighter border border-surface-border flex items-center justify-between"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="text-sm font-semibold text-white line-clamp-1">{c.title}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <span>{Math.round(c.duration)}s</span>
                      <span>•</span>
                      <span className="text-accent-amber font-semibold">{c.overall_score}/100</span>
                      {c.has_rendered_video && (
                        <span className="px-1.5 py-0.2 rounded bg-accent-emerald/20 text-accent-emerald text-[10px] font-bold">
                          MP4
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onNavigate('generated-shorts')}
                      className="px-2.5 py-1 rounded bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-xs font-semibold border border-brand-500/20"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 text-xs space-y-2">
              <p>No clips generated yet.</p>
              <p className="text-[11px] text-gray-600">Import a video to begin AI moment detection.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default DashboardPage;
