import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  HardDrive,
  Film,
  Sparkles,
  Sliders,
  Check,
  RefreshCw,
  Folder,
  Layers,
  Save,
  CheckCircle2,
  AlertCircle,
  Zap,
  Globe,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { HardwareStatus } from '../types';
import { api } from '../services/api';

interface SettingsPageProps {
  hardware: HardwareStatus | null;
  onRefreshHardware: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ hardware, onRefreshHardware }) => {
  // Settings state
  const [whisperModel, setWhisperModel] = useState<string>('base');
  const [ollamaModel, setOllamaModel] = useState<string>('qwen2.5:3b');
  const [ollamaUrl, setOllamaUrl] = useState<string>('http://127.0.0.1:11434');
  const [hardwareAcceleration, setHardwareAcceleration] = useState<string>('cuda');
  const [defaultDuration, setDefaultDuration] = useState<number>(45);
  const [defaultFraming, setDefaultFraming] = useState<string>('auto_face');
  const [captionPreset, setCaptionPreset] = useState<string>('bold_creator');
  const [targetResolution, setTargetResolution] = useState<string>('1080x1920');
  const [storagePath, setStoragePath] = useState<string>('D:\\AI-Shorts-Studio');

  // Export options
  const [exportSubs, setExportSubs] = useState<boolean>(true);
  const [exportThumbs, setExportThumbs] = useState<boolean>(true);
  const [exportMeta, setExportMeta] = useState<boolean>(true);

  // Status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const s = await api.getSettings();
      if (s.whisper_model) setWhisperModel(s.whisper_model);
      if (s.ollama_model) setOllamaModel(s.ollama_model);
      if (s.ollama_url) setOllamaUrl(s.ollama_url);
      if (s.hardware_acceleration) setHardwareAcceleration(s.hardware_acceleration);
      if (s.default_clip_duration) setDefaultDuration(parseInt(s.default_clip_duration) || 45);
      if (s.default_framing) setDefaultFraming(s.default_framing);
      if (s.caption_preset) setCaptionPreset(s.caption_preset);
      if (s.target_resolution) setTargetResolution(s.target_resolution);
      if (s.storage_path) setStoragePath(s.storage_path);
      if (s.export_include_subtitles !== undefined) setExportSubs(Boolean(s.export_include_subtitles));
      if (s.export_include_thumbnails !== undefined) setExportThumbs(Boolean(s.export_include_thumbnails));
      if (s.export_include_metadata !== undefined) setExportMeta(Boolean(s.export_include_metadata));
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    setSavedSuccess(false);

    try {
      await api.saveSettings({
        whisper_model: whisperModel,
        ollama_model: ollamaModel,
        ollama_url: ollamaUrl,
        hardware_acceleration: hardwareAcceleration,
        default_clip_duration: defaultDuration,
        default_framing: defaultFraming,
        caption_preset: captionPreset,
        target_resolution: targetResolution,
        export_include_subtitles: exportSubs,
        export_include_thumbnails: exportThumbs,
        export_include_metadata: exportMeta
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save settings.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-brand-400" />
            <span>Studio Settings & Hardware Diagnostics</span>
          </h2>
          <p className="text-xs text-gray-400">
            Configure local Whisper speech recognition, Ollama LLM virality analysis, NVENC video encoding, and export preferences.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefreshHardware}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Diagnostics</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white shadow-md shadow-brand-500/20 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 text-accent-emerald text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Preferences saved and applied to local SQLite database!</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ======================================================== */}
        {/* Section 1: AI Model Preferences */}
        {/* ======================================================== */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-amber" />
            <span>Local AI Model Configuration</span>
          </h3>

          {/* Faster-Whisper Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-200 flex items-center justify-between">
              <span>Faster-Whisper Model Size</span>
              <span className="font-mono text-[10px] text-brand-400 font-normal">D:\AI-Shorts-Studio\storage\models</span>
            </label>
            <select
              value={whisperModel}
              onChange={(e) => setWhisperModel(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
            >
              <option value="tiny" className="bg-surface">tiny (~75 MB) — Ultra-fast, minimal memory</option>
              <option value="base" className="bg-surface">base (~145 MB, Recommended) — High speed & accurate speech-to-text</option>
              <option value="small" className="bg-surface">small (~480 MB) — Maximum precision for complex audio</option>
            </select>
            <p className="text-[11px] text-gray-400">
              Downloaded weights are stored strictly on Drive D: to preserve primary drive capacity.
            </p>
          </div>

          {/* Ollama LLM Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-200 flex items-center justify-between">
              <span>Ollama Virality Rubric Model</span>
              <span className="font-mono text-[10px] text-emerald-400 font-bold">ACTIVE</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="flex-1 bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Default model: <strong className="text-white">qwen2.5:3b</strong> (Quantized 1.93 GB local model on Drive D:).
            </p>
          </div>

          {/* Ollama Connection URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-200">Local Ollama API Endpoint</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none font-mono"
            />
          </div>
        </div>

        {/* ======================================================== */}
        {/* Section 2: Video Processing & Rendering Defaults */}
        {/* ======================================================== */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-accent-purple" />
            <span>Rendering & Framing Defaults</span>
          </h3>

          {/* Hardware Acceleration Preference */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-200">Hardware Acceleration Preference</label>
            <select
              value={hardwareAcceleration}
              onChange={(e) => setHardwareAcceleration(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
            >
              <option value="cuda" className="bg-surface">NVIDIA NVENC Hardware (h264_nvenc) — Fastest</option>
              <option value="auto" className="bg-surface">Auto-detect (NVENC with automatic CPU fallback)</option>
              <option value="cpu" className="bg-surface">Force CPU Encoding (libx264)</option>
            </select>
          </div>

          {/* Default Caption Preset */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-200">Default Animated Caption Preset</label>
            <select
              value={captionPreset}
              onChange={(e) => setCaptionPreset(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
            >
              <option value="bold_creator" className="bg-surface">Bold Creator (High-contrast yellow active highlight)</option>
              <option value="karaoke_highlight" className="bg-surface">Karaoke Highlight (Neon emerald glowing words)</option>
              <option value="clean_minimal" className="bg-surface">Clean Minimal (Soft blue subtle styling)</option>
              <option value="podcast_style" className="bg-surface">Podcast Style (Amber text with background backplate)</option>
              <option value="minimal_subtitle" className="bg-surface">Minimal Subtitle (Classic white bottom-third text)</option>
            </select>
          </div>

          {/* Default Framing Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-200">Default Vertical Framing Mode</label>
            <select
              value={defaultFraming}
              onChange={(e) => setDefaultFraming(e.target.value)}
              className="w-full bg-background border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
            >
              <option value="auto_face" className="bg-surface">Auto Face Tracking (YuNet DNN with Haar fallback)</option>
              <option value="center" className="bg-surface">Center Crop Fallback (Fixed center column)</option>
              <option value="manual" className="bg-surface">Manual Offset (Custom horizontal position)</option>
            </select>
          </div>

          {/* Default Short Duration */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-gray-200">Default Target Short Duration</span>
              <span className="font-mono text-brand-400 font-bold">{defaultDuration}s</span>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              step="5"
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(parseInt(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        </div>

        {/* ======================================================== */}
        {/* Section 3: Storage Root & Isolation */}
        {/* ======================================================== */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-brand-400" />
            <span>Storage & File Isolation</span>
          </h3>

          <div className="bg-surface-lighter/60 p-3.5 rounded-lg border border-surface-border space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Configured Storage Root:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                DRIVE D: ISOLATED
              </span>
            </div>
            <div className="font-mono text-white text-xs bg-background p-2 rounded border border-surface-border break-all">
              {storagePath}
            </div>
            <div className="text-[11px] text-gray-400 space-y-1 pt-1">
              <p>• Source Videos: <span className="font-mono text-gray-300">storage/source_videos/</span></p>
              <p>• Rendered Shorts: <span className="font-mono text-gray-300">storage/clips/</span></p>
              <p>• Model Weights: <span className="font-mono text-gray-300">storage/models/</span></p>
              <p>• SQLite Studio DB: <span className="font-mono text-gray-300">storage/studio.db</span></p>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Section 4: Export Bundle Defaults */}
        {/* ======================================================== */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Export & ZIP Defaults</span>
          </h3>

          <div className="space-y-3 text-xs text-gray-300">
            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={exportSubs}
                onChange={(e) => setExportSubs(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span>Include SRT and WebVTT Subtitles by default in ZIP exports</span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={exportThumbs}
                onChange={(e) => setExportThumbs(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span>Include High-Resolution Poster Thumbnails in exports</span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={exportMeta}
                onChange={(e) => setExportMeta(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span>Include Virality Metrics & Social Media Metadata in JSON</span>
            </label>

            <div className="pt-2 text-[11px] text-gray-400">
              Target output resolution is locked to <strong className="text-white">1080 × 1920</strong> (9:16 vertical standard) for YouTube Shorts and Instagram Reels.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;
