import React, { useState } from 'react';
import {
  UploadCloud,
  FileVideo,
  Sparkles,
  Check,
  AlertCircle,
  Clock,
  Globe,
  Video,
  Search,
  Eye,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Info
} from 'lucide-react';
import { api } from '../services/api';

interface NewProjectPageProps {
  onProjectCreated: (projectId: string) => void;
}

export const NewProjectPage: React.FC<NewProjectPageProps> = ({ onProjectCreated }) => {
  const [importMode, setImportMode] = useState<'upload' | 'youtube'>('upload');
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  
  // Local File Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // YouTube Inspection state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectedMeta, setInspectedMeta] = useState<any | null>(null);
  const [userAuthorized, setUserAuthorized] = useState(false);

  // General state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validExtensions = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validExtensions.includes(ext)) {
        setErrorMsg(`Unsupported file type '${ext}'. Please select an MP4, MOV, MKV, WebM, or AVI video.`);
        setSelectedFile(null);
        return;
      }

      setErrorMsg(null);
      setSelectedFile(file);
      if (!projectName) {
        setProjectName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleInspectYouTube = async () => {
    if (!youtubeUrl.trim()) {
      setErrorMsg('Please enter a YouTube video URL to inspect.');
      return;
    }
    setErrorMsg(null);
    setIsInspecting(true);
    setInspectedMeta(null);

    try {
      const data = await api.inspectYouTube(youtubeUrl.trim());
      setInspectedMeta(data);
      if (!projectName && data.title) {
        setProjectName(data.title);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not retrieve metadata for this YouTube URL.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = projectName.trim() || (importMode === 'youtube' ? inspectedMeta?.title || 'YouTube Project' : selectedFile?.name || 'New Project');

    if (importMode === 'upload') {
      if (!selectedFile) {
        setErrorMsg('Please select a local video file to upload.');
        return;
      }

      try {
        setIsUploading(true);
        // 1. Create the project container first
        setUploadStatusText('Creating project record...');
        const proj = await api.createProject(name, projectDesc);

        // 2. Stream chunked upload with progress
        await api.uploadChunkedVideo(proj.id, selectedFile, (pct, status) => {
          setUploadProgress(pct);
          setUploadStatusText(status);
        });

        onProjectCreated(proj.id);
      } catch (err: any) {
        setErrorMsg(err.message || 'Upload failed');
        setIsUploading(false);
      }
    } else {
      // YouTube mode
      if (!youtubeUrl.trim()) {
        setErrorMsg('Please enter a valid YouTube video URL.');
        return;
      }
      if (!inspectedMeta) {
        setErrorMsg('Please click "Inspect URL" first to validate the video source.');
        return;
      }
      if (!userAuthorized) {
        setErrorMsg('Please confirm you own or have permission/authorization to process this video.');
        return;
      }

      try {
        setIsUploading(true);
        setUploadStatusText('Creating project and downloading authorized YouTube video...');
        const proj = await api.createProject(name, projectDesc);

        await api.importYouTube(proj.id, youtubeUrl.trim(), userAuthorized);
        onProjectCreated(proj.id);
      } catch (err: any) {
        setErrorMsg(err.message || 'YouTube import failed');
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Import Video & Create Project</h2>
        <p className="text-xs text-gray-400">
          Upload large video files with reliable chunking or inspect authorized YouTube videos. Videos and technical metadata are saved on D:\AI-Shorts-Studio.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">Import Notice:</span>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Details */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-gray-200">1. Project Metadata</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">Project Name</label>
              <input
                type="text"
                placeholder="e.g. Modern AI SaaS Walkthrough"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={isUploading}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">Description / Topic Notes</label>
              <input
                type="text"
                placeholder="e.g. Focus on product demo highlights"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                disabled={isUploading}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Video Source Selection */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-gray-200">2. Video Source</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => { setImportMode('upload'); setErrorMsg(null); }}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                importMode === 'upload'
                  ? 'bg-brand-600/15 border-brand-500 text-white shadow-sm'
                  : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-6 h-6 text-brand-400" />
              <div className="text-xs font-bold">Local Video Upload</div>
              <div className="text-[10px] text-gray-500">MP4, MOV, MKV, WebM, AVI</div>
            </button>

            <button
              type="button"
              disabled={isUploading}
              onClick={() => { setImportMode('youtube'); setErrorMsg(null); }}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                importMode === 'youtube'
                  ? 'bg-brand-600/15 border-brand-500 text-white shadow-sm'
                  : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
              }`}
            >
              <Video className="w-6 h-6 text-red-500" />
              <div className="text-xs font-bold">YouTube URL</div>
              <div className="text-[10px] text-gray-500">Inspect & Import Authorized URL</div>
            </button>
          </div>

          {importMode === 'upload' ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-surface-border hover:border-brand-500/50 rounded-xl p-8 text-center transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  accept=".mp4,.mov,.mkv,.webm,.avi,video/*"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="hidden"
                />
                <label htmlFor="file-upload" className={`space-y-2 block ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <FileVideo className="w-10 h-10 text-brand-400 mx-auto" />
                  <div className="text-sm font-semibold text-white">
                    {selectedFile ? selectedFile.name : 'Click to select or drag and drop video'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {selectedFile
                      ? `File size: ${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                      : 'Supports MP4, MOV, MKV, WebM, and AVI. Streamed chunk-by-chunk to D:\\AI-Shorts-Studio.'}
                  </div>
                </label>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="bg-surface-lighter p-4 rounded-xl border border-surface-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-semibold">{uploadStatusText}</span>
                    <span className="font-mono text-brand-400 font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-surface-border rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-brand-600 to-accent-purple h-full rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    setInspectedMeta(null);
                  }}
                  disabled={isUploading || isInspecting}
                  className="flex-1 bg-surface-lighter border border-surface-border rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleInspectYouTube}
                  disabled={isInspecting || isUploading || !youtubeUrl.trim()}
                  className="px-4 py-2.5 rounded-lg bg-surface-lighter hover:bg-surface-border border border-surface-border text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isInspecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>{isInspecting ? 'Inspecting...' : 'Inspect URL'}</span>
                </button>
              </div>

              {/* Inspected YouTube Metadata Preview */}
              {inspectedMeta && (
                <div className="bg-surface-lighter/70 p-4 rounded-xl border border-surface-border space-y-3">
                  <div className="flex items-center space-x-2 text-accent-emerald text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Public Video Metadata Retrieved</span>
                  </div>

                  <div className="flex gap-4">
                    {inspectedMeta.thumbnail_url && (
                      <div className="w-36 h-20 bg-black rounded-lg overflow-hidden shrink-0">
                        <img src={inspectedMeta.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-sm font-bold text-white line-clamp-1">{inspectedMeta.title}</h4>
                      <div className="text-xs text-gray-400">Channel: <span className="text-gray-200">{inspectedMeta.channel_name}</span></div>
                      <div className="text-xs text-gray-400 flex items-center gap-3">
                        <span>Duration: {Math.floor(inspectedMeta.duration_seconds / 60)}:{(Math.floor(inspectedMeta.duration_seconds % 60)).toString().padStart(2, '0')}</span>
                        <span>•</span>
                        <span>Views: {inspectedMeta.view_count.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Authorization & Ownership Checkbox */}
                  <div className="pt-2 border-t border-surface-border">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-300">
                      <input
                        type="checkbox"
                        checked={userAuthorized}
                        onChange={(e) => setUserAuthorized(e.target.checked)}
                        className="mt-0.5 rounded border-surface-border text-brand-600 focus:ring-0 cursor-pointer"
                      />
                      <span>
                        I confirm that I own this video or have appropriate authorization / permission to transcribe and edit this content.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="bg-surface-lighter p-4 rounded-xl border border-surface-border flex items-center gap-3 text-xs text-brand-400">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{uploadStatusText}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Action */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="submit"
            disabled={isUploading || (importMode === 'upload' && !selectedFile) || (importMode === 'youtube' && (!inspectedMeta || !userAuthorized))}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-95 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Video...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Validate & Ingest Video</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
