import React from 'react';
import { Film, Clock, HardDrive, Play, Sparkles, FileText, Trash2 } from 'lucide-react';
import { SourceVideoItem } from '../types';

interface VideoLibraryPageProps {
  videos: SourceVideoItem[];
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

export const VideoLibraryPage: React.FC<VideoLibraryPageProps> = ({ videos, onNavigate, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Source Video Library</h2>
          <p className="text-xs text-gray-400">
            All imported source videos stored in D:\AI-Shorts-Studio\storage\source_videos.
          </p>
        </div>

        <button
          onClick={() => onNavigate('new-project')}
          className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
        >
          + Import Video
        </button>
      </div>

      {videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((v) => (
            <div
              key={v.id}
              className="bg-surface rounded-xl overflow-hidden border border-surface-border shadow-sm flex flex-col"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video bg-surface-lighter flex items-center justify-center overflow-hidden">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-10 h-10 text-gray-600" />
                )}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                  {Math.floor(v.duration / 60)}:{(Math.floor(v.duration % 60)).toString().padStart(2, '0')}
                </div>
              </div>

              {/* Video Info */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white line-clamp-2" title={v.title}>
                    {v.title}
                  </h3>
                  <div className="text-[11px] text-gray-400 flex items-center gap-3">
                    <span>{v.width}x{v.height}</span>
                    <span>•</span>
                    <span>{(v.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                    <span>•</span>
                    <span className="capitalize text-brand-400">{v.source_type}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-surface-border">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {v.status}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onNavigate('transcript')}
                      title="View Transcript"
                      className="p-1.5 rounded hover:bg-surface-lighter text-gray-400 hover:text-white"
                    >
                      <FileText className="w-4 h-4" />
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
          <div className="text-base font-bold text-white">Your Video Library is Empty</div>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Import an authorized video file or YouTube URL to begin local transcription and AI moment identification.
          </p>
          <button
            onClick={() => onNavigate('new-project')}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
          >
            Import Video Now
          </button>
        </div>
      )}
    </div>
  );
};
