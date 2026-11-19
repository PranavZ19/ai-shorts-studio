import React, { useState, useMemo } from 'react';
import {
  Download,
  Archive,
  FileText,
  Image as ImageIcon,
  FileCode,
  HardDrive,
  CheckSquare,
  Square,
  RefreshCw,
  Search,
  Check,
  FolderArchive,
  Layers,
  Sparkles,
  ExternalLink,
  Film,
  Info
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [includeSourceInProject, setIncludeSourceInProject] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);

  // Bulk options
  const [includeSubtitles, setIncludeSubtitles] = useState<boolean>(true);
  const [includeThumbnails, setIncludeThumbnails] = useState<boolean>(true);
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true);
  const [packageName, setPackageName] = useState<string>('My_Shorts_Bundle');
  const [downloadingBulk, setDownloadingBulk] = useState<boolean>(false);
  const [bulkDownloadSuccess, setBulkDownloadSuccess] = useState<boolean>(false);

  // Filter completed clips
  const completedClips = useMemo(() => {
    return clips
      .filter((c) => Boolean(c.has_rendered_video || c.output_path))
      .filter((c) => {
        if (selectedProjectId && c.project_id !== selectedProjectId) return false;
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(term) ||
          (c.source_title && c.source_title.toLowerCase().includes(term))
        );
      });
  }, [clips, selectedProjectId, search]);

  const totalCompletedBytes = useMemo(() => {
    return completedClips.reduce((acc, c) => acc + (c.file_size_bytes || 0), 0);
  }, [completedClips]);

  const toggleSelectClip = (id: string) => {
    setSelectedClipIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedClipIds.length === completedClips.length) {
      setSelectedClipIds([]);
    } else {
      setSelectedClipIds(completedClips.map((c) => c.id));
    }
  };

  const handleDownloadBulk = () => {
    if (!selectedClipIds.length) return;
    setDownloadingBulk(true);
    setBulkDownloadSuccess(false);

    // Direct browser download URL trigger
    const url = api.getBulkZipUrl(selectedClipIds, includeSubtitles, includeThumbnails);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${packageName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingBulk(false);
      setBulkDownloadSuccess(true);
      setTimeout(() => setBulkDownloadSuccess(false), 3000);
    }, 1200);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Dedicated Download & Export Center</span>
          </h2>
          <p className="text-xs text-gray-400">
            Export standalone vertical MP4s, subtitle tracks (SRT & WebVTT), high-res thumbnails, and comprehensive project ZIP archives.
          </p>
        </div>

        {/* Global Storage & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-surface px-3 py-1.5 rounded-lg border border-surface-border text-xs">
            <HardDrive className="w-4 h-4 text-accent-amber" />
            <span className="text-gray-400">Storage Footprint:</span>
            <span className="font-mono text-white font-bold">{storageUsedMb} MB</span>
            <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">(D:\AI-Shorts-Studio)</span>
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-surface border border-surface-border text-gray-400 hover:text-white transition-colors"
            title="Refresh Downloads"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-1">
          <span className="text-[11px] text-gray-400 uppercase font-mono">Ready to Download</span>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <span>{completedClips.length}</span>
            <span className="text-xs text-gray-400 font-normal">rendered clips</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-1">
          <span className="text-[11px] text-gray-400 uppercase font-mono">Downloadable Video Volume</span>
          <div className="text-2xl font-bold text-emerald-400">
            {formatFileSize(totalCompletedBytes)}
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-surface-border space-y-1">
          <span className="text-[11px] text-gray-400 uppercase font-mono">Export Target Format</span>
          <div className="text-2xl font-bold text-brand-400">
            1080×1920 <span className="text-xs font-mono font-normal text-gray-300">(H.264 / AAC)</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: FULL PROJECT EXPORT ARCHIVE (Requirement 5) */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-brand-950/40 via-surface to-surface-lighter rounded-xl p-5 border border-brand-500/30 space-y-4 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <FolderArchive className="w-5 h-5 text-brand-400" />
              <h3 className="text-sm font-bold text-white">Full Project Backup & Export Package</h3>
            </div>
            <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
              Creates a self-contained ZIP archive including all rendered 9:16 vertical shorts, transcripts with word timestamps, subtitle files (SRT & WebVTT), thumbnails, AI metadata JSON, and master project configuration.
            </p>
          </div>

          {/* Project Selector & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {projects.length > 0 && (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-surface text-gray-200">
                    Project: {p.name}
                  </option>
                ))}
              </select>
            )}

            <a
              href={selectedProjectId ? api.getProjectZipUrl(selectedProjectId, includeSourceInProject) : '#'}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center space-x-2 shadow-md shadow-brand-500/20 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Project ZIP</span>
            </a>
          </div>
        </div>

        {/* Project Export Options & Structure Preview */}
        <div className="pt-3 border-t border-surface-border flex flex-wrap items-center justify-between gap-4 text-xs text-gray-300">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSourceInProject}
              onChange={(e) => setIncludeSourceInProject(e.target.checked)}
              className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
            />
            <span>Include original full-length source video in ZIP (Significantly increases file size)</span>
          </label>

          <div className="flex items-center space-x-2 font-mono text-[11px] text-gray-400">
            <span className="text-brand-400">ZIP Architecture:</span>
            <span>videos/ • subtitles/ • thumbnails/ • transcripts/ • README.txt</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: BATCH SELECTION & BULK ZIP DOWNLOAD */}
      {/* ======================================================== */}
      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Archive className="w-4 h-4 text-emerald-400" />
              <span>Custom Selected Shorts Downloader</span>
            </h3>
            <p className="text-xs text-gray-400">
              Select any combination of completed shorts below and bundle them into a single clean ZIP download.
            </p>
          </div>

          {/* Action Button */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="Package ZIP name..."
              className="px-3 py-1.5 bg-background border border-surface-border rounded-lg text-xs text-white outline-none w-44"
            />

            <button
              onClick={handleDownloadBulk}
              disabled={selectedClipIds.length === 0 || downloadingBulk}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center space-x-2 shadow transition-all ${
                selectedClipIds.length === 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {downloadingBulk ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Preparing Archive...</span>
                </>
              ) : bulkDownloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Download Initiated!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Selected ({selectedClipIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bulk Bundle Inclusion Checkboxes */}
        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-surface-border text-xs text-gray-300">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSubtitles}
              onChange={(e) => setIncludeSubtitles(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
            <FileText className="w-3.5 h-3.5 text-brand-400" />
            <span>Include Subtitles (SRT + WebVTT)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeThumbnails}
              onChange={(e) => setIncludeThumbnails(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
            <ImageIcon className="w-3.5 h-3.5 text-accent-amber" />
            <span>Include Poster Thumbnails (JPEG)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span>Include AI JSON Metadata & Virality Scores</span>
          </label>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: COMPLETED CLIPS DOWNLOAD TABLE */}
      {/* ======================================================== */}
      <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
        {/* Table Filter / Search Header */}
        <div className="p-3 bg-surface border-b border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={selectAll}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              {completedClips.length > 0 && selectedClipIds.length === completedClips.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-gray-500" />
              )}
              <span>Select All ({completedClips.length})</span>
            </button>

            {selectedClipIds.length > 0 && (
              <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                {selectedClipIds.length} of {completedClips.length} selected
              </span>
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search ready videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-surface-border rounded-lg text-xs text-white placeholder-gray-500 outline-none"
            />
          </div>
        </div>

        {/* Clips Table */}
        {completedClips.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background text-gray-400 uppercase text-[10px] font-mono border-b border-surface-border">
                <tr>
                  <th className="p-3 w-10 text-center"></th>
                  <th className="p-3">Video / Short</th>
                  <th className="p-3">Timing & Format</th>
                  <th className="p-3">File Size</th>
                  <th className="p-3">Virality Score</th>
                  <th className="p-3 text-right">Individual Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {completedClips.map((clip) => {
                  const isSelected = selectedClipIds.includes(clip.id);

                  return (
                    <tr
                      key={clip.id}
                      className={`hover:bg-surface-lighter/50 transition-colors ${
                        isSelected ? 'bg-surface-lighter/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleSelectClip(clip.id)}
                          className="text-gray-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </td>

                      {/* Video Thumbnail & Title */}
                      <td className="p-3">
                        <div className="flex items-center space-x-3">
                          <div className="relative w-12 h-16 bg-black rounded overflow-hidden flex-shrink-0 border border-gray-800">
                            {clip.thumbnail_url ? (
                              <img
                                src={clip.thumbnail_url}
                                alt={clip.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Film className="w-5 h-5 text-gray-500 m-auto mt-5" />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="font-semibold text-white line-clamp-1 max-w-sm">
                              {clip.title}
                            </h4>
                            <p className="text-[11px] text-gray-400 line-clamp-1">
                              {clip.source_title || 'Source Video'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Timing & Format */}
                      <td className="p-3 space-y-0.5">
                        <div className="font-mono text-gray-200">
                          {Math.round(clip.duration)}s ({clip.start_time}s - {clip.end_time}s)
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {clip.resolution || '1080x1920'} • 30fps
                        </div>
                      </td>

                      {/* File Size */}
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {formatFileSize(clip.file_size_bytes)}
                      </td>

                      {/* Virality Score */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30 text-[11px] font-bold">
                          {clip.overall_score}/100
                        </span>
                      </td>

                      {/* Individual Download Buttons */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* MP4 */}
                          <a
                            href={api.getClipMp4Url(clip.id, true)}
                            className="px-2.5 py-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white font-medium flex items-center gap-1 shadow-sm"
                            title="Download Final MP4 Video"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>MP4</span>
                          </a>

                          {/* SRT */}
                          <a
                            href={api.getClipSrtUrl(clip.id)}
                            className="p-1.5 rounded bg-surface-lighter hover:bg-gray-700 text-gray-300 hover:text-white"
                            title="Download SRT Subtitles"
                          >
                            <FileText className="w-3.5 h-3.5 text-brand-400" />
                          </a>

                          {/* VTT */}
                          <a
                            href={api.getClipVttUrl(clip.id)}
                            className="p-1.5 rounded bg-surface-lighter hover:bg-gray-700 text-gray-300 hover:text-white"
                            title="Download WebVTT Subtitles"
                          >
                            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                          </a>

                          {/* Thumbnail */}
                          <a
                            href={api.getClipThumbUrl(clip.id, true)}
                            className="p-1.5 rounded bg-surface-lighter hover:bg-gray-700 text-gray-300 hover:text-white"
                            title="Download Poster Thumbnail"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-accent-amber" />
                          </a>

                          {/* Metadata */}
                          <a
                            href={api.getClipMetadataUrl(clip.id)}
                            className="p-1.5 rounded bg-surface-lighter hover:bg-gray-700 text-gray-300 hover:text-white"
                            title="Download JSON Metadata"
                          >
                            <Info className="w-3.5 h-3.5 text-sky-400" />
                          </a>

                          {/* Single Clip ZIP */}
                          <a
                            href={api.getClipZipUrl(clip.id)}
                            className="p-1.5 rounded bg-surface-lighter hover:bg-gray-700 text-gray-300 hover:text-white"
                            title="Download Single Clip Package (ZIP)"
                          >
                            <Archive className="w-3.5 h-3.5 text-brand-300" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center space-y-3">
            <Film className="w-10 h-10 text-gray-600 mx-auto" />
            <h4 className="text-sm font-bold text-white">No Rendered Videos Ready for Download</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Once clips are edited and rendered in the Clip Editor, their finalized vertical MP4s, subtitles, and thumbnails will appear here for instant download.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
export default DownloadsPage;
