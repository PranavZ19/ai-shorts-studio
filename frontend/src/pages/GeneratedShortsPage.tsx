import React, { useState } from 'react';
import {
  PlaySquare,
  Check,
  X,
  Download,
  Share2,
  Sliders,
  Filter,
  Sparkles,
  Eye,
  Award,
  Copy
} from 'lucide-react';
import { ClipItem } from '../types';
import { api } from '../services/api';

interface GeneratedShortsPageProps {
  clips: ClipItem[];
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const GeneratedShortsPage: React.FC<GeneratedShortsPageProps> = ({ clips, onNavigate, onRefresh }) => {
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);

  const filteredClips = clips.filter((c) => {
    if (filter === 'approved') return c.is_approved;
    if (filter === 'pending') return c.status === 'candidate' && !c.is_approved;
    if (filter === 'rejected') return c.status === 'rejected';
    return true;
  });

  const handleToggle = async (clipId: string, current: boolean) => {
    try {
      await api.toggleClipApproval(clipId, !current);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Generated Shorts Gallery</h2>
          <p className="text-xs text-gray-400">
            Review, edit, and approve finished 9:16 vertical video clips before publishing or downloading.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 bg-surface p-1 rounded-xl border border-surface-border text-xs">
          {(['all', 'approved', 'pending', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all ${
                filter === tab
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filteredClips.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredClips.map((clip) => (
            <div
              key={clip.id}
              className="bg-surface rounded-xl overflow-hidden border border-surface-border shadow-md flex flex-col group transition-all hover:border-brand-500/50"
            >
              {/* 9:16 Card Aspect Ratio */}
              <div className="relative aspect-[9/16] bg-black overflow-hidden flex items-center justify-center">
                {clip.thumbnail_url ? (
                  <img src={clip.thumbnail_url} alt={clip.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center p-4 text-center">
                    <PlaySquare className="w-12 h-12 text-brand-400/60" />
                  </div>
                )}

                {/* Score Pill */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-brand-500/30 text-[11px] font-black text-brand-400 flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  <span>{clip.overall_score}</span>
                </div>

                {/* Duration Badge */}
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                  {Math.round(clip.duration)}s
                </div>

                {/* Approval Overlay Indicator */}
                {clip.is_approved && (
                  <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-accent-emerald text-[10px] font-bold text-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Approved</span>
                  </div>
                )}
              </div>

              {/* Clip Information & Metadata */}
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug" title={clip.title}>
                    {clip.title}
                  </h4>
                  <div className="text-[10px] text-gray-400">
                    {Math.floor(clip.start_time / 60)}:{(Math.floor(clip.start_time % 60)).toString().padStart(2, '0')} - {Math.floor(clip.end_time / 60)}:{(Math.floor(clip.end_time % 60)).toString().padStart(2, '0')}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => handleToggle(clip.id, clip.is_approved)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                      clip.is_approved
                        ? 'bg-accent-emerald/15 text-accent-emerald border border-accent-emerald/30'
                        : 'bg-surface-lighter hover:bg-surface-border text-gray-300'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{clip.is_approved ? 'Approved' : 'Approve'}</span>
                  </button>

                  <button
                    onClick={() => onNavigate('clip-editor')}
                    className="p-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border text-gray-400 hover:text-white"
                    title="Edit in Clip Editor"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>

                  <a
                    href={api.getClipMp4Url(clip.id)}
                    download
                    className="p-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border text-gray-400 hover:text-white"
                    title="Download MP4"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-3">
          <PlaySquare className="w-12 h-12 text-gray-600 mx-auto" />
          <div className="text-base font-bold text-white">No Generated Shorts Found</div>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Once clips are extracted and rendered into vertical 9:16 format, they will appear here with synchronized animated subtitles.
          </p>
        </div>
      )}
    </div>
  );
};
