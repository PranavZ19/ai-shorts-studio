import React, { useState, useEffect, useRef } from 'react';
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
  MoveHorizontal,
  RefreshCw,
  Video as VideoIcon,
  Flame,
  Clock,
  Volume2,
  AlertCircle,
  FileText,
  Eye,
  XCircle,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { ClipItem, SourceVideoItem } from '../types';
import { api } from '../services/api';

interface ClipEditorPageProps {
  clips: ClipItem[];
  videos?: SourceVideoItem[];
  selectedClipId?: string | null;
  onSelectClip?: (id: string) => void;
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
}

export const ClipEditorPage: React.FC<ClipEditorPageProps> = ({
  clips,
  videos = [],
  selectedClipId: initialClipId,
  onSelectClip,
  onRefresh,
  onNavigate
}) => {
  // Active clip selection
  const [selectedClip, setSelectedClip] = useState<ClipItem | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Editing Settings
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(30);
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [framingMode, setFramingMode] = useState<string>('auto_face');
  const [manualPosition, setManualPosition] = useState<number>(0.5);

  // Caption Settings
  const [captionEnabled, setCaptionEnabled] = useState<boolean>(true);
  const [captionPreset, setCaptionPreset] = useState<string>('bold_creator');
  const [fontSize, setFontSize] = useState<number>(28);
  const [textColor, setTextColor] = useState<string>('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState<string>('#FFCC00');
  const [outlineColor, setOutlineColor] = useState<string>('#000000');
  const [outlineWidth, setOutlineWidth] = useState<number>(4.0);
  const [positionY, setPositionY] = useState<number>(72);
  const [audioVolume, setAudioVolume] = useState<number>(1.0);

  // Rendering State
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStage, setRenderStage] = useState<string>('');
  const [renderMessage, setRenderMessage] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderSuccess, setRenderSuccess] = useState<boolean>(false);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    // Select initial clip or first available clip
    if (clips.length > 0) {
      const match = clips.find(c => c.id === initialClipId);
      loadClip(match || clips[0]);
    }
  }, [clips, initialClipId]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const loadClip = (clip: ClipItem) => {
    setSelectedClip(clip);
    setStartTime(clip.start_time);
    setEndTime(clip.end_time);
    setCurrentTime(0);
    setIsPlaying(false);
    setRenderError(null);
    setRenderSuccess(!!clip.has_rendered_video);

    const cfg = clip.edit_config || {};
    if (cfg.aspect_ratio) setAspectRatio(cfg.aspect_ratio);
    if (cfg.framing) setFramingMode(cfg.framing);
    if (cfg.manual_position !== undefined) setManualPosition(cfg.manual_position);
    if (cfg.caption_enabled !== undefined) setCaptionEnabled(cfg.caption_enabled);
    if (cfg.caption_preset) setCaptionPreset(cfg.caption_preset);
    if (cfg.font_size) setFontSize(cfg.font_size);
    if (cfg.text_color) setTextColor(cfg.text_color);
    if (cfg.highlight_color) setHighlightColor(cfg.highlight_color);
    if (cfg.outline_color) setOutlineColor(cfg.outline_color);
    if (cfg.outline_width) setOutlineWidth(cfg.outline_width);
    if (cfg.position_y) setPositionY(cfg.position_y);
    if (cfg.audio_volume) setAudioVolume(cfg.audio_volume);
  };

  const handlePresetSelect = (presetKey: string) => {
    setCaptionPreset(presetKey);
    switch (presetKey) {
      case 'bold_creator':
        setFontSize(28);
        setTextColor('#FFFFFF');
        setHighlightColor('#FFCC00');
        setOutlineColor('#000000');
        setOutlineWidth(4.0);
        setPositionY(72);
        break;
      case 'karaoke_highlight':
        setFontSize(26);
        setTextColor('#E0E0E0');
        setHighlightColor('#00FF88');
        setOutlineColor('#111111');
        setOutlineWidth(3.5);
        setPositionY(74);
        break;
      case 'clean_minimal':
        setFontSize(24);
        setTextColor('#FFFFFF');
        setHighlightColor('#60A5FA');
        setOutlineColor('#000000');
        setOutlineWidth(2.0);
        setPositionY(78);
        break;
      case 'podcast_style':
        setFontSize(25);
        setTextColor('#FFFFFF');
        setHighlightColor('#F59E0B');
        setOutlineColor('#000000');
        setOutlineWidth(1.0);
        setPositionY(80);
        break;
      case 'minimal_subtitle':
        setFontSize(22);
        setTextColor('#FFFFFF');
        setHighlightColor('#FFFFFF');
        setOutlineColor('#1F2937');
        setOutlineWidth(2.5);
        setPositionY(85);
        break;
    }
  };

  const handleStartRender = async () => {
    if (!selectedClip) return;
    setIsRendering(true);
    setRenderProgress(5);
    setRenderStage('preparing_source');
    setRenderMessage('Starting vertical video rendering pipeline...');
    setRenderError(null);
    setRenderSuccess(false);

    try {
      const payload = {
        start_time: startTime,
        end_time: endTime,
        aspect_ratio: aspectRatio,
        framing: framingMode,
        manual_position: manualPosition,
        caption_enabled: captionEnabled,
        caption_preset: captionPreset,
        font_size: fontSize,
        text_color: textColor,
        highlight_color: highlightColor,
        outline_color: outlineColor,
        outline_width: outlineWidth,
        position_y: positionY,
        audio_volume: audioVolume
      };

      await api.renderClip(selectedClip.id, payload);

      // Start polling render status
      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await api.getClipRenderStatus(selectedClip.id);
          setRenderProgress(status.progress_pct);
          setRenderStage(status.stage);
          setRenderMessage(status.message);

          if (status.status === 'completed' || status.output_ready) {
            clearInterval(pollTimerRef.current);
            setIsRendering(false);
            setRenderProgress(100);
            setRenderSuccess(true);
            onRefresh();
            if (status.clip) {
              setSelectedClip(status.clip);
            }
          } else if (status.status === 'failed') {
            clearInterval(pollTimerRef.current);
            setIsRendering(false);
            setRenderError(status.message || 'Rendering failed.');
          }
        } catch (err) {
          console.error('Error polling render status:', err);
        }
      }, 1000);
    } catch (err: any) {
      setIsRendering(false);
      setRenderError(err.message || 'Failed to start rendering.');
    }
  };

  const handleCancelRender = async () => {
    if (!selectedClip) return;
    try {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      await api.cancelClipRender(selectedClip.id);
      setIsRendering(false);
      setRenderMessage('Rendering cancelled.');
    } catch (err) {
      console.error(err);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const formatSecs = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const duration = Math.max(0, endTime - startTime);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-400" />
            Vertical Clip Editor & Video Renderer
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Reframe horizontal video to vertical 9:16 with AI face tracking, customize word-highlighted animated captions, and render with hardware acceleration.
          </p>
        </div>

        {/* Clip Selector Dropdown */}
        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Editing Clip</span>
            <select
              value={selectedClip?.id || ''}
              onChange={(e) => {
                const found = clips.find(c => c.id === e.target.value);
                if (found) {
                  loadClip(found);
                  if (onSelectClip) onSelectClip(found.id);
                }
              }}
              className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 max-w-[260px] truncate"
            >
              {clips.length === 0 ? (
                <option value="">No clips available</option>
              ) : (
                clips.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    #{i + 1} {c.title} ({Math.round(c.duration)}s - {c.overall_score}pts)
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={() => onNavigate('clip-finder')}
            className="px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-xs text-gray-300 hover:text-white mt-4"
          >
            Back to Candidates
          </button>
        </div>
      </div>

      {selectedClip ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: 9:16 Canvas & Player Simulator (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center bg-surface rounded-2xl p-6 border border-surface-border space-y-4">
            {/* Visual Canvas Simulator */}
            <div className="relative w-[280px] h-[498px] bg-black rounded-2xl overflow-hidden border-2 border-surface-border shadow-2xl flex items-center justify-center group">
              {/* If real MP4 rendered, play real video */}
              {selectedClip.has_rendered_video && selectedClip.video_url ? (
                <video
                  ref={videoRef}
                  src={selectedClip.video_url}
                  className="w-full h-full object-cover"
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                /* Pre-render Simulated Canvas */
                <div className="w-full h-full bg-gradient-to-b from-gray-950 via-gray-900 to-black flex flex-col items-center justify-center p-4 text-center relative">
                  {/* Subtle Grid */}
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]" />

                  {/* Face Tracker Simulated Anchor */}
                  {framingMode === 'auto_face' ? (
                    <div className="w-24 h-24 rounded-full bg-brand-500/15 border-2 border-dashed border-brand-400 flex flex-col items-center justify-center mb-6 animate-pulse">
                      <Zap className="w-6 h-6 text-brand-400 mb-1" />
                      <span className="text-[10px] font-bold text-brand-300 uppercase tracking-wider">AI Face</span>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-surface-lighter border border-surface-border flex items-center justify-center mb-6">
                      <MoveHorizontal className="w-6 h-6 text-gray-400" />
                    </div>
                  )}

                  <div className="text-xs text-gray-400 font-medium z-10 px-4">
                    {selectedClip.title}
                  </div>

                  {/* Live Animated Caption Simulation Overlay */}
                  {captionEnabled && (
                    <div
                      className="absolute left-3 right-3 text-center pointer-events-none transition-all"
                      style={{ bottom: `${100 - positionY}%` }}
                    >
                      <div
                        className="inline-block px-3 py-1.5 rounded-lg font-black tracking-wide leading-tight shadow-lg"
                        style={{
                          fontSize: `${Math.round(fontSize * 0.55)}px`,
                          color: textColor,
                          textShadow: outlineWidth > 0 ? `0 0 ${outlineWidth * 2}px ${outlineColor}, 0 2px 4px rgba(0,0,0,0.8)` : 'none',
                          backgroundColor: captionPreset === 'podcast_style' ? 'rgba(0,0,0,0.75)' : 'transparent',
                          fontFamily: 'Segoe UI, Nirmala UI, sans-serif'
                        }}
                      >
                        HOW TO <span style={{ color: highlightColor }}>GROW RAPIDLY</span> IN 2026
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Play / Pause Toggle Button */}
              <button
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-105 shadow-xl"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              {/* Aspect Ratio Badge */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-gray-300 border border-white/10">
                {aspectRatio} (1080x1920)
              </div>

              {/* Render Status Badge */}
              <div className="absolute top-3 right-3">
                {selectedClip.has_rendered_video ? (
                  <span className="px-2 py-0.5 rounded bg-accent-emerald/80 text-[10px] font-bold text-white border border-accent-emerald">
                    Rendered MP4
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-brand-500/80 text-[10px] font-bold text-white">
                    Preview Mode
                  </span>
                )}
              </div>
            </div>

            {/* Time Indicator & Specs */}
            <div className="w-full flex items-center justify-between text-xs text-gray-400 px-2">
              <span className="font-mono text-white">
                {formatSecs(startTime)} - {formatSecs(endTime)}
              </span>
              <span className="font-semibold text-brand-300">
                Duration: {duration.toFixed(1)}s
              </span>
              <span className="text-accent-emerald flex items-center gap-1 font-semibold text-[11px]">
                <Zap className="w-3 h-3" />
                NVENC Ready
              </span>
            </div>

            {/* Live Render Progress Card */}
            {isRendering && (
              <div className="w-full p-4 rounded-xl bg-surface-lighter border border-brand-500/40 space-y-2.5 animate-pulse">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-brand-300 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent-amber" />
                    {renderMessage || 'Processing...'}
                  </span>
                  <span className="font-mono font-bold text-white">{renderProgress}%</span>
                </div>
                <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand-500 via-accent-purple to-accent-emerald h-full rounded-full transition-all duration-300"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-gray-400">
                  <span>Stage: {renderStage}</span>
                  <button
                    onClick={handleCancelRender}
                    className="text-red-400 hover:text-red-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Render Success Card with Direct Download */}
            {renderSuccess && selectedClip.has_rendered_video && !isRendering && (
              <div className="w-full p-4 rounded-xl bg-accent-emerald/10 border border-accent-emerald/30 space-y-3">
                <div className="flex items-center gap-2 text-accent-emerald text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Vertical Short Rendered Successfully!</span>
                </div>
                <div className="text-[11px] text-gray-300 space-y-0.5">
                  <div>Resolution: <span className="font-semibold text-white">1080 × 1920 (9:16)</span></div>
                  <div>Codec: <span className="font-semibold text-white">H.264 (NVENC Accelerated)</span></div>
                  <div>File Size: <span className="font-semibold text-white">{((selectedClip.file_size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB</span></div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={selectedClip.download_url || `/api/downloads/clip/${selectedClip.id}/mp4`}
                    download
                    className="py-2 px-3 rounded-lg bg-accent-emerald hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md text-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download MP4</span>
                  </a>

                  {selectedClip.srt_download_url && (
                    <a
                      href={selectedClip.srt_download_url}
                      download
                      className="py-2 px-3 rounded-lg bg-surface border border-surface-border text-gray-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 text-center"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download SRT</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Render Error */}
            {renderError && (
              <div className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{renderError}</span>
              </div>
            )}

            {/* Main Action Render Button */}
            <button
              onClick={handleStartRender}
              disabled={isRendering}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xl transition-all ${
                isRendering
                  ? 'bg-brand-600/50 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-brand-600 to-accent-purple hover:scale-[1.01] text-white shadow-brand-500/20'
              }`}
            >
              {isRendering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Rendering in Progress...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-accent-amber" />
                  <span>{selectedClip.has_rendered_video ? 'Re-Render Short (New Settings)' : 'Render 9:16 Short (NVENC)'}</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Controls, Framing, & Subtitle Customizer (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Timeline & Boundary Trimming */}
            <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scissors className="w-4 h-4 text-brand-400" />
                Clip Boundaries & Trimming
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>Start Timestamp</span>
                    <span className="font-mono text-brand-300">{formatSecs(startTime)}</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setStartTime(Math.max(0, startTime - 0.5))}
                      className="px-2 py-1 rounded bg-surface-lighter border border-surface-border text-xs text-gray-300 hover:text-white"
                    >
                      -0.5s
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      value={startTime}
                      onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-lighter border border-surface-border rounded-lg px-2.5 py-1 text-xs text-white text-center focus:outline-none focus:border-brand-500 font-mono"
                    />
                    <button
                      onClick={() => setStartTime(Math.min(endTime - 1, startTime + 0.5))}
                      className="px-2 py-1 rounded bg-surface-lighter border border-surface-border text-xs text-gray-300 hover:text-white"
                    >
                      +0.5s
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>End Timestamp</span>
                    <span className="font-mono text-brand-300">{formatSecs(endTime)}</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEndTime(Math.max(startTime + 1, endTime - 0.5))}
                      className="px-2 py-1 rounded bg-surface-lighter border border-surface-border text-xs text-gray-300 hover:text-white"
                    >
                      -0.5s
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      value={endTime}
                      onChange={(e) => setEndTime(parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-lighter border border-surface-border rounded-lg px-2.5 py-1 text-xs text-white text-center focus:outline-none focus:border-brand-500 font-mono"
                    />
                    <button
                      onClick={() => setEndTime(endTime + 0.5)}
                      className="px-2 py-1 rounded bg-surface-lighter border border-surface-border text-xs text-gray-300 hover:text-white"
                    >
                      +0.5s
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Aspect Ratio & Subject Framing */}
            <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MoveHorizontal className="w-4 h-4 text-accent-purple" />
                Aspect Ratio & Intelligent Framing
              </h3>

              {/* Aspect Ratio Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 block">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: '9:16', label: '9:16 Vertical', desc: '1080x1920 (Shorts/Reels)' },
                    { id: '1:1', label: '1:1 Square', desc: '1080x1080 (Feed)' },
                    { id: '16:9', label: '16:9 Horizontal', desc: '1920x1080 (Original)' }
                  ].map((ratio) => (
                    <button
                      key={ratio.id}
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        aspectRatio === ratio.id
                          ? 'bg-brand-500/15 border-brand-500 text-white shadow-sm'
                          : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">{ratio.label}</div>
                      <div className="text-[10px] text-gray-500">{ratio.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Tracking Mode */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 block">Subject Tracking Mode</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'auto_face', label: 'Smart Face Tracking', desc: 'YuNet AI + EMA Smoothing' },
                    { id: 'center', label: 'Center Crop', desc: 'Static middle crop' },
                    { id: 'manual', label: 'Manual Position', desc: 'Custom horizontal position' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setFramingMode(mode.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        framingMode === mode.id
                          ? 'bg-accent-purple/15 border-accent-purple text-white shadow-sm'
                          : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">{mode.label}</div>
                      <div className="text-[10px] text-gray-500">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual position slider if manual selected */}
              {framingMode === 'manual' && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Horizontal Crop Center</span>
                    <span className="font-mono text-white">{Math.round(manualPosition * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={manualPosition}
                    onChange={(e) => setManualPosition(parseFloat(e.target.value))}
                    className="w-full accent-accent-purple"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Left (0%)</span>
                    <span>Center (50%)</span>
                    <span>Right (100%)</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Animated Captions & Typography Presets */}
            <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Type className="w-4 h-4 text-accent-amber" />
                  Synchronized Animated Captions
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={captionEnabled}
                    onChange={(e) => setCaptionEnabled(e.target.checked)}
                    className="rounded border-surface-border bg-surface-lighter text-brand-500 focus:ring-0"
                  />
                  <span className="text-xs text-gray-300 font-semibold">Enable Subtitles</span>
                </label>
              </div>

              {captionEnabled && (
                <div className="space-y-4">
                  {/* Preset Buttons */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-gray-400 block">Caption Style Preset</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { id: 'bold_creator', label: 'Bold Creator', sample: 'Yellow Highlight', color: '#FFCC00' },
                        { id: 'karaoke_highlight', label: 'Karaoke Neon', sample: 'Neon Green', color: '#00FF88' },
                        { id: 'clean_minimal', label: 'Clean Minimal', sample: 'Soft Blue', color: '#60A5FA' },
                        { id: 'podcast_style', label: 'Podcast Box', sample: 'Amber Contrast', color: '#F59E0B' },
                        { id: 'minimal_subtitle', label: 'Classic Subtitle', sample: 'Standard White', color: '#FFFFFF' }
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handlePresetSelect(preset.id)}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            captionPreset === preset.id
                              ? 'bg-brand-500/15 border-brand-500 text-white shadow-sm'
                              : 'bg-surface-lighter border-surface-border text-gray-400 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{preset.label}</span>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{preset.sample}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size & Colors Customizer */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">Font Size ({fontSize}px)</label>
                      <input
                        type="range"
                        min="18"
                        max="38"
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value))}
                        className="w-full accent-brand-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">Vertical Position ({positionY}%)</label>
                      <input
                        type="range"
                        min="50"
                        max="88"
                        value={positionY}
                        onChange={(e) => setPositionY(parseInt(e.target.value))}
                        className="w-full accent-brand-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-gray-400">Highlight Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={highlightColor}
                          onChange={(e) => setHighlightColor(e.target.value)}
                          className="w-7 h-7 rounded border border-surface-border bg-surface cursor-pointer"
                        />
                        <span className="font-mono text-[11px] text-gray-300">{highlightColor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 italic">
                    * Unicode & Devanagari (Hindi) fonts are automatically shaped with Segoe UI and Nirmala UI.
                  </div>
                </div>
              )}
            </div>

            {/* 4. Audio Volume */}
            <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-teal-400" />
                  Original Audio Level
                </span>
                <span className="font-mono text-brand-300">{Math.round(audioVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={audioVolume}
                onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                className="w-full accent-teal-400"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-4">
          <Sliders className="w-12 h-12 text-brand-400 mx-auto" />
          <div className="text-base font-bold text-white">No Clip Selected for Editing</div>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Please select an approved clip from Candidate Moments or create candidate moments from an ingested video first.
          </p>
          <button
            onClick={() => onNavigate('clip-finder')}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
          >
            Go to Clip Finder
          </button>
        </div>
      )}
    </div>
  );
};
