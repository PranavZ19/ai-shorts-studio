import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Share2,
  Video,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Sliders,
  Play,
  Pause,
  ExternalLink,
  ArrowRight,
  Tag,
  Hash,
  FileText,
  FileCode,
  Archive,
  MessageSquare,
  Music,
  Eye,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowLeft,
  Trash2,
  Edit3,
  Award,
  Film,
  Search,
  Globe,
  SlidersHorizontal,
  BookmarkCheck
} from 'lucide-react';
import { api } from '../services/api';
import {
  PublishingKitDetail,
  PublishingKitListItem,
  ClipItem,
  ProjectItem,
  TitleVariation,
  CaptionVariation
} from '../types';

interface PublishingPageProps {
  onNavigate: (tab: string) => void;
  selectedClipId?: string | null;
  onSelectClip?: (id: string) => void;
  clips?: ClipItem[];
  projects?: ProjectItem[];
}

export const PublishingPage: React.FC<PublishingPageProps> = ({
  onNavigate,
  selectedClipId,
  onSelectClip,
  clips = [],
  projects = []
}) => {
  // Navigation & View Mode
  const [viewMode, setViewMode] = useState<'editor' | 'library'>('library');
  const [activePlatformTab, setActivePlatformTab] = useState<'youtube' | 'instagram' | 'brand'>('youtube');

  // Kit list and active kit
  const [kits, setKits] = useState<PublishingKitListItem[]>([]);
  const [activeKit, setActiveKit] = useState<PublishingKitDetail | null>(null);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);

  // Loading & status states
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter in library
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Copy feedback state: map of fieldName -> boolean
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  // Published Modal state
  const [showPublishedModal, setShowPublishedModal] = useState<boolean>(false);
  const [publishedUrlInput, setPublishedUrlInput] = useState<string>('');

  // Video preview player state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Transcript expand/collapse
  const [showTranscriptExcerpt, setShowTranscriptExcerpt] = useState<boolean>(false);

  // Load kits list on mount
  useEffect(() => {
    loadKitsList();
  }, []);

  // When selectedClipId prop changes, automatically find or open its kit
  useEffect(() => {
    if (selectedClipId) {
      handleOpenClipKit(selectedClipId);
    }
  }, [selectedClipId]);

  const loadKitsList = async () => {
    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const data = await api.getPublishingKits();
      setKits(data);
    } catch (err: any) {
      console.error('Failed to load publishing kits:', err);
      setErrorMessage(err.message || 'Failed to load publishing kits');
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadKitDetail = async (kitId: string) => {
    setIsLoadingDetail(true);
    setErrorMessage(null);
    try {
      const detail = await api.getPublishingKit(kitId);
      setActiveKit(detail);
      setSelectedKitId(kitId);
      setViewMode('editor');
    } catch (err: any) {
      console.error('Failed to load kit detail:', err);
      setErrorMessage(err.message || 'Failed to load publishing kit details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenClipKit = async (clipId: string) => {
    setIsLoadingDetail(true);
    setErrorMessage(null);
    try {
      const existing = await api.getPublishingKitByClip(clipId);
      if (existing) {
        setActiveKit(existing);
        setSelectedKitId(existing.id);
        setViewMode('editor');
      } else {
        // Kit doesn't exist yet for this clip, prompt or generate
        setSelectedKitId(null);
        setActiveKit(null);
        setViewMode('editor');
      }
    } catch (err: any) {
      console.error('Error fetching kit by clip:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleGenerateKit = async (clipId: string) => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const newKit = await api.generatePublishingKit(clipId);
      setActiveKit(newKit);
      setSelectedKitId(newKit.id);
      setViewMode('editor');
      loadKitsList();
    } catch (err: any) {
      console.error('Failed to generate publishing kit:', err);
      setErrorMessage(err.message || 'Failed to generate publishing kit');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegeneratePart = async (platform: 'youtube' | 'instagram' | 'both', fieldName?: string) => {
    if (!activeKit) return;
    setIsRegenerating(true);
    setErrorMessage(null);
    try {
      const updated = await api.regeneratePublishingKit(activeKit.id, platform, fieldName);
      setActiveKit(updated);
      triggerCopied(`regen-${platform}`);
    } catch (err: any) {
      console.error('Failed to regenerate content:', err);
      setErrorMessage(err.message || 'Failed to regenerate platform content');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!activeKit) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    try {
      const payload = {
        yt_primary_title_index: activeKit.youtube.primary_title_index,
        yt_titles_json: JSON.stringify(activeKit.youtube.titles),
        yt_description_short: activeKit.youtube.description_short,
        yt_description_alt: activeKit.youtube.description_alt,
        yt_description_seo: activeKit.youtube.description_seo,
        yt_selected_description: activeKit.youtube.selected_description,
        yt_hashtags_json: JSON.stringify(activeKit.youtube.hashtags),
        yt_tags_csv: activeKit.youtube.tags_csv,
        yt_pinned_comment: activeKit.youtube.pinned_comment,
        yt_cta: activeKit.youtube.cta,
        ig_selected_caption_index: activeKit.instagram.selected_caption_index,
        ig_captions_json: JSON.stringify(activeKit.instagram.captions),
        ig_hashtags_json: JSON.stringify(activeKit.instagram.hashtags),
        ig_first_line_hook: activeKit.instagram.first_line_hook,
        ig_cta: activeKit.instagram.cta,
        ig_audio_direction: activeKit.instagram.audio_direction,
        status: activeKit.status
      };
      const updated = await api.updatePublishingKit(activeKit.id, payload);
      setActiveKit(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      loadKitsList();
    } catch (err: any) {
      console.error('Failed to save changes:', err);
      setErrorMessage(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkReady = async () => {
    if (!activeKit) return;
    try {
      await api.markPublishingKitReady(activeKit.id);
      setActiveKit({ ...activeKit, status: 'ready' });
      loadKitsList();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to mark kit as ready');
    }
  };

  const handleMarkPublished = async () => {
    if (!activeKit) return;
    try {
      await api.markPublishingKitPublished(activeKit.id, publishedUrlInput || undefined);
      setActiveKit({ ...activeKit, status: 'published', published_url: publishedUrlInput || undefined });
      setShowPublishedModal(false);
      setPublishedUrlInput('');
      loadKitsList();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to mark as published');
    }
  };

  const handleDeleteKit = async (kitId: string) => {
    if (!window.confirm('Delete this publishing kit? (Your video files and clips will not be deleted)')) return;
    try {
      await api.deletePublishingKit(kitId);
      if (activeKit?.id === kitId) {
        setActiveKit(null);
        setSelectedKitId(null);
        setViewMode('library');
      }
      loadKitsList();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete publishing kit');
    }
  };

  // Helper for copy to clipboard
  const copyToClipboard = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      triggerCopied(key);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  const triggerCopied = (key: string) => {
    setCopiedStates((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  // Build composite copy text for YouTube
  const getFullYouTubeCopyText = (kit: PublishingKitDetail) => {
    const primaryTitle =
      kit.youtube.titles[kit.youtube.primary_title_index]?.title || 'Short Title';
    const descKey = kit.youtube.selected_description;
    const descText =
      descKey === 'seo'
        ? kit.youtube.description_seo
        : descKey === 'alt'
        ? kit.youtube.description_alt
        : kit.youtube.description_short;

    const hashtags = [
      ...(kit.youtube.hashtags.broad || []),
      ...(kit.youtube.hashtags.specific || []),
      ...(kit.youtube.hashtags.audience || [])
    ]
      .map((h) => (h.startsWith('#') ? h : `#${h}`))
      .join(' ');

    return `=== TITLE ===\n${primaryTitle}\n\n=== DESCRIPTION ===\n${descText}\n\n${hashtags}\n\n=== TAGS ===\n${kit.youtube.tags_csv}\n\n=== PINNED COMMENT ===\n${kit.youtube.pinned_comment || ''}`;
  };

  // Build composite copy text for Instagram
  const getFullInstagramCopyText = (kit: PublishingKitDetail) => {
    const caption =
      kit.instagram.captions[kit.instagram.selected_caption_index]?.text || '';
    const hashtags = [
      ...(kit.instagram.hashtags.niche || []),
      ...(kit.instagram.hashtags.topic || []),
      ...(kit.instagram.hashtags.community || [])
    ]
      .map((h) => (h.startsWith('#') ? h : `#${h}`))
      .join(' ');

    return `=== FIRST-LINE HOOK ===\n${kit.instagram.first_line_hook || ''}\n\n=== CAPTION ===\n${caption}\n\n.\n.\n.\n${hashtags}\n\n=== AUDIO DIRECTION ===\n${kit.instagram.audio_direction || ''}`;
  };

  // Build composite copy text for Both
  const getBothPlatformsCopyText = (kit: PublishingKitDetail) => {
    return `############################################\n# YOUTUBE SHORTS PUBLISHING KIT\n############################################\n\n${getFullYouTubeCopyText(kit)}\n\n\n############################################\n# INSTAGRAM REELS PUBLISHING KIT\n############################################\n\n${getFullInstagramCopyText(kit)}`;
  };

  // Filtered kits in library
  const filteredKits = useMemo(() => {
    return kits.filter((k) => {
      if (statusFilter !== 'all' && k.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          k.primary_title.toLowerCase().includes(q) ||
          (k.clip_title && k.clip_title.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [kits, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ======================================================== */}
      {/* HEADER BAR */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-purple text-white shadow-md">
              <Share2 className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              AI Publishing Kit
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              YouTube Shorts & Instagram Reels
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Generate platform-native SEO titles, descriptions, hashtags, tags, hooks, and download multi-format publishing packages. 100% manual copy-paste: zero OAuth, zero API lock-in.
          </p>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex items-center space-x-2">
          {viewMode === 'editor' && (
            <button
              onClick={() => setViewMode('library')}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-lighter border border-surface-border text-xs font-semibold text-gray-300 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Library ({kits.length})</span>
            </button>
          )}

          {viewMode === 'library' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (clips.length > 0) {
                    onSelectClip?.(clips[0].id);
                    handleOpenClipKit(clips[0].id);
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Kit Workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-gray-400 hover:text-white text-xs font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 1: KITS LIBRARY / OVERVIEW */}
      {/* ======================================================== */}
      {viewMode === 'library' && (
        <div className="space-y-4">
          {/* Controls Bar: Filters & Search */}
          <div className="bg-surface rounded-xl p-4 border border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center space-x-1.5 bg-background p-1 rounded-lg border border-surface-border text-xs">
              {(['all', 'draft', 'ready', 'published'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-md font-semibold capitalize transition-all ${
                    statusFilter === tab
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search publishing kits by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-background border border-surface-border rounded-lg text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Kits Grid */}
          {isLoadingList ? (
            <div className="py-16 text-center text-xs text-gray-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-400 mx-auto" />
              <p>Loading publishing kits...</p>
            </div>
          ) : filteredKits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKits.map((kit) => (
                <div
                  key={kit.id}
                  className="bg-surface rounded-xl border border-surface-border hover:border-brand-500/50 transition-all p-4 space-y-3 flex flex-col justify-between group shadow-sm"
                >
                  <div className="space-y-3">
                    {/* Header: Status and Duration */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          kit.status === 'published'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : kit.status === 'ready'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30'
                        }`}
                      >
                        {kit.status}
                      </span>
                      <span className="text-[11px] font-mono text-gray-400">
                        {Math.round(kit.duration)}s • 9:16 Short
                      </span>
                    </div>

                    {/* Primary Title */}
                    <div className="space-y-1">
                      <h3
                        onClick={() => loadKitDetail(kit.id)}
                        className="font-bold text-white text-sm line-clamp-2 cursor-pointer group-hover:text-brand-300 transition-colors"
                      >
                        {kit.primary_title}
                      </h3>
                      {kit.clip_title && (
                        <p className="text-[11px] text-gray-400 line-clamp-1">
                          Clip: {kit.clip_title}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Export Footer */}
                  <div className="space-y-2 pt-3 border-t border-surface-border/60">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => loadKitDetail(kit.id)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-brand-600/20 hover:bg-brand-600 text-brand-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Kit</span>
                      </button>

                      <a
                        href={api.getPublishingKitExportUrl(kit.id, 'zip')}
                        download
                        className="py-1.5 px-2.5 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1"
                        title="Download Complete Publishing ZIP"
                      >
                        <Archive className="w-3.5 h-3.5 text-accent-amber" />
                        <span>ZIP</span>
                      </a>

                      <button
                        onClick={() => handleDeleteKit(kit.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                        title="Delete Kit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {kit.published_url && (
                      <a
                        href={kit.published_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-brand-400 hover:underline flex items-center gap-1 truncate pt-0.5"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{kit.published_url}</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-4">
              <Share2 className="w-12 h-12 text-gray-600 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No Publishing Kits Found</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No publishing kits matched your active filter or search query.'
                    : 'Generate a Publishing Kit for any of your approved vertical shorts to create viral titles, SEO tags, descriptions, and download ready-to-publish assets.'}
                </p>
              </div>

              {clips.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onSelectClip?.(clips[0].id);
                      handleOpenClipKit(clips[0].id);
                    }}
                    className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create Kit for "{clips[0].title.slice(0, 30)}..."</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW MODE 2: ACTIVE PUBLISHING KIT WORKSPACE (DUAL PANE) */}
      {/* ======================================================== */}
      {viewMode === 'editor' && (
        <div className="space-y-5">
          {/* Top Kit Selector Bar & Quick Stats */}
          <div className="bg-surface rounded-xl p-4 border border-surface-border flex flex-wrap items-center justify-between gap-3">
            {/* Clip Switcher */}
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-gray-400">Target Clip:</span>
              <select
                value={activeKit?.clip_id || selectedClipId || ''}
                onChange={(e) => {
                  const targetClipId = e.target.value;
                  if (targetClipId) {
                    onSelectClip?.(targetClipId);
                    handleOpenClipKit(targetClipId);
                  }
                }}
                className="bg-background border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white font-medium outline-none focus:border-brand-500 max-w-xs sm:max-w-md truncate"
              >
                {clips.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({Math.round(c.duration)}s)
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Actions & Status */}
            {activeKit && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Pill */}
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                    activeKit.status === 'published'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : activeKit.status === 'ready'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30'
                  }`}
                >
                  Status: {activeKit.status}
                </span>

                {/* Mark Ready Button */}
                {activeKit.status === 'draft' && (
                  <button
                    onClick={handleMarkReady}
                    className="px-3 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white text-xs font-semibold border border-sky-500/30 transition-colors"
                  >
                    Mark as Ready
                  </button>
                )}

                {/* Mark Published Button */}
                {activeKit.status !== 'published' && (
                  <button
                    onClick={() => setShowPublishedModal(true)}
                    className="px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-semibold border border-emerald-500/30 transition-colors"
                  >
                    Mark as Published
                  </button>
                )}

                {/* Save Changes Button */}
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-3.5 h-3.5 text-accent-emerald" />
                  ) : (
                    <BookmarkCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{saveSuccess ? 'Saved!' : 'Save Edits'}</span>
                </button>
              </div>
            )}
          </div>

          {/* If No Kit Exists for Selected Clip */}
          {!activeKit && !isLoadingDetail && (
            <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-4">
              <Sparkles className="w-12 h-12 text-brand-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  No Publishing Kit for this Clip Yet
                </h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Click below to run local AI analysis on this clip's exact transcript boundaries. Generates YouTube Shorts and Instagram Reels metadata, hashtags, and tags in seconds.
                </p>
              </div>
              <button
                onClick={() => {
                  const clipId = selectedClipId || clips[0]?.id;
                  if (clipId) handleGenerateKit(clipId);
                }}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-purple hover:from-brand-500 hover:to-accent-purple/90 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg transition-all"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Clip & Generating Kit...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Publishing Kit</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* DUAL PANE EDITOR */}
          {activeKit && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ======================================================== */}
              {/* LEFT PANE: VIDEO PREVIEW & METADATA (Col 1-4) */}
              {/* ======================================================== */}
              <div className="lg:col-span-4 space-y-4">
                {/* 9:16 Video Player Card */}
                <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-lg space-y-3 p-4">
                  <div className="relative aspect-[9/16] bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-800 group">
                    {activeKit.clip?.stream_url ? (
                      <video
                        ref={videoRef}
                        src={activeKit.clip.stream_url}
                        poster={activeKit.clip.thumbnail_url}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                      />
                    ) : activeKit.clip?.thumbnail_url ? (
                      <img
                        src={activeKit.clip.thumbnail_url}
                        alt="Clip poster"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-10 h-10 text-gray-600" />
                    )}

                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-white border border-white/10">
                      9:16 Vertical
                    </span>
                  </div>

                  {/* Clip Specs */}
                  <div className="space-y-1.5 text-xs text-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Duration:</span>
                      <span className="font-mono text-white font-bold">
                        {Math.round(activeKit.clip?.duration || 30)} seconds
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Resolution:</span>
                      <span className="font-mono text-white font-bold">1080 × 1920</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Virality Score:</span>
                      <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-bold font-mono">
                        {activeKit.clip?.overall_score || 80}/100
                      </span>
                    </div>
                  </div>

                  {/* Transcript Used Accordion */}
                  <div className="pt-2 border-t border-surface-border/60">
                    <button
                      onClick={() => setShowTranscriptExcerpt(!showTranscriptExcerpt)}
                      className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      <span className="font-semibold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-brand-400" />
                        <span>Clip Transcript Excerpt</span>
                      </span>
                      {showTranscriptExcerpt ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {showTranscriptExcerpt && (
                      <div className="mt-2 p-2.5 rounded-lg bg-background border border-surface-border text-[11px] text-gray-300 leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                        {activeKit.clip_transcript_used || 'No transcript text was recorded for this segment.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Package Exports Card */}
                <div className="bg-surface rounded-2xl border border-surface-border p-4 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Publishing Packages</span>
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    Download full kits organized by platform, with subtitles, thumbnails, and copy-ready text files.
                  </p>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <a
                      href={api.getPublishingKitExportUrl(activeKit.id, 'zip')}
                      download
                      className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors text-center"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Download Complete ZIP Bundle</span>
                    </a>

                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={api.getPublishingKitExportUrl(activeKit.id, 'txt')}
                        download
                        className="py-1.5 px-2.5 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-gray-200 text-xs font-semibold flex items-center justify-center gap-1 text-center"
                      >
                        <FileText className="w-3.5 h-3.5 text-brand-400" />
                        <span>Text (.TXT)</span>
                      </a>
                      <a
                        href={api.getPublishingKitExportUrl(activeKit.id, 'json')}
                        download
                        className="py-1.5 px-2.5 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-gray-200 text-xs font-semibold flex items-center justify-center gap-1 text-center"
                      >
                        <FileCode className="w-3.5 h-3.5 text-sky-400" />
                        <span>JSON (.JSON)</span>
                      </a>
                    </div>
                  </div>

                  {/* Composite Quick Copy */}
                  <div className="pt-2 border-t border-surface-border/60">
                    <button
                      onClick={() =>
                        copyToClipboard('both-platforms', getBothPlatformsCopyText(activeKit))
                      }
                      className="w-full py-1.5 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-xs font-semibold text-brand-300 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedStates['both-platforms'] ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-accent-emerald" />
                          <span>Copied Both Platforms!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Both Platforms to Clipboard</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* RIGHT PANE: PLATFORM TABS (Col 5-12) */}
              {/* ======================================================== */}
              <div className="lg:col-span-8 space-y-4">
                {/* Platform Tab Selector */}
                <div className="bg-surface rounded-xl p-1.5 border border-surface-border flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setActivePlatformTab('youtube')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                        activePlatformTab === 'youtube'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Video className="w-4 h-4 text-red-500" />
                      <span>YouTube Shorts Kit</span>
                    </button>

                    <button
                      onClick={() => setActivePlatformTab('instagram')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                        activePlatformTab === 'instagram'
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30 shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Share2 className="w-4 h-4 text-pink-500" />
                      <span>Instagram Reels Kit</span>
                    </button>

                    <button
                      onClick={() => setActivePlatformTab('brand')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                        activePlatformTab === 'brand'
                          ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30 shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Sliders className="w-4 h-4 text-brand-400" />
                      <span>Brand & Strategy</span>
                    </button>
                  </div>

                  {/* Regenerate Current Tab Button */}
                  {activePlatformTab !== 'brand' && (
                    <button
                      onClick={() => handleRegeneratePart(activePlatformTab)}
                      disabled={isRegenerating}
                      className="px-3 py-1.5 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors"
                      title="Re-run local AI for this platform"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-brand-400' : ''}`}
                      />
                      <span>Regenerate</span>
                    </button>
                  )}
                </div>

                {/* ======================================================== */}
                {/* TAB 1: YOUTUBE SHORTS CONTENT */}
                {/* ======================================================== */}
                {activePlatformTab === 'youtube' && (
                  <div className="space-y-4">
                    {/* 1. Primary Title Variations */}
                    <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>High-CTR Titles (5 Variations)</span>
                            <span className="text-[10px] text-gray-400 font-normal">
                              (YouTube $\le$ 100 chars)
                            </span>
                          </h3>
                          <p className="text-xs text-gray-400">
                            Select your primary title for exports or customize phrasing directly.
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            const curTitle =
                              activeKit.youtube.titles[activeKit.youtube.primary_title_index]?.title || '';
                            copyToClipboard('yt-primary-title', curTitle);
                          }}
                          className="px-3 py-1 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-xs font-semibold text-brand-300 flex items-center gap-1.5"
                        >
                          {copiedStates['yt-primary-title'] ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-accent-emerald" />
                              <span>Copied Title!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Selected Title</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {activeKit.youtube.titles.map((variation, idx) => {
                          const isPrimary = activeKit.youtube.primary_title_index === idx;
                          const charCount = variation.title.length;
                          const isTooLong = charCount > 100;

                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-xl border transition-all ${
                                isPrimary
                                  ? 'bg-brand-950/20 border-brand-500/60 ring-1 ring-brand-500/30'
                                  : 'bg-background border-surface-border hover:border-gray-700'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Radio select */}
                                <input
                                  type="radio"
                                  name="yt_primary_title"
                                  checked={isPrimary}
                                  onChange={() => {
                                    const nextYt = { ...activeKit.youtube, primary_title_index: idx };
                                    setActiveKit({ ...activeKit, youtube: nextYt });
                                  }}
                                  className="mt-1 w-4 h-4 accent-brand-500 cursor-pointer"
                                />

                                {/* Editable Title Input & Strategy Pill */}
                                <div className="flex-1 space-y-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-500/20 text-brand-300">
                                      {variation.strategy || `Variation ${idx + 1}`}
                                    </span>
                                    <div className="flex items-center gap-2 text-[11px] font-mono">
                                      <span
                                        className={
                                          isTooLong
                                            ? 'text-red-400 font-bold'
                                            : 'text-gray-400'
                                        }
                                      >
                                        {charCount}/100 chars
                                      </span>
                                      <button
                                        onClick={() =>
                                          copyToClipboard(`yt-title-${idx}`, variation.title)
                                        }
                                        className="text-gray-400 hover:text-white p-0.5"
                                        title="Copy this title variation"
                                      >
                                        {copiedStates[`yt-title-${idx}`] ? (
                                          <Check className="w-3 h-3 text-accent-emerald" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  <input
                                    type="text"
                                    value={variation.title}
                                    onChange={(e) => {
                                      const newTitles = [...activeKit.youtube.titles];
                                      newTitles[idx] = {
                                        ...newTitles[idx],
                                        title: e.target.value,
                                        char_count: e.target.value.length
                                      };
                                      setActiveKit({
                                        ...activeKit,
                                        youtube: { ...activeKit.youtube, titles: newTitles }
                                      });
                                    }}
                                    className="w-full bg-surface border border-surface-border rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-brand-500 font-medium"
                                  />

                                  {variation.explanation && (
                                    <p className="text-[11px] text-gray-400 italic">
                                      {variation.explanation}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. YouTube Descriptions */}
                    <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white">Video Descriptions</h3>
                          <p className="text-xs text-gray-400">
                            Select between short punchy, SEO keyword-rich, or alternative descriptions.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const descKey = activeKit.youtube.selected_description;
                              const text =
                                descKey === 'seo'
                                  ? activeKit.youtube.description_seo
                                  : descKey === 'alt'
                                  ? activeKit.youtube.description_alt
                                  : activeKit.youtube.description_short;
                              copyToClipboard('yt-description', text);
                            }}
                            className="px-3 py-1 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-xs font-semibold text-brand-300 flex items-center gap-1.5"
                          >
                            {copiedStates['yt-description'] ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-accent-emerald" />
                                <span>Copied Description!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Active Description</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Segmented Button for Description Choice */}
                      <div className="flex items-center space-x-1 bg-background p-1 rounded-lg border border-surface-border text-xs">
                        {(['short', 'alt', 'seo'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() =>
                              setActiveKit({
                                ...activeKit,
                                youtube: { ...activeKit.youtube, selected_description: opt }
                              })
                            }
                            className={`flex-1 py-1 rounded font-semibold capitalize transition-all ${
                              activeKit.youtube.selected_description === opt
                                ? 'bg-brand-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {opt === 'short'
                              ? 'Short Punchy'
                              : opt === 'alt'
                              ? 'Alternative Angle'
                              : 'Detailed SEO'}
                          </button>
                        ))}
                      </div>

                      {/* Editable Text Area */}
                      <textarea
                        rows={4}
                        value={
                          activeKit.youtube.selected_description === 'seo'
                            ? activeKit.youtube.description_seo
                            : activeKit.youtube.selected_description === 'alt'
                            ? activeKit.youtube.description_alt
                            : activeKit.youtube.description_short
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          const k = activeKit.youtube.selected_description;
                          const nextYt = { ...activeKit.youtube };
                          if (k === 'seo') nextYt.description_seo = val;
                          else if (k === 'alt') nextYt.description_alt = val;
                          else nextYt.description_short = val;
                          setActiveKit({ ...activeKit, youtube: nextYt });
                        }}
                        className="w-full bg-background border border-surface-border rounded-lg p-3 text-xs text-white outline-none focus:border-brand-500 font-sans leading-relaxed"
                      />
                    </div>

                    {/* 3. Hashtags & Tags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Hashtags */}
                      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-accent-amber" />
                            <span>YouTube Hashtags</span>
                          </h4>
                          <button
                            onClick={() => {
                              const allTags = [
                                ...(activeKit.youtube.hashtags.broad || []),
                                ...(activeKit.youtube.hashtags.specific || []),
                                ...(activeKit.youtube.hashtags.audience || [])
                              ]
                                .map((t) => (t.startsWith('#') ? t : `#${t}`))
                                .join(' ');
                              copyToClipboard('yt-hashtags', allTags);
                            }}
                            className="text-xs font-semibold text-brand-300 hover:underline flex items-center gap-1"
                          >
                            {copiedStates['yt-hashtags'] ? 'Copied!' : 'Copy All'}
                          </button>
                        </div>

                        {/* Broad Tags */}
                        <div className="space-y-1">
                          <span className="text-[11px] text-gray-400 font-semibold">Broad Reach:</span>
                          <div className="flex flex-wrap gap-1">
                            {(activeKit.youtube.hashtags.broad || ['#shorts', '#viral']).map(
                              (tag, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-background border border-surface-border text-xs text-brand-300 font-mono"
                                >
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        {/* Specific Tags */}
                        <div className="space-y-1">
                          <span className="text-[11px] text-gray-400 font-semibold">Topic Specific:</span>
                          <div className="flex flex-wrap gap-1">
                            {(activeKit.youtube.hashtags.specific || []).map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-background border border-surface-border text-xs text-sky-300 font-mono"
                              >
                                {tag.startsWith('#') ? tag : `#${tag}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* YouTube Tags Meter (500 char limit) */}
                      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5 text-accent-emerald" />
                              <span>YouTube Keywords (Tags)</span>
                            </h4>
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                (activeKit.youtube.tags_csv || '').length > 500
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                              }`}
                            >
                              {(activeKit.youtube.tags_csv || '').length}/500 chars limit
                            </span>
                          </div>

                          <button
                            onClick={() =>
                              copyToClipboard('yt-tags', activeKit.youtube.tags_csv)
                            }
                            className="px-2.5 py-1 rounded bg-surface-lighter hover:bg-surface border border-surface-border text-xs font-semibold text-brand-300 flex items-center gap-1"
                          >
                            {copiedStates['yt-tags'] ? 'Copied!' : 'Copy Tags'}
                          </button>
                        </div>

                        <textarea
                          rows={3}
                          value={activeKit.youtube.tags_csv}
                          onChange={(e) => {
                            setActiveKit({
                              ...activeKit,
                              youtube: { ...activeKit.youtube, tags_csv: e.target.value }
                            });
                          }}
                          className="w-full bg-background border border-surface-border rounded-lg p-2.5 text-xs text-white outline-none focus:border-brand-500 font-mono"
                          placeholder="comma, separated, tags, here"
                        />
                      </div>
                    </div>

                    {/* 4. Pinned Comment & Overlay Text */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Pinned Comment */}
                      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                            <span>Pinned Comment</span>
                          </h4>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                'yt-comment',
                                activeKit.youtube.pinned_comment || ''
                              )
                            }
                            className="text-xs font-semibold text-brand-300 hover:underline"
                          >
                            {copiedStates['yt-comment'] ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={activeKit.youtube.pinned_comment || ''}
                          onChange={(e) =>
                            setActiveKit({
                              ...activeKit,
                              youtube: {
                                ...activeKit.youtube,
                                pinned_comment: e.target.value
                              }
                            })
                          }
                          className="w-full bg-background border border-surface-border rounded-lg p-2.5 text-xs text-white outline-none focus:border-brand-500"
                        />
                      </div>

                      {/* Thumbnail Text Options */}
                      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-accent-amber" />
                          <span>Thumbnail / Cover Text Overlay</span>
                        </h4>
                        <div className="space-y-1.5">
                          {(activeKit.youtube.thumbnail_texts || []).map((text, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded bg-background border border-surface-border text-xs"
                            >
                              <span className="font-bold text-white tracking-wide uppercase">
                                "{text}"
                              </span>
                              <button
                                onClick={() => copyToClipboard(`yt-thumb-${idx}`, text)}
                                className="text-gray-400 hover:text-white p-1"
                              >
                                {copiedStates[`yt-thumb-${idx}`] ? (
                                  <Check className="w-3 h-3 text-accent-emerald" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Copy Full YouTube Kit Button */}
                    <button
                      onClick={() =>
                        copyToClipboard('full-youtube', getFullYouTubeCopyText(activeKit))
                      }
                      className="w-full py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      {copiedStates['full-youtube'] ? (
                        <>
                          <Check className="w-4 h-4 text-accent-emerald" />
                          <span>Copied Full YouTube Shorts Kit to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Full YouTube Shorts Kit (Title + Desc + Tags)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ======================================================== */}
                {/* TAB 2: INSTAGRAM REELS CONTENT */}
                {/* ======================================================== */}
                {activePlatformTab === 'instagram' && (
                  <div className="space-y-4">
                    {/* 1. First-Line Hook Highlight */}
                    <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-pink-400" />
                            <span>First-Line Hook (The Above-The-Fold Stop)</span>
                          </h3>
                          <p className="text-xs text-gray-400">
                            The critical first 125 characters viewers see before tapping "...more".
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard('ig-hook', activeKit.instagram.first_line_hook)
                          }
                          className="px-3 py-1 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-xs font-semibold text-brand-300 flex items-center gap-1.5"
                        >
                          {copiedStates['ig-hook'] ? 'Copied Hook!' : 'Copy Hook'}
                        </button>
                      </div>

                      <input
                        type="text"
                        value={activeKit.instagram.first_line_hook || ''}
                        onChange={(e) =>
                          setActiveKit({
                            ...activeKit,
                            instagram: {
                              ...activeKit.instagram,
                              first_line_hook: e.target.value
                            }
                          })
                        }
                        className="w-full bg-background border border-surface-border rounded-lg px-3 py-2 text-xs font-semibold text-white outline-none focus:border-pink-500"
                      />
                    </div>

                    {/* 2. Captions (3 Styles) */}
                    <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Caption Variations (3 Styles)
                          </h3>
                          <p className="text-xs text-gray-400">
                            Storytelling, Punchy/Bullet, or Question format ($\le$ 2,200 chars).
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            const curCap =
                              activeKit.instagram.captions[
                                activeKit.instagram.selected_caption_index
                              ]?.text || '';
                            copyToClipboard('ig-active-caption', curCap);
                          }}
                          className="px-3 py-1 rounded-lg bg-surface-lighter hover:bg-surface border border-surface-border text-xs font-semibold text-brand-300 flex items-center gap-1.5"
                        >
                          {copiedStates['ig-active-caption'] ? 'Copied Caption!' : 'Copy Selected Caption'}
                        </button>
                      </div>

                      <div className="space-y-3">
                        {activeKit.instagram.captions.map((cap, idx) => {
                          const isSelected = activeKit.instagram.selected_caption_index === idx;

                          return (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                                isSelected
                                  ? 'bg-pink-950/20 border-pink-500/60 ring-1 ring-pink-500/30'
                                  : 'bg-background border-surface-border hover:border-gray-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="ig_active_caption"
                                    checked={isSelected}
                                    onChange={() =>
                                      setActiveKit({
                                        ...activeKit,
                                        instagram: {
                                          ...activeKit.instagram,
                                          selected_caption_index: idx
                                        }
                                      })
                                    }
                                    className="w-4 h-4 accent-pink-500 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold uppercase tracking-wider text-pink-300">
                                    {cap.type || `Option ${idx + 1}`}
                                  </span>
                                </label>

                                <span className="text-[11px] font-mono text-gray-400">
                                  {cap.text.length} / 2200 chars
                                </span>
                              </div>

                              <textarea
                                rows={3}
                                value={cap.text}
                                onChange={(e) => {
                                  const newCaps = [...activeKit.instagram.captions];
                                  newCaps[idx] = {
                                    ...newCaps[idx],
                                    text: e.target.value,
                                    char_count: e.target.value.length
                                  };
                                  setActiveKit({
                                    ...activeKit,
                                    instagram: {
                                      ...activeKit.instagram,
                                      captions: newCaps
                                    }
                                  });
                                }}
                                className="w-full bg-surface border border-surface-border rounded-lg p-2.5 text-xs text-white outline-none focus:border-pink-500 leading-relaxed font-sans"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Instagram Hashtags & Audio Direction */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Reels Hashtags */}
                      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-pink-400" />
                            <span>Reels Hashtags</span>
                          </h4>
                          <button
                            onClick={() => {
                              const allTags = [
                                ...(activeKit.instagram.hashtags.niche || []),
                                ...(activeKit.instagram.hashtags.topic || []),
                                ...(activeKit.instagram.hashtags.community || [])
                              ]
                                .map((t) => (t.startsWith('#') ? t : `#${t}`))
                                .join(' ');
                              copyToClipboard('ig-hashtags', allTags);
                            }}
                            className="text-xs font-semibold text-brand-300 hover:underline"
                          >
                            {copiedStates['ig-hashtags'] ? 'Copied!' : 'Copy All'}
                          </button>
                        </div>

                        {/* Niche & Community tags */}
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <span className="text-[11px] text-gray-400 font-semibold">Niche Tags:</span>
                            <div className="flex flex-wrap gap-1">
                              {(activeKit.instagram.hashtags.niche || []).map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-background border border-surface-border text-xs text-pink-300 font-mono"
                                >
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] text-gray-400 font-semibold">Community Tags:</span>
                            <div className="flex flex-wrap gap-1">
                              {(activeKit.instagram.hashtags.community || []).map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-background border border-surface-border text-xs text-accent-purple font-mono"
                                >
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Audio & Music Mood Direction */}
                      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Music className="w-3.5 h-3.5 text-accent-emerald" />
                            <span>Audio Mood Direction</span>
                          </h4>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                'ig-audio',
                                activeKit.instagram.audio_direction
                              )
                            }
                            className="text-xs font-semibold text-brand-300 hover:underline"
                          >
                            {copiedStates['ig-audio'] ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={activeKit.instagram.audio_direction}
                          onChange={(e) =>
                            setActiveKit({
                              ...activeKit,
                              instagram: {
                                ...activeKit.instagram,
                                audio_direction: e.target.value
                              }
                            })
                          }
                          className="w-full bg-background border border-surface-border rounded-lg p-2.5 text-xs text-white outline-none focus:border-pink-500"
                        />
                        <p className="text-[11px] text-gray-400">
                          Search for sounds fitting this vibe in Instagram's audio library before publishing.
                        </p>
                      </div>
                    </div>

                    {/* Copy Full Instagram Kit Button */}
                    <button
                      onClick={() =>
                        copyToClipboard('full-instagram', getFullInstagramCopyText(activeKit))
                      }
                      className="w-full py-2.5 rounded-xl bg-pink-600/20 hover:bg-pink-600 border border-pink-500/30 text-pink-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      {copiedStates['full-instagram'] ? (
                        <>
                          <Check className="w-4 h-4 text-accent-emerald" />
                          <span>Copied Full Instagram Kit to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Full Instagram Reels Kit (Caption + Hook + Hashtags)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* ======================================================== */}
                {/* TAB 3: BRAND & SETTINGS */}
                {/* ======================================================== */}
                {activePlatformTab === 'brand' && (
                  <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-brand-400" />
                        <span>Brand Voice & Positioning Snapshot</span>
                      </h3>
                      <p className="text-xs text-gray-400">
                        These settings guide local AI tone, language, call-to-actions, and hashtag selection.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <span className="font-semibold text-gray-400">Brand Voice:</span>
                        <div className="p-2.5 rounded-lg bg-background border border-surface-border text-white font-medium capitalize">
                          {activeKit.brand_settings_applied?.brand_voice || 'Energetic & Inspiring'}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="font-semibold text-gray-400">Content Language:</span>
                        <div className="p-2.5 rounded-lg bg-background border border-surface-border text-white font-medium">
                          {activeKit.brand_settings_applied?.content_language || 'English'}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="font-semibold text-gray-400">YouTube CTA:</span>
                        <input
                          type="text"
                          value={activeKit.youtube.cta}
                          onChange={(e) =>
                            setActiveKit({
                              ...activeKit,
                              youtube: { ...activeKit.youtube, cta: e.target.value }
                            })
                          }
                          className="w-full bg-background border border-surface-border rounded-lg p-2.5 text-white outline-none focus:border-brand-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="font-semibold text-gray-400">Instagram CTA:</span>
                        <input
                          type="text"
                          value={activeKit.instagram.cta}
                          onChange={(e) =>
                            setActiveKit({
                              ...activeKit,
                              instagram: { ...activeKit.instagram, cta: e.target.value }
                            })
                          }
                          className="w-full bg-background border border-surface-border rounded-lg p-2.5 text-white outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span>Save Brand Settings</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MARK PUBLISHED MODAL */}
      {/* ======================================================== */}
      {showPublishedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-surface-border max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Mark Video as Published</span>
              </h3>
              <button
                onClick={() => setShowPublishedModal(false)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Paste the public live URL of your uploaded Short or Reel to easily track it in AI Shorts Studio.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-300">
                Published Video URL (Optional):
              </label>
              <input
                type="url"
                placeholder="https://youtube.com/shorts/... or https://instagram.com/reel/..."
                value={publishedUrlInput}
                onChange={(e) => setPublishedUrlInput(e.target.value)}
                className="w-full bg-background border border-surface-border rounded-lg p-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPublishedModal(false)}
                className="px-3 py-1.5 rounded-lg bg-surface-lighter hover:bg-surface text-gray-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPublished}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md"
              >
                Confirm Published
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
