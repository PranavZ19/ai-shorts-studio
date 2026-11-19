import React, { useState } from 'react';
import {
  UploadCloud,
  FileVideo,
  Sparkles,
  Sliders,
  Check,
  AlertCircle,
  Clock,
  Globe,
  Video
} from 'lucide-react';
import { api } from '../services/api';

interface NewProjectPageProps {
  onProjectCreated: (projectId: string) => void;
}

export const NewProjectPage: React.FC<NewProjectPageProps> = ({ onProjectCreated }) => {
  const [importMode, setImportMode] = useState<'upload' | 'youtube'>('upload');
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetDuration, setTargetDuration] = useState('60');
  const [clipPreset, setClipPreset] = useState('best_moments');
  const [language, setLanguage] = useState('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!projectName) {
        setProjectName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const name = projectName.trim() || (importMode === 'youtube' ? 'YouTube Project' : selectedFile?.name || 'New Project');

    if (importMode === 'upload' && !selectedFile) {
      setErrorMsg('Please select a local video file to upload.');
      return;
    }

    if (importMode === 'youtube' && !youtubeUrl.trim()) {
      setErrorMsg('Please enter a valid YouTube video URL.');
      return;
    }

    try {
      setIsSubmitting(true);
      const proj = await api.createProject(name, projectDesc);
      onProjectCreated(proj.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create project');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Create New Shorts Project</h2>
        <p className="text-xs text-gray-400">
          Upload a local video or input an authorized YouTube link. All AI transcription, face framing, and clipping run 100% locally on your machine.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Name and Details */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-gray-200">1. Project Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">Project Name</label>
              <input
                type="text"
                placeholder="e.g. Lex Fridman Podcast Highlights"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400">Description / Topic (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Focus on tech and entrepreneurship tips"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Video Import Mode Selector */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-gray-200">2. Video Source</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setImportMode('upload')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                importMode === 'upload'
                  ? 'bg-brand-600/15 border-brand-500 text-white shadow-sm'
                  : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-6 h-6 text-brand-400" />
              <div className="text-xs font-bold">Local Video Upload</div>
              <div className="text-[10px] text-gray-500">MP4, MOV, MKV, AVI, WEBM</div>
            </button>

            <button
              type="button"
              onClick={() => setImportMode('youtube')}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                importMode === 'youtube'
                  ? 'bg-brand-600/15 border-brand-500 text-white shadow-sm'
                  : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
              }`}
            >
              <Video className="w-6 h-6 text-red-500" />
              <div className="text-xs font-bold">YouTube URL</div>
              <div className="text-[10px] text-gray-500">Authorized video links</div>
            </button>
          </div>

          {importMode === 'upload' ? (
            <div className="border-2 border-dashed border-surface-border hover:border-brand-500/50 rounded-xl p-8 text-center transition-colors">
              <input
                type="file"
                id="file-upload"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
                <FileVideo className="w-10 h-10 text-brand-400 mx-auto" />
                <div className="text-sm font-semibold text-white">
                  {selectedFile ? selectedFile.name : 'Click to select or drag and drop video'}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedFile
                    ? `File size: ${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                    : 'Up to 4K resolution supported. Files are saved in D:\\AI-Shorts-Studio'}
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400">YouTube Video Link</label>
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors font-mono text-xs"
              />
              <p className="text-[11px] text-gray-500">
                Metadata, duration, and stream accessibility are automatically validated.
              </p>
            </div>
          )}
        </div>

        {/* AI Clipping & Formatting Preferences */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-gray-200">3. AI Clipping & Caption Preferences</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Target Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                Target Clip Duration
              </label>
              <select
                value={targetDuration}
                onChange={(e) => setTargetDuration(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                <option value="30">30 seconds (Quick punchy)</option>
                <option value="45">45 seconds (Balanced hook)</option>
                <option value="60">60 seconds (Standard YouTube Short)</option>
                <option value="90">90 seconds (Reels & TikTok)</option>
                <option value="120">120 seconds (Deep-dive short)</option>
              </select>
            </div>

            {/* AI Clip Style */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
                AI Moment Focus
              </label>
              <select
                value={clipPreset}
                onChange={(e) => setClipPreset(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                <option value="best_moments">Best Overall High-Retention Moments</option>
                <option value="hooks">Strongest Opening Hooks</option>
                <option value="motivational">Motivational & Inspiring Thoughts</option>
                <option value="educational">Educational Insights & Tips</option>
                <option value="facts">Surprising Statements & Facts</option>
                <option value="funny">Funny & Lighthearted Moments</option>
              </select>
            </div>

            {/* Spoken Language */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-accent-emerald" />
                Speech Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none"
              >
                <option value="auto">Auto Detect Language (Whisper)</option>
                <option value="en">English</option>
                <option value="hi">Hindi (हिंदी)</option>
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
                <option value="de">German (Deutsch)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-95 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 flex items-center space-x-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Creating Project...' : 'Initialize & Analyze Project'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
