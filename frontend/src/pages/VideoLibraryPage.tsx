import React, { useState } from 'react';
import {
  Film,
  Clock,
  HardDrive,
  Play,
  Sparkles,
  FileText,
  Trash2,
  Search,
  SlidersHorizontal,
  Info,
  X,
  Volume2,
  VolumeX,
  Maximize2
} from 'lucide-react';
import { SourceVideoItem } from '../types';
import { api } from '../services/api';

interface VideoLibraryPageProps {
  videos: SourceVideoItem[];
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const VideoLibraryPage: React.FC<VideoLibraryPageProps> = ({ videos, onNavigate, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  
  // Modals state
  const [previewVideo, setPreviewVideo] = useState<SourceVideoItem | null>(null);
  const [inspectVideo, setInspectVideo] = useState<SourceVideoItem | null>(null);
  const [deleteConfirmVideo, setDeleteConfirmVideo] = useState<SourceVideoItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter and sort videos
  const filteredVideos = videos
    .filter((v) => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'duration_desc') return b.duration - a.duration;
      if (sortBy === 'duration_asc') return a.duration - b.duration;
      if (sortBy === 'size_desc') return b.file_size - a.file_size;
      if (sortBy === 'title_asc') return a.title.localeCompare(b.title);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const handleDelete = async () => {
    if (!deleteConfirmVideo) return;
    try {
      setIsDeleting(true);
      await api.deleteVideo(deleteConfirmVideo.id);
      setDeleteConfirmVideo(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete video');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Source Video Library</h2>
          <p className="text-xs text-gray-400">
            Validated videos saved in D:\AI-Shorts-Studio\storage\source_videos with FFprobe technical stream metadata.
          </p>
        </div>

        <button
          onClick={() => onNavigate('new-project')}
          className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20"
        >
          + Import New Video
        </button>
      </div>

      {/* Search & Sort Controls */}
      <div className="bg-surface rounded-xl p-3.5 border border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-lighter border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end text-xs">
          <span className="text-gray-400 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-surface-lighter border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer"
          >
            <option value="date_desc">Newest First</option>
            <option value="duration_desc">Longest Duration</option>
            <option value="duration_asc">Shortest Duration</option>
            <option value="size_desc">File Size (Largest)</option>
            <option value="title_asc">Title (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Videos Grid */}
      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((v) => (
            <div
              key={v.id}
              className="bg-surface rounded-xl overflow-hidden border border-surface-border shadow-sm flex flex-col group hover:border-brand-500/40 transition-all"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-10 h-10 text-gray-600" />
                )}

                {/* Duration Badge */}
                <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[11px] font-mono text-white border border-white/10">
                  {Math.floor(v.duration / 60)}:{(Math.floor(v.duration % 60)).toString().padStart(2, '0')}
                </div>

                {/* Aspect Ratio Badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-gray-300 border border-white/10">
                  {v.width}x{v.height} ({v.aspect_ratio || '16:9'})
                </div>

                {/* Play Overlay Button */}
                <button
                  onClick={() => setPreviewVideo(v)}
                  className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                  title="Preview Video"
                >
                  <Play className="w-4 h-4 ml-0.5" />
                </button>
              </div>

              {/* Video Info */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug" title={v.title}>
                    {v.title}
                  </h3>
                  
                  {/* Technical Stream Tags */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-surface-lighter text-gray-300 font-mono">
                      {v.codec || 'H.264'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-lighter text-gray-300 font-mono">
                      {v.fps} fps
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface-lighter text-gray-300">
                      {(v.file_size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      v.has_audio ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {v.has_audio ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                      <span>{v.audio_codec || (v.has_audio ? 'Audio' : 'No Audio')}</span>
                    </span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-2.5 border-t border-surface-border">
                  <button
                    onClick={() => setInspectVideo(v)}
                    className="p-1.5 rounded hover:bg-surface-lighter text-gray-400 hover:text-white text-xs flex items-center gap-1"
                    title="View Technical Metadata"
                  >
                    <Info className="w-3.5 h-3.5 text-brand-400" />
                    <span>Specs</span>
                  </button>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setDeleteConfirmVideo(v)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete Video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onNavigate('clip-finder')}
                      className="px-2.5 py-1 rounded bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-xs font-semibold border border-brand-500/20 flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Find Clips</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-3">
          <Film className="w-12 h-12 text-gray-600 mx-auto" />
          <div className="text-base font-bold text-white">No Videos Found</div>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {searchQuery
              ? `No videos match '${searchQuery}'. Try clearing your search.`
              : 'Import an authorized video file or YouTube URL to begin local processing.'}
          </p>
          <button
            onClick={() => onNavigate('new-project')}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
          >
            Import Video Now
          </button>
        </div>
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface-border rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white truncate max-w-lg">{previewVideo.title}</h3>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-lg hover:bg-surface-lighter text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <video
                src={previewVideo.preview_url || undefined}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <span>Resolution: {previewVideo.width}x{previewVideo.height}</span>
              <span>Codec: {previewVideo.codec}</span>
              <span>Duration: {Math.round(previewVideo.duration)}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Technical Specs Inspector Modal */}
      {inspectVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-brand-400" />
                FFprobe Technical Stream Specs
              </h3>
              <button
                onClick={() => setInspectVideo(null)}
                className="p-1 rounded hover:bg-surface-lighter text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">Title:</span>
                <span className="text-white font-medium truncate max-w-[280px]">{inspectVideo.title}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">Duration:</span>
                <span className="text-white font-mono">{inspectVideo.duration.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">Resolution:</span>
                <span className="text-white font-mono">{inspectVideo.width} × {inspectVideo.height}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">Aspect Ratio:</span>
                <span className="text-white font-mono">{inspectVideo.aspect_ratio || '16:9'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">Frame Rate:</span>
                <span className="text-white font-mono">{inspectVideo.fps} fps</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">Video Codec:</span>
                <span className="text-white font-mono uppercase">{inspectVideo.codec}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">Audio Codec:</span>
                <span className="text-white font-mono uppercase">{inspectVideo.audio_codec || 'None'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">File Size:</span>
                <span className="text-white font-mono">{(inspectVideo.file_size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-border">
                <span className="text-gray-400">Source Type:</span>
                <span className="text-brand-400 capitalize">{inspectVideo.source_type}</span>
              </div>
              {inspectVideo.channel_name && (
                <div className="flex justify-between py-1 border-b border-surface-border">
                  <span className="text-gray-400">Channel:</span>
                  <span className="text-white">{inspectVideo.channel_name}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectVideo(null)}
                className="px-4 py-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border text-xs text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              Confirm Video Deletion
            </h3>
            <p className="text-xs text-gray-300">
              Are you sure you want to delete <span className="font-semibold text-white">"{deleteConfirmVideo.title}"</span>?
            </p>
            <p className="text-[11px] text-gray-500">
              This will remove the source video from D:\AI-Shorts-Studio\storage\source_videos, delete its thumbnail, and remove the database record. This action cannot be undone.
            </p>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeleteConfirmVideo(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border text-xs text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Video'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
