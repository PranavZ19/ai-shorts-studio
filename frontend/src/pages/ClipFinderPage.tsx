import React, { useState, useEffect } from 'react';
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
  Award,
  Video as VideoIcon,
  Flame,
  Clock,
  ChevronRight,
  RefreshCw,
  Copy,
  Edit2,
  Trash2,
  Zap,
  Target,
  FileText,
  Hash,
  AlertCircle
} from 'lucide-react';
import { ClipItem, SourceVideoItem } from '../types';
import { api } from '../services/api';

interface ClipFinderPageProps {
  clips: ClipItem[];
  selectedVideoId?: string | null;
  onSelectVideo?: (id: string) => void;
  onNavigate: (tab: string) => void;
  onSelectClip?: (id: string) => void;
  onRefresh: () => void;
}

export const ClipFinderPage: React.FC<ClipFinderPageProps> = ({
  clips: initialClips,
  selectedVideoId: initialSelectedVideoId,
  onSelectVideo,
  onNavigate,
  onSelectClip,
  onRefresh
}) => {
  const [videos, setVideos] = useState<SourceVideoItem[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>(initialSelectedVideoId || '');
  const [clips, setClips] = useState<ClipItem[]>(initialClips);
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(initialClips[0] || null);

  // Analysis options
  const [targetDuration, setTargetDuration] = useState<number>(45);
  const [targetCount, setTargetCount] = useState<number>(5);
  const [useHeuristicOnly, setUseHeuristicOnly] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [engineStatus, setEngineStatus] = useState<any>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Inspector Tab
  const [inspectorTab, setInspectorTab] = useState<'scores' | 'titles' | 'descriptions' | 'hashtags' | 'trim'>('scores');

  // Boundary editing state
  const [editStartTime, setEditStartTime] = useState<number>(0);
  const [editEndTime, setEditEndTime] = useState<number>(0);
  const [editTitle, setEditTitle] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  useEffect(() => {
    loadVideosAndEngine();
  }, []);

  useEffect(() => {
    if (initialSelectedVideoId) {
      setSelectedVideoId(initialSelectedVideoId);
    }
  }, [initialSelectedVideoId]);

  useEffect(() => {
    setClips(initialClips);
    if (!selectedClip && initialClips.length > 0) {
      selectClipForDetail(initialClips[0]);
    }
  }, [initialClips]);

  const loadVideosAndEngine = async () => {
    try {
      const vList = await api.getVideos();
      setVideos(vList);
      if (initialSelectedVideoId) {
        setSelectedVideoId(initialSelectedVideoId);
      } else if (vList.length > 0 && !selectedVideoId) {
        setSelectedVideoId(vList[0].id);
      }

      const eng = await api.getClipEngineStatus().catch(() => null);
      setEngineStatus(eng);
    } catch (err) {
      console.error(err);
    }
  };

  const selectClipForDetail = (clip: ClipItem) => {
    setSelectedClip(clip);
    setEditStartTime(clip.start_time);
    setEditEndTime(clip.end_time);
    setEditTitle(clip.title);
  };

  const handleRunAnalysis = async () => {
    if (!selectedVideoId) {
      showToast('Please select a video first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStage('Loading timestamped speech segments...');

    const stageTimer1 = setTimeout(() => {
      setAnalysisStage('Analyzing conversational topics, hooks, and tension...');
    }, 1200);

    const stageTimer2 = setTimeout(() => {
      setAnalysisStage('Evaluating 8-factor virality rubric and snapping speech boundaries...');
    }, 2800);

    try {
      const res = await api.analyzeVideoForClips({
        video_id: selectedVideoId,
        target_count: targetCount,
        target_duration: targetDuration,
        force_heuristic: useHeuristicOnly,
        model_name: 'qwen2.5:3b'
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setAnalysisStage('Finalizing candidates and formatting titles...');

      if (res.clips && res.clips.length > 0) {
        setClips(res.clips);
        selectClipForDetail(res.clips[0]);
        showToast(`Identified ${res.clips.length} high-retention clips via ${res.analysis_mode}!`);
        onRefresh();
      }
    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      showToast(err.message || 'Analysis failed. Ensure video has a transcript.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage('');
    }
  };

  const handleToggleApproval = async (clipId: string, currentApproved: boolean) => {
    try {
      await api.toggleClipApproval(clipId, !currentApproved);
      setClips(prev =>
        prev.map(c => (c.id === clipId ? { ...c, is_approved: !currentApproved, status: !currentApproved ? 'approved' : 'rejected' } : c))
      );
      if (selectedClip?.id === clipId) {
        setSelectedClip(prev => (prev ? { ...prev, is_approved: !currentApproved, status: !currentApproved ? 'approved' : 'rejected' } : null));
      }
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    if (!confirm('Are you sure you want to remove this clip candidate?')) return;
    try {
      await api.deleteClip(clipId);
      const updated = clips.filter(c => c.id !== clipId);
      setClips(updated);
      if (selectedClip?.id === clipId) {
        setSelectedClip(updated[0] || null);
      }
      showToast('Clip candidate removed.');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete clip');
    }
  };

  const handleSaveBoundaryEdits = async () => {
    if (!selectedClip) return;
    if (editEndTime <= editStartTime) {
      showToast('End time must be greater than start time.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await api.updateClip(selectedClip.id, {
        title: editTitle,
        start_time: editStartTime,
        end_time: editEndTime
      });

      if (res.clip) {
        setClips(prev => prev.map(c => (c.id === selectedClip.id ? res.clip : c)));
        setSelectedClip(res.clip);
        showToast('Boundary edits saved successfully.');
        onRefresh();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update clip boundaries');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleApplyTitle = (newTitle: string) => {
    setEditTitle(newTitle);
    if (selectedClip) {
      api.updateClip(selectedClip.id, { title: newTitle }).then(() => {
        setClips(prev => prev.map(c => (c.id === selectedClip.id ? { ...c, title: newTitle } : c)));
        setSelectedClip(prev => (prev ? { ...prev, title: newTitle } : null));
        showToast('Title updated!');
        onRefresh();
      });
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectedVideo = videos.find(v => v.id === selectedVideoId);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-surface-lighter border border-brand-500/40 text-brand-300 text-xs shadow-xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header and Control Panel */}
      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border pb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Flame className="w-5 h-5 text-accent-amber" />
              AI Clip Finder & Virality Analysis
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Select an ingested video and use local AI to identify standalone, high-retention moments optimized for YouTube Shorts and Instagram Reels.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            {engineStatus?.ollama_available ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />
                Ollama Local LLM Active (Qwen2.5 3B)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-amber/10 border border-accent-amber/20 text-accent-amber text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />
                NLP Heuristic Engine Ready
              </span>
            )}
          </div>
        </div>

        {/* Video Selector & Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Video Dropdown */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <VideoIcon className="w-3.5 h-3.5 text-brand-400" />
              Source Video
            </label>
            <select
              value={selectedVideoId}
              onChange={e => setSelectedVideoId(e.target.value)}
              className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              {videos.length === 0 ? (
                <option value="">No ingested videos found</option>
              ) : (
                videos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({Math.round(v.duration)}s)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Target Duration */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent-purple" />
              Target Duration
            </label>
            <select
              value={targetDuration}
              onChange={e => setTargetDuration(Number(e.target.value))}
              className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value={30}>~30 Seconds (Fast Paced)</option>
              <option value={45}>~45 Seconds (Recommended)</option>
              <option value={60}>~60 Seconds (Standard Short)</option>
              <option value={90}>~90 Seconds (Deep Dive)</option>
            </select>
          </div>

          {/* Action Button */}
          <div>
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || videos.length === 0}
              className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                isAnalyzing
                  ? 'bg-brand-500/50 text-white cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-500/20 hover:scale-[1.01]'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-accent-amber" />
                  <span>Find Viral Moments</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Engine mode options */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 pt-2 border-t border-surface-border/60">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useHeuristicOnly}
                onChange={e => setUseHeuristicOnly(e.target.checked)}
                className="rounded border-surface-border bg-surface-lighter text-brand-500 focus:ring-0"
              />
              <span>Force Instant Rule-Based Heuristics (Bypass LLM)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span>Clips to extract:</span>
            {[3, 5, 8].map(count => (
              <button
                key={count}
                onClick={() => setTargetCount(count)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                  targetCount === count
                    ? 'bg-brand-500/20 border-brand-500 text-brand-300'
                    : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
                }`}
              >
                {count} clips
              </button>
            ))}
          </div>
        </div>

        {/* Real-time Progress Bar */}
        {isAnalyzing && (
          <div className="p-3.5 rounded-lg bg-surface-lighter/80 border border-brand-500/30 space-y-2 animate-pulse">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-brand-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent-amber" />
                {analysisStage}
              </span>
              <span className="text-gray-400">Processing locally</span>
            </div>
            <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-brand-500 via-accent-purple to-accent-emerald h-full rounded-full animate-progress" />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      {clips.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Candidate Moments Cards */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <span>Candidate Clips ({clips.length})</span>
              <span>Sorted by Virality Potential</span>
            </div>

            {clips.map((clip, idx) => {
              const isSelected = selectedClip?.id === clip.id;
              const aiMeta = clip.ai_metadata || {};

              return (
                <div
                  key={clip.id}
                  onClick={() => selectClipForDetail(clip)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-surface-lighter border-brand-500 shadow-md ring-1 ring-brand-500/30'
                      : 'bg-surface border-surface-border hover:bg-surface-lighter/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start space-x-3.5">
                      <div className="w-9 h-9 rounded-xl bg-surface border border-surface-border flex flex-col items-center justify-center font-black text-xs text-brand-400 shrink-0">
                        <span>#{idx + 1}</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white leading-snug">{clip.title}</h4>
                          {clip.main_topic && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent-purple/15 text-accent-purple border border-accent-purple/30">
                              {clip.main_topic}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-400 flex items-center gap-3">
                          <span className="font-mono text-gray-300">
                            {formatTime(clip.start_time)} - {formatTime(clip.end_time)}
                          </span>
                          <span>•</span>
                          <span className="text-brand-300 font-semibold">{Math.round(clip.duration)}s</span>
                          <span>•</span>
                          <span className="text-gray-400 text-[11px]">
                            {clip.analysis_mode?.startsWith('ollama') ? 'Local AI' : 'NLP Heuristic'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 space-y-2">
                      <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-black">
                        <Flame className="w-3.5 h-3.5 text-accent-amber" />
                        <span>{clip.overall_score} / 100</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleApproval(clip.id, clip.is_approved);
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
                            clip.is_approved
                              ? 'bg-accent-emerald/20 border-accent-emerald text-accent-emerald'
                              : 'bg-surface-border/40 border-surface-border text-gray-400 hover:text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{clip.is_approved ? 'Approved' : 'Approve'}</span>
                        </button>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteClip(clip.id);
                          }}
                          className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove clip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Hook preview summary */}
                  {clip.hook_summary && (
                    <div className="mt-3 text-xs text-gray-300 bg-surface/70 p-2.5 rounded-lg border border-surface-border/70 flex items-start gap-2">
                      <Target className="w-3.5 h-3.5 text-accent-amber shrink-0 mt-0.5" />
                      <div>
                        <span className="text-brand-400 font-semibold">Opening Hook: </span>
                        <span>"{clip.hook_summary}"</span>
                      </div>
                    </div>
                  )}

                  {/* Why selected explanation snippet */}
                  {clip.score_explanation && (
                    <div className="mt-2 text-[11px] text-gray-400 pl-1">
                      <span className="font-semibold text-gray-300">Rationale: </span>
                      {clip.score_explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Col: Deep Virality Inspector & Boundary Tuner */}
          <div className="space-y-4">
            {selectedClip ? (
              <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-5 sticky top-24">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-border pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-accent-amber" />
                      Virality Intelligence
                    </h3>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {selectedClip.main_topic || 'Moment Analysis'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-brand-400">
                      {selectedClip.overall_score} / 100
                    </div>
                    <div className="text-[10px] text-gray-400">Composite Score</div>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex rounded-lg bg-surface-lighter p-1 border border-surface-border text-xs">
                  <button
                    onClick={() => setInspectorTab('scores')}
                    className={`flex-1 py-1 rounded font-semibold transition-all ${
                      inspectorTab === 'scores' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Scores
                  </button>
                  <button
                    onClick={() => setInspectorTab('titles')}
                    className={`flex-1 py-1 rounded font-semibold transition-all ${
                      inspectorTab === 'titles' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Titles
                  </button>
                  <button
                    onClick={() => setInspectorTab('descriptions')}
                    className={`flex-1 py-1 rounded font-semibold transition-all ${
                      inspectorTab === 'descriptions' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    SEO
                  </button>
                  <button
                    onClick={() => setInspectorTab('trim')}
                    className={`flex-1 py-1 rounded font-semibold transition-all ${
                      inspectorTab === 'trim' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Trim
                  </button>
                </div>

                {/* Tab: 8-Factor Scores */}
                {inspectorTab === 'scores' && (
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
                        <span className="font-bold text-white">{selectedClip.story_score || 88}</span>
                      </div>
                      <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                        <div className="bg-accent-emerald h-full rounded-full" style={{ width: `${selectedClip.story_score || 88}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Information Value (10%)</span>
                        <span className="font-bold text-white">{selectedClip.information_score || 75}</span>
                      </div>
                      <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-400 h-full rounded-full" style={{ width: `${selectedClip.information_score || 75}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Audience Clarity (10%)</span>
                        <span className="font-bold text-white">{selectedClip.clarity_score || 85}</span>
                      </div>
                      <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                        <div className="bg-teal-400 h-full rounded-full" style={{ width: `${selectedClip.clarity_score || 85}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Shareability (10%)</span>
                        <span className="font-bold text-white">{selectedClip.shareability_score || 80}</span>
                      </div>
                      <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${selectedClip.shareability_score || 80}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Ending Closure (5%)</span>
                        <span className="font-bold text-white">{selectedClip.ending_score || 80}</span>
                      </div>
                      <div className="w-full bg-surface-lighter rounded-full h-1.5 overflow-hidden">
                        <div className="bg-rose-400 h-full rounded-full" style={{ width: `${selectedClip.ending_score || 80}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Generated Titles */}
                {inspectorTab === 'titles' && (
                  <div className="space-y-2.5">
                    <div className="text-xs text-gray-400 flex items-center justify-between">
                      <span>Click to set as active title:</span>
                    </div>

                    {(selectedClip.ai_metadata?.titles || [selectedClip.title]).map((t, i) => (
                      <div
                        key={i}
                        onClick={() => handleApplyTitle(t)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                          selectedClip.title === t
                            ? 'bg-brand-500/15 border-brand-500 text-white font-bold'
                            : 'bg-surface-lighter border-surface-border text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-brand-400 font-black shrink-0">{i + 1}.</span>
                          <span>{t}</span>
                        </div>
                        {selectedClip.title === t && <Check className="w-3.5 h-3.5 text-accent-emerald shrink-0 mt-0.5" />}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: SEO Descriptions & Hashtags */}
                {inspectorTab === 'descriptions' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-gray-400 font-semibold block mb-1">Short Description:</span>
                      <div className="p-2.5 rounded-lg bg-surface-lighter border border-surface-border text-gray-300 relative group">
                        <p>{selectedClip.ai_metadata?.descriptions?.[0] || 'No description generated yet.'}</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedClip.ai_metadata?.descriptions?.[0] || '');
                            showToast('Copied description to clipboard!');
                          }}
                          className="mt-2 text-[11px] text-brand-400 flex items-center gap-1 hover:underline"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy description</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-400 font-semibold block mb-1">Viral Hashtags:</span>
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-surface-lighter border border-surface-border">
                        {(selectedClip.ai_metadata?.hashtags || ['#Shorts', '#Reels', '#Viral']).map((h, i) => (
                          <span
                            key={i}
                            onClick={() => {
                              navigator.clipboard.writeText(h);
                              showToast(`Copied ${h}`);
                            }}
                            className="px-2 py-0.5 rounded bg-surface border border-surface-border text-brand-300 text-[11px] font-mono cursor-pointer hover:border-brand-500"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedClip.target_audience && (
                      <div>
                        <span className="text-gray-400 font-semibold block mb-1">Target Audience:</span>
                        <div className="text-gray-300 text-[11px] italic">
                          {selectedClip.target_audience}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Trim Timestamps */}
                {inspectorTab === 'trim' && (
                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-gray-400 font-semibold">Title</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full bg-surface-lighter border border-surface-border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-gray-400 font-semibold">Start Time (sec)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editStartTime}
                          onChange={e => setEditStartTime(parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-lighter border border-surface-border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                        />
                        <div className="text-[10px] text-gray-500">{formatTime(editStartTime)}</div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-gray-400 font-semibold">End Time (sec)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editEndTime}
                          onChange={e => setEditEndTime(parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-lighter border border-surface-border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                        />
                        <div className="text-[10px] text-gray-500">{formatTime(editEndTime)}</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-brand-300 font-semibold">
                      New Duration: {Math.max(0, Math.round(editEndTime - editStartTime))}s
                    </div>

                    <button
                      onClick={handleSaveBoundaryEdits}
                      disabled={isSavingEdit}
                      className="w-full py-2 rounded-lg bg-surface-lighter hover:bg-surface-border border border-brand-500/50 text-brand-300 font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSavingEdit ? 'Saving...' : 'Apply Boundary Edits'}</span>
                    </button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 border-t border-surface-border space-y-2">
                  <button
                    onClick={() => {
                      if (onSelectClip && selectedClip) onSelectClip(selectedClip.id);
                      onNavigate('clip-editor');
                    }}
                    className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Open in Clip Editor (Phase 5)</span>
                  </button>

                  <button
                    onClick={() => handleToggleApproval(selectedClip.id, selectedClip.is_approved)}
                    className={`w-full py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
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
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto text-brand-400">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-bold text-white">No Clips Identified Yet</div>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
              Select an ingested video above and click <span className="text-brand-300 font-semibold">"Find Viral Moments"</span> to analyze the conversation and identify self-contained short clips.
            </p>
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || videos.length === 0}
            className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-500/20 inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-accent-amber" />
            <span>Analyze Selected Video</span>
          </button>
        </div>
      )}
    </div>
  );
};
