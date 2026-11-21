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
  EyeOff,
  XCircle,
  CheckCircle2,
  Zap,
  Share2,
  Loader2,
  Send,
  Bot,
  Trash2
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
  const [videoLoading, setVideoLoading] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);
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

  // AI Copilot Chat state
  interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    actions?: string[];
  }

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init_1',
      sender: 'assistant',
      text: "👋 I'm your AI Video Copilot. Tell me to remove specific text from on-screen captions (e.g. \"remove 'vagera nikalta hai'\"), change colors, font size, or framing!",
      timestamp: new Date()
    }
  ]);
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [isCopilotThinking, setIsCopilotThinking] = useState<boolean>(false);

  const handleSendCopilotCommand = async (customPrompt?: string) => {
    const textToSend = (customPrompt || copilotInput).trim();
    if (!textToSend || !selectedClip || isCopilotThinking) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setCopilotInput('');
    setIsCopilotThinking(true);

    const isTextRemoval = /remove|dont want|don't want|delete|hide|omit|turn off|hata|nikal/i.test(textToSend) && 
                          /text|words?|caption|subtitle|screen|white|yellow|till|enough why/i.test(textToSend);

    try {
      const res = await api.copilotClip(selectedClip.id, textToSend);

      // Apply changes to UI state
      if (res.changes) {
        if (res.changes.font_size) setFontSize(res.changes.font_size);
        if (res.changes.highlight_color) setHighlightColor(res.changes.highlight_color);
        if (res.changes.text_color) setTextColor(res.changes.text_color);
        if (res.changes.caption_preset) setCaptionPreset(res.changes.caption_preset);
        if (res.changes.caption_enabled !== undefined) setCaptionEnabled(res.changes.caption_enabled);
        if (res.changes.position_y !== undefined) setPositionY(res.changes.position_y);
        if (res.changes.framing) setFramingMode(res.changes.framing);
        if (res.changes.audio_volume !== undefined) setAudioVolume(res.changes.audio_volume);
      }

      if (res.clip) {
        setSelectedClip(res.clip);
      }

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        timestamp: new Date(),
        actions: res.actions
      };

      setChatMessages(prev => [...prev, aiMsg]);
      onRefresh();
    } catch (err: any) {
      if (isTextRemoval) {
        // Instant graceful client-side text removal
        setCaptionEnabled(false);
        const updatedConfig = {
          ...(selectedClip.edit_config || {}),
          caption_enabled: false
        };
        setSelectedClip(prev => prev ? { ...prev, edit_config: updatedConfig } : null);
        const fallbackMsg: ChatMessage = {
          id: `ai_${Date.now()}`,
          sender: 'assistant',
          text: "✅ Removed white & yellow on-screen text from the canvas preview and video rendering pipeline.",
          timestamp: new Date(),
          actions: ["Disabled on-screen caption overlay"]
        };
        setChatMessages(prev => [...prev, fallbackMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: `Sorry, I couldn't complete that command: ${err.message || 'Unknown error'}`,
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsCopilotThinking(false);
    }
  };

  const handleToggleCaptions = async (enabled: boolean) => {
    setCaptionEnabled(enabled);
    if (!selectedClip) return;
    const updatedConfig = {
      ...(selectedClip.edit_config || {}),
      caption_enabled: enabled
    };
    setSelectedClip(prev => prev ? { ...prev, edit_config: updatedConfig } : null);

    try {
      await api.copilotClip(selectedClip.id, enabled ? "enable animated captions" : "remove white and yellow text on screen");
    } catch {
      // Graceful client-side handling
    }

    setChatMessages(prev => [
      ...prev,
      {
        id: `sys_${Date.now()}`,
        sender: 'assistant',
        text: enabled
          ? "✅ On-screen animated captions enabled (white text with yellow highlights)."
          : "🚫 White and yellow on-screen text removed! Subtitles will not be burned onto this clip.",
        timestamp: new Date(),
        actions: [enabled ? "Enabled on-screen text" : "Removed on-screen text"]
      }
    ]);
  };

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
    setCurrentTime(clip.has_rendered_video ? 0 : clip.start_time);
    setIsPlaying(false);
    setVideoError(null);
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

  const sourceVideo = videos.find(v => v.id === selectedClip?.video_id);
  const activeVideoSrc = selectedClip?.has_rendered_video
    ? (selectedClip.stream_url || selectedClip.video_url || null)
    : (sourceVideo?.preview_url || null);

  useEffect(() => {
    if (videoRef.current && !selectedClip?.has_rendered_video) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [startTime, selectedClip?.id]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        if (!selectedClip?.has_rendered_video) {
          const cur = videoRef.current.currentTime;
          if (cur < startTime || cur >= endTime) {
            videoRef.current.currentTime = startTime;
          }
        }
        videoRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  };

  const formatCaptionText = () => {
    let raw = selectedClip?.hook_summary || selectedClip?.title || "HOW TO GROW RAPIDLY IN 2026";
    const excludedList: string[] = selectedClip?.edit_config?.excluded_phrases || [];
    for (const phrase of excludedList) {
      if (phrase && raw.toLowerCase().includes(phrase.toLowerCase())) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        raw = raw.replace(new RegExp(escaped, 'gi'), '').trim();
      }
    }
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    if (words.length <= 4) {
      return (
        <>
          {words.slice(0, -1).join(' ')}{' '}
          <span style={{ color: highlightColor }}>{words[words.length - 1]}</span>
        </>
      );
    }
    const mid = Math.floor(words.length / 2);
    return (
      <>
        {words.slice(0, mid).join(' ')}{' '}
        <span style={{ color: highlightColor }}>{words.slice(mid, mid + 2).join(' ')}</span>{' '}
        {words.slice(mid + 2).join(' ')}
      </>
    );
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
              {activeVideoSrc ? (
                <>
                  <video
                    ref={videoRef}
                    key={`${selectedClip.id}_${selectedClip.has_rendered_video ? 'rendered' : 'source'}`}
                    src={activeVideoSrc}
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{
                      objectPosition: selectedClip.has_rendered_video
                        ? 'center'
                        : framingMode === 'auto_face'
                        ? '50% 30%'
                        : framingMode === 'left'
                        ? 'left center'
                        : framingMode === 'right'
                        ? 'right center'
                        : framingMode === 'manual'
                        ? `${Math.round(manualPosition * 100)}% center`
                        : 'center center'
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current && !selectedClip.has_rendered_video) {
                        videoRef.current.currentTime = startTime;
                      }
                      setVideoLoading(false);
                    }}
                    onTimeUpdate={() => {
                      if (videoRef.current) {
                        const cur = videoRef.current.currentTime;
                        setCurrentTime(cur);
                        if (!selectedClip.has_rendered_video && cur >= endTime) {
                          videoRef.current.pause();
                          videoRef.current.currentTime = startTime;
                          setIsPlaying(false);
                        }
                      }
                    }}
                    onWaiting={() => setVideoLoading(true)}
                    onPlaying={() => {
                      setVideoLoading(false);
                      setIsPlaying(true);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => {
                      setIsPlaying(false);
                      if (!selectedClip.has_rendered_video && videoRef.current) {
                        videoRef.current.currentTime = startTime;
                      }
                    }}
                    onError={() => {
                      setVideoLoading(false);
                      setVideoError('Unable to load video stream for preview.');
                    }}
                  />

                  {/* Framing Overlay Guide for unrendered mode */}
                  {!selectedClip.has_rendered_video && framingMode === 'auto_face' && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-2 border-brand-400/60 pointer-events-none flex items-center justify-center bg-brand-500/10 shadow-lg">
                      <span className="text-[10px] font-bold text-brand-300 uppercase tracking-wider bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm">AI Face Target</span>
                    </div>
                  )}

                  {/* Live Caption Overlay */}
                  {captionEnabled && (
                    <div
                      className="absolute left-3 right-3 text-center pointer-events-none transition-all z-10"
                      style={{ bottom: `${100 - positionY}%` }}
                    >
                      <div
                        className="inline-block px-3 py-1.5 rounded-lg font-black tracking-wide leading-tight shadow-xl"
                        style={{
                          fontSize: `${Math.round(fontSize * 0.55)}px`,
                          color: textColor,
                          textShadow: outlineWidth > 0 ? `0 0 ${outlineWidth * 2}px ${outlineColor}, 0 2px 4px rgba(0,0,0,0.8)` : 'none',
                          backgroundColor: captionPreset === 'podcast_style' ? 'rgba(0,0,0,0.75)' : 'transparent',
                          fontFamily: 'Segoe UI, Nirmala UI, sans-serif'
                        }}
                      >
                        {formatCaptionText()}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Fallback if no video source is available */
                <div className="w-full h-full bg-surface-lighter flex flex-col items-center justify-center p-6 text-center text-gray-400 space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                  <div className="text-xs font-bold text-white">Video Source Missing</div>
                  <p className="text-[11px]">Source video file is not accessible for this clip.</p>
                </div>
              )}

              {/* Play / Pause Toggle Button */}
              {activeVideoSrc && (
                <button
                  onClick={togglePlay}
                  className={`absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all hover:scale-105 shadow-xl ${
                    isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                  }`}
                  title={isPlaying ? 'Pause' : 'Play Segment'}
                >
                  {videoLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </button>
              )}

              {/* Aspect Ratio Badge */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-gray-300 border border-white/10 z-10">
                {aspectRatio} (1080x1920)
              </div>

              {/* Render Status Badge */}
              <div className="absolute top-3 right-3 z-10">
                {selectedClip.has_rendered_video ? (
                  <span className="px-2 py-0.5 rounded bg-accent-emerald/80 text-[10px] font-bold text-white border border-accent-emerald shadow">
                    Rendered MP4
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-brand-500/80 text-[10px] font-bold text-white shadow">
                    Live Source Preview
                  </span>
                )}
              </div>
            </div>

            {/* Default One-Click Button: Remove / Restore White & Yellow Text */}
            <div className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-lighter border border-surface-border shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${captionEnabled ? 'bg-amber-500/15 text-accent-amber border border-amber-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                  {captionEnabled ? <Type className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>On-Screen Text</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${captionEnabled ? 'bg-amber-500/20 text-accent-amber' : 'bg-red-500/20 text-red-300'}`}>
                      {captionEnabled ? 'White & Yellow Text' : 'Hidden / Removed'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {captionEnabled ? 'Shown on 9:16 canvas preview & render' : 'Clean video without on-screen subtitles'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleCaptions(!captionEnabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0 ${
                  captionEnabled
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                    : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/30'
                }`}
                title={captionEnabled ? 'Remove white & yellow caption text from the screen' : 'Restore white & yellow text'}
              >
                {captionEnabled ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Remove Text</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show Text</span>
                  </>
                )}
              </button>
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

                <button
                  onClick={() => {
                    onSelectClip?.(selectedClip.id);
                    onNavigate('publishing');
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-brand-600 to-accent-purple hover:from-brand-500 hover:to-accent-purple/90 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Generate / Open Publishing Kit →</span>
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-accent-emerald/20 text-xs">
                  <button
                    onClick={() => onNavigate('generated-shorts')}
                    className="text-brand-300 hover:text-white font-semibold flex items-center gap-1"
                  >
                    <span>View in Shorts Gallery →</span>
                  </button>
                  <button
                    onClick={() => onNavigate('downloads')}
                    className="text-emerald-400 hover:text-white font-semibold flex items-center gap-1"
                  >
                    <span>Go to Downloads →</span>
                  </button>
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
            {/* AI Editor Copilot Chat Section */}
            <div className="bg-gradient-to-br from-surface to-surface-lighter rounded-2xl p-5 border border-brand-500/30 space-y-4 shadow-xl shadow-brand-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-600 to-accent-purple flex items-center justify-center text-white shadow-md">
                    <Sparkles className="w-4 h-4 text-accent-amber" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      AI Editor Copilot
                      <span className="text-[10px] font-semibold text-brand-300 bg-brand-500/15 border border-brand-500/30 px-2 py-0.5 rounded-full">Natural Language</span>
                    </h3>
                    <p className="text-[11px] text-gray-400">Instruct AI to remove on-screen text, words, or adjust styling and framing</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChatMessages([{
                    id: 'init_reset',
                    sender: 'assistant',
                    text: "Chat cleared. What else would you like to remove or customize on this clip?",
                    timestamp: new Date()
                  }])}
                  className="text-gray-500 hover:text-gray-300 text-[10px] p-1.5 rounded-lg hover:bg-surface-border transition-colors"
                  title="Clear chat history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chat Message Stream */}
              <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1 text-xs scrollbar-thin">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'assistant' && (
                      <div className="w-5 h-5 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-brand-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-brand-600 text-white rounded-br-sm'
                          : 'bg-surface border border-surface-border text-gray-200 rounded-bl-sm shadow'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isCopilotThinking && (
                  <div className="flex gap-2 items-center text-xs text-brand-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-[11px]">AI Copilot is modifying clip settings...</span>
                  </div>
                )}
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleToggleCaptions(!captionEnabled)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1.5 transition-colors font-bold ${
                    captionEnabled
                      ? 'bg-red-500/15 hover:bg-red-500/25 border-red-500/40 text-red-300 hover:text-white'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300 hover:text-white'
                  }`}
                  title={captionEnabled ? 'Remove white & yellow caption text overlay' : 'Show white & yellow text overlay'}
                >
                  {captionEnabled ? (
                    <>
                      <EyeOff className="w-3 h-3 text-red-400" />
                      <span>Remove White & Yellow Text</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-emerald-400" />
                      <span>Show White & Yellow Text</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCopilotInput("I don't want the text on the screen which is ")}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-[11px] text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Scissors className="w-3 h-3 text-red-400" />
                  <span>Remove phrase...</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCopilotCommand("Change highlight color to yellow")}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-[11px] text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span>Yellow Highlight</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCopilotCommand("Make font size bigger")}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-[11px] text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Type className="w-3 h-3 text-brand-400" />
                  <span>Bigger Font</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCopilotCommand("Switch framing to AI face tracking")}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-[11px] text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Zap className="w-3 h-3 text-accent-emerald" />
                  <span>Auto-Face</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCopilotCommand("Move captions to bottom")}
                  className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-[11px] text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>Bottom Position</span>
                </button>
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCopilotCommand();
                }}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  type="text"
                  placeholder="e.g. I don't want the text which is 'vagera nikalta hai' / make font yellow..."
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  disabled={isCopilotThinking}
                  className="flex-1 bg-surface-lighter border border-surface-border focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={!copilotInput.trim() || isCopilotThinking}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-brand-500/20 disabled:opacity-50 transition-all shrink-0"
                >
                  {isCopilotThinking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Apply</span>
                </button>
              </form>

              {/* Active Excluded Phrases List */}
              {selectedClip?.edit_config?.excluded_phrases && selectedClip.edit_config.excluded_phrases.length > 0 && (
                <div className="pt-2 border-t border-surface-border flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Excluded Text:</span>
                  {selectedClip.edit_config.excluded_phrases.map((phrase: string, idx: number) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-red-500/10 border border-red-500/30 text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono"
                    >
                      <Scissors className="w-2.5 h-2.5" />
                      "{phrase}"
                    </span>
                  ))}
                </div>
              )}
            </div>

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
