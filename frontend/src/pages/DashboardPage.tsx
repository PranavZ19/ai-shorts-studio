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
  Layers
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
      {/* Top Welcome & Quick Hardware Banner */}
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

      {/* 6 Real Database Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase">Projects</span>
            <FolderKanban className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-black text-white">{s?.total_projects ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Total created</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase">Videos</span>
            <Film className="w-4 h-4 text-accent-purple" />
          </div>
          <div className="text-2xl font-black text-white">{s?.videos_processed ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Source videos</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase">Clips</span>
            <Sparkles className="w-4 h-4 text-accent-amber" />
          </div>
          <div className="text-2xl font-black text-white">{s?.total_clips_generated ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">AI extracted</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-accent-emerald" />
          </div>
          <div className="text-2xl font-black text-white">{s?.approved_clips ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Ready to publish</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase">Ready MP4s</span>
            <Download className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{s?.downloadable_clips ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Download center</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase">Queue</span>
            <Layers className="w-4 h-4 text-accent-rose" />
          </div>
          <div className="text-2xl font-black text-white">{s?.active_queue_count ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Jobs running</div>
        </div>
      </div>

      {/* Hardware & Diagnostics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GPU card */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-brand-400" />
              GPU Acceleration
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              hardware?.gpu.has_nvidia_gpu ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
            }`}>
              {hardware?.gpu.has_nvidia_gpu ? 'CUDA NVENC Ready' : 'CPU Mode'}
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white truncate">
              {hardware?.gpu.name || 'Detecting...'}
            </div>
            <div className="text-xs text-gray-400 flex items-center justify-between">
              <span>Dedicated VRAM:</span>
              <span className="font-mono text-gray-200">
                {hardware?.gpu.vram_total_mb ? `${hardware.gpu.vram_total_mb} MB` : '4096 MB'}
              </span>
            </div>
            <div className="text-xs text-gray-400 flex items-center justify-between">
              <span>Driver Version:</span>
              <span className="font-mono text-gray-200">{hardware?.gpu.driver_version || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* System RAM card */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-accent-purple" />
              System Memory
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {hardware?.ram.percent_used ?? 0}% Used
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">
              {hardware?.ram.available_gb ?? 0} GB Free of {hardware?.ram.total_gb ?? 16} GB
            </div>
            <div className="w-full bg-surface-lighter rounded-full h-2 overflow-hidden">
              <div
                className="bg-accent-purple h-full rounded-full transition-all"
                style={{ width: `${hardware?.ram.percent_used ?? 0}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 flex items-center justify-between pt-1">
              <span>Processor Cores:</span>
              <span className="font-mono text-gray-200">
                {hardware?.cpu.physical_cores ?? 6} Physical / {hardware?.cpu.logical_cores ?? 12} Threads
              </span>
            </div>
          </div>
        </div>

        {/* Dedicated Storage card */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-accent-amber" />
              Studio Storage
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {s?.storage_used_mb ?? 0} MB Used
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white font-mono truncate">
              {s?.storage_root || 'D:\\AI-Shorts-Studio'}
            </div>
            <div className="text-xs text-gray-400">
              Organized storage for sources, clips, temp files, and model weights.
            </div>
            <div className="text-xs text-gray-400 flex items-center justify-between pt-1">
              <span>FFmpeg Status:</span>
              <span className="text-accent-emerald font-semibold">
                {hardware?.ffmpeg.ffmpeg_installed ? 'Installed & Ready' : 'Verifying...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects and Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* Recent Clips */}
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
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-white line-clamp-1">{c.title}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-3">
                      <span>Duration: {Math.round(c.duration)}s</span>
                      <span>•</span>
                      <span className="text-accent-amber font-semibold">Score: {c.overall_score}/100</span>
                      {c.output_path && (
                        <span className="px-1.5 py-0.2 rounded bg-accent-emerald/20 text-accent-emerald text-[10px] font-bold">
                          Rendered MP4
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.output_path && (
                      <a
                        href={`/api/downloads/clip/${c.id}/mp4`}
                        download
                        className="px-2.5 py-1 rounded bg-accent-emerald/20 hover:bg-accent-emerald/30 border border-accent-emerald/30 text-accent-emerald text-xs font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>MP4</span>
                      </a>
                    )}
                    <button
                      onClick={() => onNavigate('clip-editor')}
                      className="px-2.5 py-1 rounded bg-surface border border-surface-border text-xs text-gray-200 hover:text-white"
                    >
                      Edit
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
