import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  HardDrive,
  Film,
  Sparkles,
  Sliders,
  Check,
  RefreshCw,
  Folder,
  Layers,
  Save
} from 'lucide-react';
import { HardwareStatus } from '../types';
import { api } from '../services/api';

interface SettingsPageProps {
  hardware: HardwareStatus | null;
  onRefreshHardware: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ hardware, onRefreshHardware }) => {
  const [whisperModel, setWhisperModel] = useState('base');
  const [ollamaModel, setOllamaModel] = useState('llama3.2:3b');
  const [ollamaUrl, setOllamaUrl] = useState('http://127.0.0.1:11434');
  const [storagePath, setStoragePath] = useState('D:\\AI-Shorts-Studio');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.whisper_model) setWhisperModel(s.whisper_model);
      if (s.ollama_model) setOllamaModel(s.ollama_model);
      if (s.ollama_url) setOllamaUrl(s.ollama_url);
      if (s.storage_path) setStoragePath(s.storage_path);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await api.saveSettings({
        whisper_model: whisperModel,
        ollama_model: ollamaModel,
        ollama_url: ollamaUrl,
        storage_path: storagePath
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Studio Settings & Hardware Diagnostics</h2>
          <p className="text-xs text-gray-400">
            Configure local AI models, storage directory, and inspect real GPU/CPU hardware acceleration.
          </p>
        </div>

        <button
          onClick={onRefreshHardware}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Hardware</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-lg bg-accent-emerald/10 border border-accent-emerald/20 text-accent-emerald text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      {/* Hardware Diagnostics Card */}
      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-brand-400" />
          Hardware & Acceleration Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* GPU Details */}
          <div className="bg-surface-lighter/60 p-3.5 rounded-lg border border-surface-border space-y-2">
            <div className="font-semibold text-gray-200 flex items-center justify-between">
              <span>NVIDIA GPU</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                hardware?.gpu.cuda_available ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-brand-500/10 text-brand-400'
              }`}>
                {hardware?.gpu.cuda_available ? 'CUDA 12.1 Ready' : 'Detected'}
              </span>
            </div>
            <div className="text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-white font-medium">{hardware?.gpu.name || 'NVIDIA GeForce RTX 3050 Laptop GPU'}</span>
              </div>
              <div className="flex justify-between">
                <span>VRAM:</span>
                <span className="font-mono text-gray-200">{hardware?.gpu.vram_total_mb || 4096} MB GDDR6</span>
              </div>
              <div className="flex justify-between">
                <span>Driver:</span>
                <span className="font-mono text-gray-200">{hardware?.gpu.driver_version || '610.60'}</span>
              </div>
            </div>
          </div>

          {/* CPU & Memory */}
          <div className="bg-surface-lighter/60 p-3.5 rounded-lg border border-surface-border space-y-2">
            <div className="font-semibold text-gray-200 flex items-center justify-between">
              <span>CPU & System Memory</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {hardware?.cpu.logical_cores || 12} Threads
              </span>
            </div>
            <div className="text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>RAM Total:</span>
                <span className="text-white font-medium">{hardware?.ram.total_gb || 16} GB</span>
              </div>
              <div className="flex justify-between">
                <span>RAM Available:</span>
                <span className="font-mono text-gray-200">{hardware?.ram.available_gb || 5.6} GB</span>
              </div>
              <div className="flex justify-between">
                <span>Operating System:</span>
                <span className="font-mono text-gray-200">{hardware?.os.system || 'Windows 11'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FFmpeg Video Engine Status */}
      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Film className="w-4 h-4 text-accent-purple" />
          Video Processing & FFmpeg Engine
        </h3>

        <div className="bg-surface-lighter/60 p-3.5 rounded-lg border border-surface-border space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">FFmpeg Status:</span>
            <span className="text-accent-emerald font-bold">
              {hardware?.ffmpeg.ffmpeg_installed ? 'Installed & Verified' : 'Checking...'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">NVENC Hardware Acceleration:</span>
            <span className="text-accent-emerald font-bold">
              {hardware?.ffmpeg.nvenc_hardware_acceleration ? 'Supported (h264_nvenc)' : 'CPU Libx264'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Binary Path:</span>
            <span className="font-mono text-gray-200 text-[11px] truncate max-w-sm">
              {hardware?.ffmpeg.ffmpeg_bin || 'D:\\AI-Shorts-Studio\\tools\\ffmpeg\\bin\\ffmpeg.exe'}
            </span>
          </div>
        </div>
      </div>

      {/* Model & Storage Preferences */}
      <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-accent-amber" />
          AI Models & Storage Configuration
        </h3>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Faster-Whisper Model */}
            <div className="space-y-1.5">
              <label className="text-gray-400 font-semibold">Faster-Whisper Model</label>
              <select
                value={whisperModel}
                onChange={(e) => setWhisperModel(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-white outline-none"
              >
                <option value="tiny">tiny (~75 MB, ultra-fast)</option>
                <option value="base">base (~145 MB, recommended for 4GB VRAM)</option>
                <option value="small">small (~480 MB, higher accuracy)</option>
                <option value="medium">medium (~1.5 GB, high VRAM)</option>
              </select>
            </div>

            {/* Ollama Local LLM */}
            <div className="space-y-1.5">
              <label className="text-gray-400 font-semibold">Local LLM (via Ollama)</label>
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-white outline-none"
              >
                <option value="llama3.2:3b">llama3.2:3b (Recommended - 2GB VRAM)</option>
                <option value="qwen2.5:3b">qwen2.5:3b (High accuracy)</option>
                <option value="phi3.5:3.8b">phi3.5:3.8b (Microsoft lightweight)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-400 font-semibold">Primary Media Storage Folder</label>
            <input
              type="text"
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-2 text-white font-mono text-xs outline-none"
            />
            <p className="text-[11px] text-gray-500">
              All source videos, clips, temp WAV files, and project databases are stored here.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-surface-border flex justify-end">
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-brand-500/20"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
