import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  ThumbsUp,
  MessageSquare,
  Sparkles,
  PieChart,
  HardDrive
} from 'lucide-react';
import { DashboardStats } from '../types';

interface AnalyticsPageProps {
  stats: DashboardStats | null;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ stats }) => {
  const s = stats?.stats;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Performance & AI Model Analytics</h2>
        <p className="text-xs text-gray-400">
          Database-backed metrics on your video library, AI clip detection accuracy, and rendering throughput.
        </p>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-surface-border">
          <div className="text-xs text-gray-400 font-semibold uppercase">Total Clips Extracted</div>
          <div className="text-2xl font-black text-white mt-1">{s?.total_clips_generated ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">From {s?.videos_processed ?? 0} source video(s)</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border">
          <div className="text-xs text-gray-400 font-semibold uppercase">Approval Rate</div>
          <div className="text-2xl font-black text-accent-emerald mt-1">
            {s?.total_clips_generated ? Math.round((s.approved_clips / s.total_clips_generated) * 100) : 0}%
          </div>
          <div className="text-[11px] text-gray-500 mt-1">{s?.approved_clips ?? 0} approved clips</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border">
          <div className="text-xs text-gray-400 font-semibold uppercase">Exported MP4 Packages</div>
          <div className="text-2xl font-black text-brand-400 mt-1">{s?.downloadable_clips ?? 0}</div>
          <div className="text-[11px] text-gray-500 mt-1">Available for download</div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border">
          <div className="text-xs text-gray-400 font-semibold uppercase">Storage Consumed</div>
          <div className="text-2xl font-black text-accent-amber mt-1">{s?.storage_used_mb ?? 0} MB</div>
          <div className="text-[11px] text-gray-500 mt-1">On D:\AI-Shorts-Studio</div>
        </div>
      </div>

      {/* Topic & Hook Analysis Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-400" />
            Top Engagement Scoring Factors
          </h3>
          <p className="text-xs text-gray-400">
            Every candidate clip is scored across 8 weighted engagement criteria to find natural beginning hooks and complete narrative conclusions:
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-surface-border">
              <span className="text-gray-300">Opening Hook Strength</span>
              <span className="font-bold text-brand-400">20% weight</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-border">
              <span className="text-gray-300">Emotional Impact & Surprise</span>
              <span className="font-bold text-accent-purple">15% weight</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-border">
              <span className="text-gray-300">Curiosity & Intrigue</span>
              <span className="font-bold text-accent-amber">15% weight</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-border">
              <span className="text-gray-300">Story & Thought Completeness</span>
              <span className="font-bold text-accent-emerald">15% weight</span>
            </div>
            <div className="flex justify-between py-1 border-b border-surface-border">
              <span className="text-gray-300">Audience Relevance & Value</span>
              <span className="font-bold text-blue-400">20% weight</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-300">Shareability & Production Quality</span>
              <span className="font-bold text-gray-400">15% weight</span>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-emerald" />
            Optimal Retention Duration
          </h3>
          <p className="text-xs text-gray-400">
            For modern algorithmic feeds, 30–60 second clips maximize viewer retention and repeat playback loops.
          </p>
          <div className="bg-surface-lighter/50 rounded-lg p-3 text-xs text-gray-300 space-y-1.5 border border-surface-border">
            <div className="font-semibold text-white">Algorithm Recommendation:</div>
            <p>
              Aim for a target duration of <strong>45–60 seconds</strong>. Always prioritize clips where a speaker finishes a complete idea over arbitrary time cuts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
