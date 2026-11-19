import React, { useState } from 'react';
import {
  Download,
  Archive,
  FileText,
  Image,
  FileCode,
  HardDrive,
  CheckSquare,
  Square,
  Trash2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { ClipItem, ProjectItem } from '../types';
import { api } from '../services/api';

interface DownloadsPageProps {
  clips: ClipItem[];
  projects: ProjectItem[];
  storageUsedMb: number;
  onRefresh: () => void;
}

export const DownloadsPage: React.FC<DownloadsPageProps> = ({
  clips,
  projects,
  storageUsedMb,
  onRefresh
}) => {
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');

  const toggleSelectClip = (id: string) => {
    setSelectedClipIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedClipIds.length === clips.length) {
      setSelectedClipIds([]);
    } else {
      setSelectedClipIds(clips.map(c => c.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Dedicated Download Center</h2>
          <p className="text-xs text-gray-400">
            Export and download ready-to-publish MP4s, animated SRT subtitles, thumbnails, and complete project ZIP archives.
          </p>
        </div>

        {/* Storage footprint badge */}
        <div className="flex items-center space-x-2 bg-surface px-3 py-1.5 rounded-lg border border-surface-border text-xs">
          <HardDrive className="w-4 h-4 text-accent-amber" />
          <span className="text-gray-400">Storage Used:</span>
          <span className="font-mono text-white font-bold">{storageUsedMb} MB</span>
          <span className="text-[10px] text-gray-500 font-mono">(D:\AI-Shorts-Studio)</span>
        </div>
      </div>

      {/* Bulk Project Export Package Banner */}
      <div className="bg-gradient-to-r from-brand-900/30 via-surface to-surface-lighter rounded-xl p-5 border border-brand-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Archive className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Complete Project ZIP Package</h3>
          </div>
          <p className="text-xs text-gray-400 max-w-xl">
            Bundles all rendered vertical MP4 videos, synchronized SRT subtitles, thumbnails, and AI titles/descriptions/hashtags into one structured ZIP archive.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface text-gray-200">
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <a
            href={selectedProjectId ? api.getProjectZipUrl(selectedProjectId) : '#'}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-md shadow-brand-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Download Project ZIP</span>
          </a>
        </div>
      </div>

      {/* Downloads Table */}
      <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={selectAll}
              className="flex items-center space-x-2 text-xs text-gray-300 hover:text-white"
            >
              {selectedClipIds.length === clips.length && clips.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-brand-400" />
              ) : (
                <Square className="w-4 h-4 text-gray-500" />
              )}
              <span>Select All ({clips.length})</span>
            </button>

            {selectedClipIds.length > 0 && (
              <span className="text-xs text-brand-400 font-semibold">
                {selectedClipIds.length} clip(s) selected
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border text-gray-400 hover:text-white"
              title="Refresh list"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Body */}
        {clips.length > 0 ? (
          <div className="divide-y divide-surface-border">
            {clips.map((clip) => {
              const isSelected = selectedClipIds.includes(clip.id);
              return (
                <div
                  key={clip.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    isSelected ? 'bg-brand-500/5' : 'hover:bg-surface-lighter/50'
                  }`}
                >
                  <div className="flex items-center space-x-4 min-w-0">
                    <button onClick={() => toggleSelectClip(clip.id)}>
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-brand-400" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {/* Thumbnail preview */}
                    <div className="w-14 h-20 bg-black rounded-lg border border-surface-border overflow-hidden shrink-0 flex items-center justify-center">
                      {clip.thumbnail_url ? (
                        <img src={clip.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Download className="w-5 h-5 text-gray-600" />
                      )}
                    </div>

                    {/* Clip Info */}
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate max-w-md">
                        {clip.title}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-3">
                        <span>Duration: {Math.round(clip.duration)}s</span>
                        <span>•</span>
                        <span>Format: 1080x1920 (9:16 MP4)</span>
                        <span>•</span>
                        <span className="text-accent-emerald font-semibold">Score: {clip.overall_score}/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Download Action Buttons */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Download MP4 */}
                    <a
                      href={api.getClipMp4Url(clip.id)}
                      download
                      className="px-3 py-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border border border-surface-border text-xs font-semibold text-white flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-brand-400" />
                      <span>MP4</span>
                    </a>

                    {/* Download SRT */}
                    <a
                      href={api.getClipSrtUrl(clip.id)}
                      download
                      className="p-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border border border-surface-border text-gray-400 hover:text-white"
                      title="Download Subtitles (.SRT)"
                    >
                      <FileText className="w-4 h-4" />
                    </a>

                    {/* Download Thumbnail */}
                    <a
                      href={api.getClipThumbUrl(clip.id)}
                      download
                      className="p-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border border border-surface-border text-gray-400 hover:text-white"
                      title="Download Thumbnail (.JPG)"
                    >
                      <Image className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500 text-xs space-y-2">
            <Download className="w-10 h-10 text-gray-600 mx-auto" />
            <div className="text-sm font-bold text-white">No Rendered Clips to Download Yet</div>
            <p className="max-w-sm mx-auto">
              Once you process a video and approve clips, individual MP4s and subtitle packages are immediately saved to D:\AI-Shorts-Studio\storage\clips.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
