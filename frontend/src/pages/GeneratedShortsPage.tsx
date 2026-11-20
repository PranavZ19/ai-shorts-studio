import React, { useState, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Check,
  X,
  Download,
  Sliders,
  Filter,
  Sparkles,
  Eye,
  Award,
  Copy,
  Star,
  Trash2,
  Search,
  ArrowUpDown,
  FileText,
  FileCode,
  Image as ImageIcon,
  Archive,
  RefreshCw,
  ExternalLink,
  Edit2,
  CheckSquare,
  Square,
  Clock,
  Layers,
  HardDrive
} from 'lucide-react';
import { ClipItem } from '../types';
import { api } from '../services/api';

interface GeneratedShortsPageProps {
  clips: ClipItem[];
  onSelectClip?: (id: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const GeneratedShortsPage: React.FC<GeneratedShortsPageProps> = ({ clips, onSelectClip, onNavigate, onRefresh }) => {
  // Filters & Search
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [favoriteOnly, setFavoriteOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'duration' | 'title' | 'size'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  // Active preview clip modal
  const [previewClip, setPreviewClip] = useState<ClipItem | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Inline rename state
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  // Delete confirmation modal
  const [deleteModalClip, setDeleteModalClip] = useState<ClipItem | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState<boolean>(false);

  // Video player controls
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Filtered & sorted clips
  const processedClips = useMemo(() => {
    return clips
      .filter((c) => {
        if (favoriteOnly && !c.is_favorite) return false;
        if (filter === 'approved') return c.is_approved;
        if (filter === 'pending') return c.status === 'candidate' && !c.is_approved;
        if (filter === 'rejected') return c.status === 'rejected';
        if (filter === 'rendering') return c.status === 'exporting' || c.status === 'running';
        if (filter === 'completed') return c.has_rendered_video || c.status === 'exported';
        if (filter === 'failed') return c.status === 'error';
        return true;
      })
      .filter((c) => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(term) ||
          (c.main_topic && c.main_topic.toLowerCase().includes(term)) ||
          (c.hook_summary && c.hook_summary.toLowerCase().includes(term)) ||
          (c.tags && c.tags.some((t) => t.toLowerCase().includes(term))) ||
          (c.source_title && c.source_title.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => {
        let valA: any = a.overall_score;
        let valB: any = b.overall_score;
        if (sortBy === 'date') {
          valA = new Date(a.created_at || 0).getTime();
          valB = new Date(b.created_at || 0).getTime();
        } else if (sortBy === 'duration') {
          valA = a.duration;
          valB = b.duration;
        } else if (sortBy === 'title') {
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
        } else if (sortBy === 'size') {
          valA = a.file_size_bytes || 0;
          valB = b.file_size_bytes || 0;
        }

        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [clips, filter, search, favoriteOnly, sortBy, sortOrder]);

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => {
    if (selectedIds.length === processedClips.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(processedClips.map((c) => c.id));
    }
  };

  const handleBulkApproval = async (approve: boolean) => {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    try {
      await api.bulkApproveClips(selectedIds, approve);
      onRefresh();
    } catch (err) {
      console.error('Failed bulk approval:', err);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    try {
      await api.bulkDeleteClips(selectedIds, true);
      setSelectedIds([]);
      setBulkDeleteModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed bulk delete:', err);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSingleDelete = async (clipId: string) => {
    try {
      await api.deleteClip(clipId, true);
      setDeleteModalClip(null);
      if (previewClip?.id === clipId) setPreviewClip(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete clip:', err);
    }
  };

  const handleToggleFavorite = async (clipId: string) => {
    try {
      await api.toggleClipFavorite(clipId);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTitle = async (clipId: string) => {
    if (!editingTitle.trim()) return;
    try {
      await api.updateClip(clipId, { title: editingTitle.trim() });
      setEditingClipId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to rename clip:', err);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Video player handlers
  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Generated Shorts Library</span>
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              {processedClips.length} {processedClips.length === 1 ? 'clip' : 'clips'}
            </span>
          </h2>
          <p className="text-xs text-gray-400">
            Manage, review, seek-preview, approve, batch-download, and organize high-virality vertical video shorts.
          </p>
        </div>

        {/* Global actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
              favoriteOnly
                ? 'bg-accent-amber/20 text-accent-amber border-accent-amber/40 shadow-sm'
                : 'bg-surface text-gray-400 border-surface-border hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${favoriteOnly ? 'fill-accent-amber text-accent-amber' : ''}`} />
            <span>Favorites</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-surface border border-surface-border text-gray-400 hover:text-white transition-colors"
            title="Refresh Library"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter, Search & Sorting Bar */}
      <div className="bg-surface rounded-xl p-3 border border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'completed', label: 'Completed' },
            { id: 'approved', label: 'Approved' },
            { id: 'pending', label: 'Pending' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'rendering', label: 'Rendering' },
            { id: 'failed', label: 'Failed' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-surface-lighter'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {/* Search box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search title, hook, tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-surface-border rounded-lg text-xs text-white placeholder-gray-500 outline-none focus:border-brand-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center space-x-1 bg-background border border-surface-border rounded-lg px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer"
            >
              <option value="score" className="bg-surface">Virality Score</option>
              <option value="date" className="bg-surface">Newest First</option>
              <option value="duration" className="bg-surface">Duration</option>
              <option value="size" className="bg-surface">File Size</option>
              <option value="title" className="bg-surface">Title</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="text-[10px] text-gray-400 hover:text-white font-mono px-1"
              title="Toggle sort direction"
            >
              {sortOrder === 'asc' ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Operations Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-brand-900/60 via-surface-lighter to-brand-950/60 border border-brand-500/40 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-brand-400" />
              <span>{selectedIds.length} Selected</span>
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-gray-400 hover:text-gray-200 underline text-[11px]"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => handleBulkApproval(true)}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium flex items-center space-x-1 shadow-sm transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
            <button
              onClick={() => handleBulkApproval(false)}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium flex items-center space-x-1 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
            <a
              href={api.getBulkZipUrl(selectedIds)}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium flex items-center space-x-1 shadow-sm transition-all"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download ZIP ({selectedIds.length})</span>
            </a>
            <button
              onClick={() => setBulkDeleteModalOpen(true)}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-medium flex items-center space-x-1 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Select All Checkbox Row */}
      {processedClips.length > 0 && (
        <div className="flex items-center justify-between px-1 text-xs text-gray-400">
          <button
            onClick={selectAll}
            className="flex items-center space-x-2 hover:text-white transition-colors"
          >
            {selectedIds.length === processedClips.length ? (
              <CheckSquare className="w-4 h-4 text-brand-400" />
            ) : (
              <Square className="w-4 h-4 text-gray-500" />
            )}
            <span>Select All Visible ({processedClips.length})</span>
          </button>
          <span className="text-[11px] text-gray-500 font-mono">
            Showing {processedClips.length} of {clips.length}
          </span>
        </div>
      )}

      {/* Main Grid View */}
      {processedClips.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {processedClips.map((clip) => {
            const isSelected = selectedIds.includes(clip.id);
            const isRendered = Boolean(clip.has_rendered_video || clip.output_path);

            return (
              <div
                key={clip.id}
                className={`bg-surface rounded-xl overflow-hidden border transition-all flex flex-col group ${
                  isSelected
                    ? 'border-brand-500 ring-2 ring-brand-500/20 bg-surface-lighter/40'
                    : 'border-surface-border hover:border-brand-500/50 shadow-md'
                }`}
              >
                {/* 9:16 Card Presentation */}
                <div className="relative aspect-[9/16] bg-black overflow-hidden flex items-center justify-center">
                  {clip.thumbnail_url ? (
                    <img
                      src={clip.thumbnail_url}
                      alt={clip.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center p-4 text-center">
                      <Sparkles className="w-10 h-10 text-brand-400/40" />
                    </div>
                  )}

                  {/* Multi-select check overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(clip.id);
                    }}
                    className="absolute top-2.5 left-2.5 z-10 p-1 rounded-md bg-black/60 hover:bg-black/90 backdrop-blur-sm transition-all"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-brand-400" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>

                  {/* Favorite toggle button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(clip.id);
                    }}
                    className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-sm transition-all"
                    title={clip.is_favorite ? 'Remove Favorite' : 'Mark Favorite'}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        clip.is_favorite
                          ? 'fill-accent-amber text-accent-amber'
                          : 'text-gray-300 hover:text-accent-amber'
                      }`}
                    />
                  </button>

                  {/* Top Score Pill */}
                  <div className="absolute top-10 left-2.5 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-brand-500/30 text-[11px] font-black text-brand-400 flex items-center gap-1 shadow">
                    <Award className="w-3 h-3" />
                    <span>{clip.overall_score}</span>
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute top-10 right-2.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                    {Math.round(clip.duration)}s
                  </div>

                  {/* Resolution & Codec Badge */}
                  <div className="absolute bottom-2.5 left-2.5 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-gray-300">
                    {clip.resolution || '1080x1920'}
                  </div>

                  {/* File Size Badge */}
                  {isRendered && (
                    <div className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-mono text-emerald-400">
                      {formatFileSize(clip.file_size_bytes)}
                    </div>
                  )}

                  {/* Central Play/Preview Hover Button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={() => setPreviewClip(clip)}
                      className="p-3.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-xl transform group-hover:scale-110 transition-all"
                      title="Watch Preview Player"
                    >
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Card Information & Actions */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2.5 text-xs">
                  <div>
                    {/* Inline Title Editor */}
                    {editingClipId === clip.id ? (
                      <div className="flex items-center gap-1 mb-1">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(clip.id)}
                          className="w-full px-2 py-1 bg-background border border-brand-500 rounded text-xs text-white outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveTitle(clip.id)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingClipId(null)}
                          className="p-1 text-gray-400 hover:text-gray-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1 group/title">
                        <h4
                          onClick={() => setPreviewClip(clip)}
                          className="font-semibold text-white line-clamp-2 cursor-pointer hover:text-brand-300 transition-colors"
                        >
                          {clip.title}
                        </h4>
                        <button
                          onClick={() => {
                            setEditingClipId(clip.id);
                            setEditingTitle(clip.title);
                          }}
                          className="opacity-0 group-hover/title:opacity-100 p-0.5 text-gray-400 hover:text-brand-400 transition-opacity"
                          title="Rename clip"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Source project / video name */}
                    <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                      {clip.source_title || 'Source Video'}
                    </p>

                    {/* Tags preview */}
                    {clip.tags && clip.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {clip.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-surface-lighter text-[10px] text-gray-300 font-mono"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status & Timing Footer */}
                  <div className="space-y-2 pt-2 border-t border-surface-border/60">
                    <div className="flex items-center justify-between text-[11px]">
                      {/* Render status */}
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${
                          isRendered
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : clip.status === 'exporting'
                            ? 'bg-accent-amber/20 text-accent-amber animate-pulse'
                            : clip.status === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {isRendered ? 'Ready' : clip.status}
                      </span>

                      {/* Approval badge */}
                      <button
                        onClick={() => api.toggleClipApproval(clip.id, !clip.is_approved).then(onRefresh)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          clip.is_approved
                            ? 'bg-brand-600 text-white'
                            : 'bg-surface-lighter text-gray-400 hover:text-white'
                        }`}
                      >
                        {clip.is_approved ? 'APPROVED' : 'PENDING'}
                      </button>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      <button
                        onClick={() => setPreviewClip(clip)}
                        className="flex-1 py-1 px-2 rounded bg-surface-lighter hover:bg-gray-700 text-gray-200 text-center font-medium flex items-center justify-center gap-1 transition-colors"
                        title="Watch full video preview"
                      >
                        <Eye className="w-3 h-3 text-brand-400" />
                        <span>Watch</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectClip?.(clip.id);
                          onNavigate('clip-editor');
                        }}
                        className="p-1.5 rounded bg-surface-lighter hover:bg-gray-700 text-gray-300 hover:text-white"
                        title="Open in Clip Editor"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>

                      {isRendered && (
                        <a
                          href={api.getClipMp4Url(clip.id, true)}
                          className="p-1.5 rounded bg-brand-600/30 hover:bg-brand-600 text-brand-300 hover:text-white transition-colors"
                          title="Download MP4"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => setDeleteModalClip(clip)}
                        className="p-1.5 rounded bg-surface-lighter hover:bg-red-900/50 text-gray-400 hover:text-red-400"
                        title="Delete clip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-4">
          <Sparkles className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Generated Shorts Found</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {search || filter !== 'all' || favoriteOnly
              ? 'No clips matched your active search or filter criteria. Try resetting filters.'
              : 'Analyze long-form source videos in the AI Clip Finder or render clips in the Editor to populate your gallery.'}
          </p>
          <button
            onClick={() => onNavigate('clip-finder')}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs inline-flex items-center space-x-2"
          >
            <span>Go to AI Clip Finder</span>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIDEO PREVIEW MODAL (Requirement 3: Video Preview Experience) */}
      {/* ======================================================== */}
      {previewClip && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
            {/* Left Column: Player & Aspect Canvas */}
            <div className="md:w-5/12 bg-black flex flex-col items-center justify-center relative p-3">
              <div className="relative aspect-[9/16] w-full max-w-[340px] bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 flex items-center justify-center">
                {previewClip.has_rendered_video ? (
                  <video
                    ref={videoRef}
                    src={api.getClipStreamUrl(previewClip.id)}
                    className="w-full h-full object-cover"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={() => {
                      if (videoRef.current) setVideoDuration(videoRef.current.duration);
                    }}
                    onEnded={() => setIsPlaying(false)}
                    playsInline
                  />
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <Sparkles className="w-12 h-12 text-accent-amber mx-auto animate-pulse" />
                    <p className="text-xs text-gray-300 font-medium">This clip has not been rendered yet.</p>
                    <button
                      onClick={() => {
                        setPreviewClip(null);
                        onNavigate('clip-editor');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 text-white font-semibold text-xs"
                    >
                      Render in Clip Editor
                    </button>
                  </div>
                )}
              </div>

              {/* Video Player Controls Bar */}
              {previewClip.has_rendered_video && (
                <div className="w-full max-w-[340px] mt-3 space-y-2 bg-surface/90 border border-surface-border/80 rounded-xl p-2.5 text-xs">
                  {/* Timeline Scrubber */}
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] text-gray-400">
                      {Math.floor(currentTime)}s
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={videoDuration || previewClip.duration}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      className="flex-1 accent-brand-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                    />
                    <span className="font-mono text-[10px] text-gray-400">
                      {Math.floor(videoDuration || previewClip.duration)}s
                    </span>
                  </div>

                  {/* Button row */}
                  <div className="flex items-center justify-between text-gray-300">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleTogglePlay}
                        className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                      </button>

                      <button onClick={handleToggleMute} className="hover:text-white">
                        {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                      </button>

                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-14 accent-brand-500 cursor-pointer h-1 bg-gray-700 rounded"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Playback speed selector */}
                      <select
                        value={playbackSpeed}
                        onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                        className="bg-background text-[11px] text-gray-200 rounded px-1.5 py-0.5 border border-surface-border outline-none"
                      >
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1.0x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2.0x</option>
                      </select>

                      <button onClick={handleFullscreen} className="hover:text-white" title="Fullscreen">
                        <Maximize className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Metadata, Social Packaging & Exports */}
            <div className="md:w-7/12 p-6 flex flex-col justify-between overflow-y-auto space-y-5">
              <div>
                {/* Header & Close */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 text-[11px] font-bold">
                        Score {previewClip.overall_score}/100
                      </span>
                      <span className="font-mono text-xs text-gray-400">
                        {previewClip.duration}s ({previewClip.start_time}s - {previewClip.end_time}s)
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">{previewClip.title}</h3>
                  </div>

                  <button
                    onClick={() => {
                      if (videoRef.current) videoRef.current.pause();
                      setPreviewClip(null);
                    }}
                    className="p-1.5 rounded-lg bg-surface-lighter hover:bg-gray-700 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Virality Analysis Explanation */}
                {previewClip.score_explanation && (
                  <div className="bg-surface-lighter rounded-xl p-3 border border-surface-border mt-3 text-xs text-gray-300">
                    <p className="font-semibold text-brand-300 mb-0.5">AI Virality Rationale:</p>
                    <p className="text-gray-300 leading-relaxed">{previewClip.score_explanation}</p>
                  </div>
                )}

                {/* Score Rubric Badges */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 text-center">
                  {[
                    { label: 'Hook', val: previewClip.hook_score },
                    { label: 'Emotion', val: previewClip.emotional_score },
                    { label: 'Curiosity', val: previewClip.curiosity_score },
                    { label: 'Story', val: previewClip.story_score },
                    { label: 'Clarity', val: previewClip.clarity_score || 70 },
                    { label: 'Shareable', val: previewClip.shareability_score }
                  ].map((metric, i) => (
                    <div key={i} className="bg-background rounded-lg p-2 border border-surface-border">
                      <div className="text-[10px] text-gray-400 uppercase font-mono">{metric.label}</div>
                      <div className="text-sm font-bold text-white mt-0.5">{metric.val}</div>
                    </div>
                  ))}
                </div>

                {/* Social Packaging (AI Titles, Descriptions, Hashtags) */}
                {previewClip.ai_metadata && (
                  <div className="space-y-3 mt-4">
                    {/* Suggested Titles */}
                    {previewClip.ai_metadata.titles && previewClip.ai_metadata.titles.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-gray-300 mb-1 flex items-center justify-between">
                          <span>AI Title Alternatives (Click to copy):</span>
                        </div>
                        <div className="space-y-1">
                          {previewClip.ai_metadata.titles.slice(0, 3).map((t, idx) => (
                            <div
                              key={idx}
                              onClick={() => copyToClipboard(t, `title_${idx}`)}
                              className="text-xs bg-background p-2 rounded-lg border border-surface-border/60 hover:border-brand-500/50 cursor-pointer flex items-center justify-between text-gray-200 transition-colors"
                            >
                              <span className="line-clamp-1">{t}</span>
                              {copiedField === `title_${idx}` ? (
                                <span className="text-emerald-400 text-[10px] font-bold">Copied!</span>
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-gray-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hashtags */}
                    {previewClip.ai_metadata.hashtags && previewClip.ai_metadata.hashtags.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-gray-300 mb-1 flex items-center justify-between">
                          <span>Hashtags:</span>
                          <button
                            onClick={() =>
                              copyToClipboard(previewClip.ai_metadata!.hashtags!.join(' '), 'all_tags')
                            }
                            className="text-[11px] text-brand-400 hover:underline flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedField === 'all_tags' ? 'Copied!' : 'Copy all'}</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {previewClip.ai_metadata.hashtags.map((h, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-background text-[11px] text-brand-300 font-mono border border-surface-border"
                            >
                              {h.startsWith('#') ? h : `#${h}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Direct Download & Export Hub for Current Clip */}
              <div className="pt-4 border-t border-surface-border space-y-2.5">
                <p className="text-xs font-bold text-gray-300">Quick Downloads & Exports:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <a
                    href={api.getClipMp4Url(previewClip.id, true)}
                    className="p-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-center flex items-center justify-center gap-1.5 shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>MP4 Video</span>
                  </a>

                  <a
                    href={api.getClipSrtUrl(previewClip.id)}
                    className="p-2 rounded-lg bg-surface-lighter hover:bg-gray-700 text-gray-200 text-center font-medium flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-brand-400" />
                    <span>SRT Subs</span>
                  </a>

                  <a
                    href={api.getClipVttUrl(previewClip.id)}
                    className="p-2 rounded-lg bg-surface-lighter hover:bg-gray-700 text-gray-200 text-center font-medium flex items-center justify-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WebVTT</span>
                  </a>

                  <a
                    href={api.getClipZipUrl(previewClip.id)}
                    className="p-2 rounded-lg bg-surface-lighter hover:bg-gray-700 text-gray-200 text-center font-medium flex items-center justify-center gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5 text-accent-amber" />
                    <span>Clip ZIP</span>
                  </a>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => {
                      onSelectClip?.(previewClip.id);
                      setPreviewClip(null);
                      onNavigate('clip-editor');
                    }}
                    className="text-xs text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Open in Clip Editor / Re-render</span>
                  </button>

                  <a
                    href={api.getClipMetadataUrl(previewClip.id)}
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>JSON Metadata</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SINGLE CLIP DELETE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {deleteModalClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Generated Clip?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">"{deleteModalClip.title}"</strong>?
            </p>
            <div className="bg-background rounded-lg p-3 text-xs space-y-1 text-gray-400 border border-surface-border">
              <p>• Frees approximately <span className="font-mono text-white">{formatFileSize(deleteModalClip.file_size_bytes)}</span> from Drive D:.</p>
              <p>• Removes rendered MP4, SRT/VTT subtitles, and poster thumbnail.</p>
              <p className="text-emerald-400">• The original source video will NOT be affected.</p>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2 text-xs">
              <button
                onClick={() => setDeleteModalClip(null)}
                className="px-4 py-2 rounded-lg bg-surface-lighter hover:bg-gray-700 text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSingleDelete(deleteModalClip.id)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                Delete Clip Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BULK DELETE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete {selectedIds.length} Clips?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              This will permanently delete all {selectedIds.length} selected generated clips and their media files from Drive D:.
            </p>
            <div className="bg-background rounded-lg p-3 text-xs space-y-1 text-gray-400 border border-surface-border">
              <p>• Cleans up all rendered MP4s, subtitles, and thumbnails.</p>
              <p className="text-emerald-400">• Source videos remain completely safe and untouched.</p>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2 text-xs">
              <button
                onClick={() => setBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-surface-lighter hover:bg-gray-700 text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                Delete {selectedIds.length} Clips
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default GeneratedShortsPage;
