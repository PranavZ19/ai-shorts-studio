import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Sliders,
  Check,
  X,
  Play,
  Share2,
  HelpCircle,
  Eye,
  Award
} from 'lucide-react';
import { ClipItem } from '../types';
import { api } from '../services/api';

interface ClipFinderPageProps {
  clips: ClipItem[];
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const ClipFinderPage: React.FC<ClipFinderPageProps> = ({ clips, onNavigate, onRefresh }) => {
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(clips[0] || null);

  const handleToggleApproval = async (clipId: string, currentApproved: boolean) => {
    try {
      await api.toggleClipApproval(clipId, !currentApproved);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">AI Clip Finder & Virality Analysis</h2>
          <p className="text-xs text-gray-400">
            Intelligent candidate moments ranked by conversational hook, emotional spike, curiosity, and story completeness.
          </p>
        </div>

        <div className="text-xs text-gray-400 bg-surface px-3 py-1.5 rounded-lg border border-surface-border">
          Total Candidates: <span className="text-white font-bold">{clips.length}</span>
        </div>
      </div>

      {clips.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Clips List */}
          <div className="lg:col-span-2 space-y-3">
            {clips.map((clip, idx) => {
              const isSelected = selectedClip?.id === clip.id;
              return (
                <div
                  key={clip.id}
                  onClick={() => setSelectedClip(clip)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-surface-lighter border-brand-500 shadow-md'
                      : 'bg-surface border-surface-border hover:bg-surface-lighter/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-lighter border border-surface-border flex items-center justify-center font-bold text-xs text-brand-400 shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white leading-snug">{clip.title}</h4>
                        <div className="text-xs text-gray-400 flex items-center gap-3">
                          <span>
                            {Math.floor(clip.start_time / 60)}:{(Math.floor(clip.start_time % 60)).toString().padStart(2, '0')} - {Math.floor(clip.end_time / 60)}:{(Math.floor(clip.end_time % 60)).toString().padStart(2, '0')}
                          </span>
                          <span>•</span>
                          <span>Duration: {Math.round(clip.duration)}s</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 space-y-2">
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold">
                        <Award className="w-3.5 h-3.5" />
                        <span>{clip.overall_score}/100</span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleApproval(clip.id, clip.is_approved);
                          }}
                          className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
                            clip.is_approved
                              ? 'bg-accent-emerald/15 border-accent-emerald text-accent-emerald'
                              : 'bg-surface-border/50 border-surface-border text-gray-400 hover:text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{clip.is_approved ? 'Approved' : 'Approve'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Why selected explanation snippet */}
                  {clip.score_explanation && (
                    <div className="mt-3 text-[11px] text-gray-400 bg-surface/50 p-2.5 rounded-lg border border-surface-border">
                      <span className="font-semibold text-brand-400">Why selected: </span>
                      {clip.score_explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Selected Clip Virality Breakdown */}
          <div className="space-y-4">
            {selectedClip ? (
              <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-5 sticky top-24">
                <div className="flex items-center justify-between border-b border-surface-border pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-accent-amber" />
                    Virality Score Breakdown
                  </h3>
                  <div className="text-sm font-black text-brand-400">
                    {selectedClip.overall_score} / 100
                  </div>
                </div>

                {/* Score Bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Opening Hook Strength (20%)</span>
                      <span className="font-bold text-white">{selectedClip.hook_score || 85}</span>
                    </div>
                    <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                      <div className="bg-brand-500 h-full rounded-full" style={{ width: `${selectedClip.hook_score || 85}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Emotional Impact (15%)</span>
                      <span className="font-bold text-white">{selectedClip.emotional_score || 78}</span>
                    </div>
                    <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                      <div className="bg-accent-purple h-full rounded-full" style={{ width: `${selectedClip.emotional_score || 78}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Curiosity & Intrigue (15%)</span>
                      <span className="font-bold text-white">{selectedClip.curiosity_score || 82}</span>
                    </div>
                    <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                      <div className="bg-accent-amber h-full rounded-full" style={{ width: `${selectedClip.curiosity_score || 82}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Story Completeness (15%)</span>
                      <span className="font-bold text-white">{selectedClip.story_score || 90}</span>
                    </div>
                    <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                      <div className="bg-accent-emerald h-full rounded-full" style={{ width: `${selectedClip.story_score || 90}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Shareability (10%)</span>
                      <span className="font-bold text-white">{selectedClip.shareability_score || 80}</span>
                    </div>
                    <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-400 h-full rounded-full" style={{ width: `${selectedClip.shareability_score || 80}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-surface-border space-y-2">
                  <button
                    onClick={() => onNavigate('clip-editor')}
                    className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Open in Clip Editor</span>
                  </button>

                  <button
                    onClick={() => handleToggleApproval(selectedClip.id, selectedClip.is_approved)}
                    className={`w-full py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      selectedClip.is_approved
                        ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                        : 'bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald hover:bg-accent-emerald/20'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{selectedClip.is_approved ? 'Reject Clip' : 'Approve for Export'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-3">
          <Sparkles className="w-12 h-12 text-brand-400 mx-auto" />
          <div className="text-base font-bold text-white">No Clips Identified Yet</div>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Once a project completes transcription, the local AI analyzer evaluates conversation topics and identifies standalone moments.
          </p>
          <button
            onClick={() => onNavigate('new-project')}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
          >
            Create New Project
          </button>
        </div>
      )}
    </div>
  );
};
