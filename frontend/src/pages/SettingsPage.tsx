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
  AlertTriangle,
  Zap,
  Globe,
  SlidersHorizontal,
  Info,
  Trash2,
  Archive,
  Download,
  RotateCcw,
  ShieldCheck,
  Database,
  FileText
} from 'lucide-react';
import { HardwareStatus, StorageStats, BackupItem, BackupValidationResult } from '../types';
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

  // Storage Stats & Cleanup
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isCleaningTemp, setIsCleaningTemp] = useState<boolean>(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  // Backup & Restore
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);
  const [backupIncludeMedia, setBackupIncludeMedia] = useState<boolean>(false);
  const [backupNotes, setBackupNotes] = useState<string>('');
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Restore validation dialog
  const [validatingBackup, setValidatingBackup] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadStorageStats();
    loadBackups();
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

  const loadStorageStats = async () => {
    try {
      const stats = await api.getStorageStats();
      setStorageStats(stats);
    } catch (err) {
      console.error('Failed to load storage stats:', err);
    }
  };

  const loadBackups = async () => {
    try {
      const res = await api.getBackups();
      setBackups(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load backups:', err);
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

  const handleCleanTemp = async () => {
    if (!window.confirm('Clean stale temporary files? This will remove expired upload chunks and intermediate rendering files without touching source videos, clips, or database records.')) {
      return;
    }
    setIsCleaningTemp(true);
    setCleanResult(null);
    try {
      const res = await api.cleanupTempFiles();
      setCleanResult(`Cleaned ${res.cleaned_count} temporary files, freed ${res.freed_mb} MB.`);
      await loadStorageStats();
      setTimeout(() => setCleanResult(null), 5000);
    } catch (err: any) {
      setCleanResult(`Cleanup error: ${err.message || 'Failed to clean temp files'}`);
    } finally {
      setIsCleaningTemp(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setBackupSuccess(null);
    setBackupError(null);
    try {
      const res = await api.createBackup(backupIncludeMedia, backupNotes);
      const sizeMb = (res.file_size_bytes || 0) / (1024 * 1024);
      setBackupSuccess(`Backup created: ${res.filename || 'archive'} (${sizeMb.toFixed(2)} MB)`);
      setBackupNotes('');
      await loadBackups();
      setTimeout(() => setBackupSuccess(null), 6000);
    } catch (err: any) {
      setBackupError(err.message || 'Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleInspectBackup = async (filename: string) => {
    setValidatingBackup(filename);
    setValidationResult(null);
    setRestoreError(null);
    setRestoreSuccess(null);
    try {
      const res = await api.validateBackup(filename);
      setValidationResult(res);
    } catch (err: any) {
      setRestoreError(`Failed to validate backup: ${err.message}`);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore "${filename}"? A safety backup of your current database will be saved before restoring.`)) {
      return;
    }
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);
    try {
      const res = await api.restoreBackup(filename, true);
      setRestoreSuccess(`Restored successfully! Safety backup saved to ${res.pre_restore_backup}. Reloading studio settings...`);
      setValidatingBackup(null);
      setValidationResult(null);
      await loadSettings();
      await loadStorageStats();
      setTimeout(() => setRestoreSuccess(null), 8000);
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
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
        {/* Section 3: Storage Root & Diagnostics */}
        {/* ======================================================== */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-brand-400" />
              <span>Storage & Disk Management</span>
            </h3>
            <button
              onClick={loadStorageStats}
              title="Refresh storage statistics"
              className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

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

            {/* Disk usage bar */}
            {storageStats && (
              <div className="space-y-1.5 pt-2 border-t border-surface-border/50">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-300">
                    Disk Free: <strong className="text-emerald-400 font-mono">{storageStats.disk.free_gb.toFixed(1)} GB</strong> / {storageStats.disk.total_gb.toFixed(1)} GB
                  </span>
                  <span className={`font-mono font-bold ${storageStats.is_low_space_warning ? 'text-red-400' : 'text-gray-400'}`}>
                    {storageStats.disk.used_percent.toFixed(1)}% Used
                  </span>
                </div>
                <div className="w-full bg-surface-border h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${storageStats.is_low_space_warning ? 'bg-red-500' : 'bg-brand-500'}`}
                    style={{ width: `${Math.min(100, storageStats.disk.used_percent)}%` }}
                  />
                </div>
                {storageStats.is_low_space_warning && (
                  <div className="flex items-center gap-1.5 text-[11px] text-red-400 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Low disk space warning! Free up space on Drive D: to avoid render failures.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Breakdown & Temp Cleanup */}
          {storageStats && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-200">Studio Space Breakdown:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-background/80 p-2 rounded border border-surface-border">
                  <span className="text-gray-400 block">Source Videos</span>
                  <span className="font-mono text-white font-bold">{(storageStats.breakdown.source_videos_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="bg-background/80 p-2 rounded border border-surface-border">
                  <span className="text-gray-400 block">Rendered Clips</span>
                  <span className="font-mono text-emerald-400 font-bold">{(storageStats.breakdown.clips_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="bg-background/80 p-2 rounded border border-surface-border">
                  <span className="text-gray-400 block">Model Weights</span>
                  <span className="font-mono text-amber-400 font-bold">{(storageStats.breakdown.models_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="bg-background/80 p-2 rounded border border-surface-border">
                  <span className="text-gray-400 block">Temp Files</span>
                  <span className="font-mono text-purple-400 font-bold">{(storageStats.breakdown.temp_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="bg-background/80 p-2 rounded border border-surface-border">
                  <span className="text-gray-400 block">Thumbnails</span>
                  <span className="font-mono text-cyan-400 font-bold">{(storageStats.breakdown.thumbnails_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                <div className="bg-background/80 p-2 rounded border border-surface-border">
                  <span className="text-gray-400 block">SQLite Database</span>
                  <span className="font-mono text-gray-300 font-bold">{(storageStats.breakdown.database_bytes / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              </div>

              {cleanResult && (
                <div className="p-2.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  <span>{cleanResult}</span>
                </div>
              )}

              <div className="pt-1 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">Total Studio Data: <strong className="text-white font-mono">{storageStats.total_studio_mb.toFixed(1)} MB</strong></span>
                <button
                  type="button"
                  onClick={handleCleanTemp}
                  disabled={isCleaningTemp}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-red-500/30 text-xs text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isCleaningTemp ? 'Cleaning...' : 'Clean Stale Temp Files'}</span>
                </button>
              </div>
            </div>
          )}
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

      {/* ======================================================== */}
      {/* Section 5: Studio Backup & Disaster Recovery (Full Width) */}
      {/* ======================================================== */}
      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Studio Backup & Disaster Recovery</span>
            </h3>
            <p className="text-xs text-gray-400 pt-0.5">
              Create complete, portable archives of your local SQLite database, settings, clip metadata, and media with automatic WAL checkpoints.
            </p>
          </div>

          <button
            onClick={loadBackups}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Backups</span>
          </button>
        </div>

        {backupSuccess && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{backupSuccess}</span>
          </div>
        )}

        {backupError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{backupError}</span>
          </div>
        )}

        {restoreSuccess && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{restoreSuccess}</span>
          </div>
        )}

        {restoreError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{restoreError}</span>
          </div>
        )}

        {/* Create Backup Form */}
        <div className="bg-background/60 p-4 rounded-lg border border-surface-border space-y-3">
          <div className="text-xs font-semibold text-white flex items-center gap-2">
            <Archive className="w-4 h-4 text-brand-400" />
            <span>Create New Studio Backup</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] text-gray-400">Backup Notes / Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Pre-upgrade checkpoint or project milestones"
                value={backupNotes}
                onChange={(e) => setBackupNotes(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex flex-col justify-end space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={backupIncludeMedia}
                  onChange={(e) => setBackupIncludeMedia(e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
                <span>Include media files (videos, clips)</span>
              </label>
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isCreatingBackup}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isCreatingBackup ? 'Creating Backup Archive...' : 'Create Studio Backup'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Validation / Restore Modal/Card */}
        {validatingBackup && (
          <div className="p-4 rounded-lg bg-surface-lighter/80 border border-brand-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-accent-amber" />
                <span>Restore Verification: {validatingBackup}</span>
              </div>
              <button
                onClick={() => {
                  setValidatingBackup(null);
                  setValidationResult(null);
                }}
                className="text-gray-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>

            {validationResult ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-background p-2 rounded border border-surface-border">
                    <span className="text-gray-400 block">Archive & DB Integrity:</span>
                    <span className={`font-bold ${validationResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                      {validationResult.valid ? 'PASSED (PRAGMA OK)' : 'FAILED'}
                    </span>
                  </div>
                  <div className="bg-background p-2 rounded border border-surface-border">
                    <span className="text-gray-400 block">Media Included:</span>
                    <span className="font-bold text-gray-200">{validationResult.include_media ? 'YES' : 'NO (DB Only)'}</span>
                  </div>
                  <div className="bg-background p-2 rounded border border-surface-border">
                    <span className="text-gray-400 block">App Version:</span>
                    <span className="font-mono text-white font-bold">{validationResult.app_version || '1.0.0'}</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-[11px] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Safety Warning Before Restoring:</span>
                  </div>
                  <p>
                    Restoring this backup will replace current database records with the backup state. A safety backup (.bak) of your current database will be saved automatically before restoration.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      setValidatingBackup(null);
                      setValidationResult(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRestoreBackup(validatingBackup)}
                    disabled={isRestoring || !validationResult.valid}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-amber hover:bg-amber-400 text-xs font-bold text-black transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isRestoring ? 'Restoring Database...' : 'Confirm & Restore Studio'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 py-2 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />
                <span>Validating ZIP structure and running PRAGMA integrity_check...</span>
              </div>
            )}
          </div>
        )}

        {/* Backups List */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-300 flex items-center justify-between">
            <span>Available Studio Backups ({backups.length})</span>
            <span className="text-[11px] text-gray-500 font-normal">Location: storage/exports/backups/</span>
          </div>

          {backups.length === 0 ? (
            <div className="p-4 rounded-lg bg-surface-lighter/30 border border-dashed border-surface-border text-center text-xs text-gray-400">
              No backups created yet. Click "Create Studio Backup" above to safeguard your projects and settings.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {backups.map((b) => (
                <div
                  key={b.filename}
                  className="p-3 rounded-lg bg-background/70 border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-white font-medium flex items-center gap-2">
                      <Archive className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                      <span>{b.filename}</span>
                      <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-surface border border-surface-border text-gray-300">
                        {((b.file_size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      {b.include_media && (
                        <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                          + Media
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-3">
                      <span>Created: {b.created_at ? new Date(b.created_at).toLocaleString() : 'N/A'}</span>
                      {b.notes && <span className="text-gray-300 italic">"{b.notes}"</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <a
                      href={api.getBackupDownloadUrl(b.filename)}
                      download={b.filename}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface border border-surface-border text-[11px] text-gray-300 hover:text-white hover:bg-surface-lighter transition-colors"
                      title="Download backup ZIP to disk"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                    <button
                      onClick={() => handleInspectBackup(b.filename)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface border border-amber-500/30 text-[11px] text-amber-300 hover:bg-amber-500/10 transition-colors"
                      title="Verify and restore database from this backup"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;
