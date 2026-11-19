import React, { useState } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Type,
  Maximize2,
  Sliders,
  Check,
  Download,
  Palette,
  Sparkles,
  MoveHorizontal
} from 'lucide-react';

export const ClipEditorPage: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(12.4);
  const [endTime, setEndTime] = useState(42.8);
  const [captionPreset, setCaptionPreset] = useState('karaoke_yellow');
  const [framingMode, setFramingMode] = useState('auto_face');
  const [highlightColor, setHighlightColor] = useState('#fbbf24');
  const [fontSize, setFontSize] = useState(24);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Professional 9:16 Clip Editor</h2>
          <p className="text-xs text-gray-400">
            Preview vertical aspect ratio, adjust speaker face framing, trim boundaries, and customize animated captions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button className="px-3.5 py-1.5 rounded-lg bg-surface border border-surface-border text-xs font-semibold text-gray-300 hover:text-white">
            Reset Adjustments
          </button>
          <button className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-brand-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Re-Render Clip (NVENC)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: 9:16 Vertical Video Canvas Simulator */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center bg-surface rounded-2xl p-6 border border-surface-border">
          <div className="relative w-[270px] h-[480px] bg-black rounded-2xl overflow-hidden border-2 border-surface-border shadow-2xl flex items-center justify-center">
            {/* Visual crop preview guide lines */}
            <div className="absolute inset-0 border border-white/10 pointer-events-none" />
            
            {/* Simulated Frame */}
            <div className="w-full h-full bg-gradient-to-b from-gray-900 via-gray-800 to-black flex flex-col items-center justify-center p-4 text-center">
              <div className="w-20 h-20 rounded-full bg-brand-500/20 border-2 border-brand-400 flex items-center justify-center mb-4">
                <span className="text-xs font-bold text-brand-300">Face Track</span>
              </div>
              
              {/* Dynamic Animated Caption Preview */}
              <div className="absolute bottom-16 left-4 right-4 text-center">
                <span className="bg-black/75 px-3 py-1.5 rounded-lg text-sm font-black tracking-wide text-white drop-shadow-md">
                  BUILDING <span style={{ color: highlightColor }}>VIRAL SHORTS</span> WITH AI
                </span>
              </div>
            </div>

            {/* Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-105"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            {/* 9:16 Badge */}
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-gray-300 border border-white/10">
              9:16 (1080x1920)
            </div>
          </div>

          <div className="text-xs text-gray-400 mt-4 flex items-center gap-2">
            <span>Duration: {(endTime - startTime).toFixed(1)}s</span>
            <span>•</span>
            <span className="text-accent-emerald">NVENC Hardware Accelerated</span>
          </div>
        </div>

        {/* Right: Controls & Stylers */}
        <div className="lg:col-span-7 space-y-5">
          {/* Timeline Trimming */}
          <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-brand-400" />
              Timeline & Boundary Trimming
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Start Time (seconds)</label>
                <input
                  type="number"
                  step="0.1"
                  value={startTime}
                  onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
                  className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">End Time (seconds)</label>
                <input
                  type="number"
                  step="0.1"
                  value={endTime}
                  onChange={(e) => setEndTime(parseFloat(e.target.value) || 0)}
                  className="w-full bg-surface-lighter border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Speaker Framing & Crop */}
          <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MoveHorizontal className="w-4 h-4 text-accent-purple" />
              Intelligent Vertical Framing
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'auto_face', label: 'Auto Face Tracking', desc: 'MediaPipe / OpenCV' },
                { id: 'center', label: 'Center Crop', desc: 'Standard 9:16' },
                { id: 'split', label: 'Split Screen', desc: 'Two speakers stacked' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setFramingMode(mode.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    framingMode === mode.id
                      ? 'bg-brand-600/15 border-brand-500 text-white'
                      : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold">{mode.label}</div>
                  <div className="text-[10px] text-gray-500">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Animated Caption Presets & Colors */}
          <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Type className="w-4 h-4 text-accent-amber" />
              Animated Captions & Styling
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Caption Preset</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'karaoke_yellow', label: 'Karaoke Pop', color: '#fbbf24' },
                    { id: 'neon_emerald', label: 'Neon Emerald', color: '#10b981' },
                    { id: 'bold_cyberpunk', label: 'Cyberpunk Rose', color: '#f43f5e' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setCaptionPreset(preset.id);
                        setHighlightColor(preset.color);
                      }}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between ${
                        captionPreset === preset.id
                          ? 'bg-surface-lighter border-brand-500 text-white'
                          : 'bg-surface-lighter/50 border-surface-border text-gray-400 hover:text-white'
                      }`}
                    >
                      <span>{preset.label}</span>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.color }} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Font Size ({fontSize}px)</label>
                  <input
                    type="range"
                    min="18"
                    max="36"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Highlight Color</label>
                  <input
                    type="color"
                    value={highlightColor}
                    onChange={(e) => setHighlightColor(e.target.value)}
                    className="w-full h-8 bg-surface-lighter border border-surface-border rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
