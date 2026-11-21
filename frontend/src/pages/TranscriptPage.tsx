import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Search,
  Play,
  Pause,
  Edit3,
  Save,
  Check,
  User,
  Sparkles,
  Download,
  AlertCircle,
  Clock,
  Globe,
  Cpu,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileCode
} from 'lucide-react';
import { api } from '../services/api';
import { SourceVideoItem } from '../types';

interface TranscriptPageProps {
  videos: SourceVideoItem[];
  selectedVideoId: string | null;
  onSelectVideo: (id: string) => void;
  onNavigate?: (tab: string) => void;
}

export const TranscriptPage: React.FC<TranscriptPageProps> = ({
  videos,
  selectedVideoId,
  onSelectVideo,
  onNavigate
}) => {
  const [currentVideoId, setCurrentVideoId] = useState<string>(selectedVideoId || (videos[0]?.id || ''));
  const [transcriptData, setTranscriptData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeStatus, setTranscribeStatus] = useState<string>('');
  const [transcribeProgress, setTranscribeProgress] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<string>('base');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [forceCpu, setForceCpu] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing state
  const [editingSegId, setEditingSegId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editSpeaker, setEditSpeaker] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Video playback & synchronization
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showWordsForSegId, setShowWordsForSegId] = useState<string | null>(null);

  const activeVideo = videos.find(v => v.id === currentVideoId);

  const fetchTranscript = async (vId: string) => {
    if (!vId) return;
    setIsLoading(true);
    try {
      const data = await api.getTranscriptForVideo(vId);
      setTranscriptData(data);
    } catch (err) {
      console.error('Error fetching transcript:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const targetId = selectedVideoId || (videos[0]?.id || '');
    if (targetId && targetId !== currentVideoId) {
      setCurrentVideoId(targetId);
      fetchTranscript(targetId);
    } else if (targetId && !transcriptData) {
      fetchTranscript(targetId);
    }
  }, [selectedVideoId, videos.length]);

  const handleStartTranscribe = async () => {
    if (!currentVideoId) return;
    setIsTranscribing(true);
    setTranscribeProgress(8);
    setTranscribeStatus('Extracting audio & loading Faster-Whisper...');

    // Poll live transcription progress
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    pollInterval = setInterval(async () => {
      try {
        const prog = await api.getTranscriptionProgress(currentVideoId);
        if (prog && prog.status === 'running') {
          if (prog.progress_pct > 0) {
            setTranscribeProgress(prog.progress_pct);
          }
          if (prog.message) {
            setTranscribeStatus(prog.message);
          }
        }
      } catch {
        // Ignore transient poll error
      }
    }, 600);

    try {
      await api.transcribeVideo(currentVideoId, selectedModel, selectedLanguage, forceCpu);
      setTranscribeProgress(100);
      setTranscribeStatus('Finalizing transcript...');
      await fetchTranscript(currentVideoId);
    } catch (err: any) {
      alert(err.message || 'Transcription failed');
    } finally {
      if (pollInterval) clearInterval(pollInterval);
      setIsTranscribing(false);
      setTranscribeProgress(0);
      setTranscribeStatus('');
    }
  };

  const handleSeek = (timeSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleStartEdit = (seg: any) => {
    setEditingSegId(seg.id);
    setEditText(seg.text);
    setEditSpeaker(seg.speaker || 'Speaker 1');
  };

  const handleSaveEdit = async (segId: string) => {
    try {
      setIsSavingEdit(true);
      await api.updateTranscriptSegment(segId, editText, editSpeaker);
      setEditingSegId(null);
      await fetchTranscript(currentVideoId);
    } catch (err: any) {
      alert(err.message || 'Failed to save edit');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filteredSegments = (transcriptData?.segments || []).filter((s: any) =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.speaker && s.speaker.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header & Video Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Full Interactive Transcript</h2>
          <p className="text-xs text-gray-400">
            Faster-Whisper speech-to-text with word-level timestamps. Synchronized with playback and fully editable.
          </p>
        </div>

        {/* Video Dropdown & Action CTA */}
        <div className="flex items-center space-x-2">
          {videos.length > 0 && (
            <div className="flex items-center space-x-2 bg-surface px-3 py-1.5 rounded-lg border border-surface-border text-xs">
              <span className="text-gray-400">Target Video:</span>
              <select
                value={currentVideoId}
                onChange={(e) => {
                  setCurrentVideoId(e.target.value);
                  onSelectVideo(e.target.value);
                }}
                className="bg-transparent text-white font-medium outline-none cursor-pointer max-w-[220px] truncate"
              >
                {videos.map((v) => (
                  <option key={v.id} value={v.id} className="bg-surface text-gray-200">
                    {v.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {transcriptData?.segments?.length > 0 && onNavigate && (
            <button
              onClick={() => onNavigate('clip-finder')}
              className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Find AI Clips →</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Video Player on Left, Transcript Segments on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Preview Player & Info (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface rounded-2xl p-4 border border-surface-border space-y-3 sticky top-20">
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-surface-border shadow-lg">
              {activeVideo?.preview_url ? (
                <video
                  ref={videoRef}
                  src={activeVideo.preview_url}
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                  No video selected
                </div>
              )}
            </div>

            {/* Video metadata pill */}
            {activeVideo && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white line-clamp-1">{activeVideo.title}</h4>
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Current Time: <span className="font-mono text-brand-400 font-semibold">{currentTime.toFixed(1)}s</span></span>
                  <span>Duration: {Math.round(activeVideo.duration)}s</span>
                  <span>Resolution: {activeVideo.width}x{activeVideo.height}</span>
                </div>
              </div>
            )}

            {/* Transcribe Controls Box (if not transcribed yet or re-transcribe) */}
            <div className="pt-3 border-t border-surface-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  Faster-Whisper Engine
                </span>
                {transcriptData?.found && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Transcribed ({transcriptData.language?.toUpperCase()})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Model Size</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isTranscribing}
                    className="w-full bg-surface-lighter border border-surface-border rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="tiny">tiny (Ultra-fast, ~75MB)</option>
                    <option value="base">base (Balanced, ~145MB)</option>
                    <option value="small">small (High accuracy, ~480MB)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Spoken Language</label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    disabled={isTranscribing}
                    className="w-full bg-surface-lighter border border-surface-border rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="auto">Auto-Detect</option>
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </select>
                </div>
              </div>

              {/* Force CPU option checkbox */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceCpu}
                    onChange={(e) => setForceCpu(e.target.checked)}
                    className="rounded border-surface-border text-brand-600 focus:ring-0"
                  />
                  <span>Force CPU Processing</span>
                </label>
              </div>

              {/* Action Button */}
              <button
                onClick={handleStartTranscribe}
                disabled={isTranscribing || !activeVideo}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-95 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-brand-500/20 disabled:opacity-50"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Transcribing... {transcribeProgress}%</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{transcriptData?.found ? 'Re-Transcribe Video' : 'Transcribe Video with AI'}</span>
                  </>
                )}
              </button>

              {/* Progress percentage bar on left control */}
              {isTranscribing && (
                <div className="space-y-1.5 p-2.5 rounded-xl bg-surface-lighter/70 border border-brand-500/20">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-300 font-medium truncate max-w-[190px]">{transcribeStatus || 'Transcribing speech...'}</span>
                    <span className="text-brand-400 font-mono font-bold">{transcribeProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-600 via-accent-purple to-brand-400 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(5, transcribeProgress)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Subtitle Export Buttons */}
              {transcriptData?.found && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={api.getSubtitleExportUrl(transcriptData.transcript_id, 'srt')}
                    download
                    className="py-1.5 px-3 rounded-lg bg-surface-lighter hover:bg-surface-border border border-surface-border text-xs text-center font-medium text-gray-300 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-brand-400" />
                    <span>Export .SRT</span>
                  </a>
                  <a
                    href={api.getSubtitleExportUrl(transcriptData.transcript_id, 'vtt')}
                    download
                    className="py-1.5 px-3 rounded-lg bg-surface-lighter hover:bg-surface-border border border-surface-border text-xs text-center font-medium text-gray-300 flex items-center justify-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-accent-purple" />
                    <span>Export .VTT</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Timestamped Transcript (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search Bar & Stats */}
          <div className="bg-surface rounded-xl p-3 border border-surface-border flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search words in transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-lighter border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            {transcriptData?.found && (
              <div className="text-xs text-gray-400 shrink-0 font-mono">
                {filteredSegments.length} segments
              </div>
            )}
          </div>

          {/* Transcript List or Live Progress State */}
          {isTranscribing ? (
            <div className="bg-surface rounded-xl p-8 border border-brand-500/30 text-center space-y-6 shadow-lg shadow-brand-500/5">
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-brand-500/20" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-brand-400 border-t-transparent animate-spin"
                  style={{ animationDuration: '1.8s' }}
                />
                <div className="text-center">
                  <span className="text-3xl font-black text-white font-mono">{transcribeProgress}%</span>
                  <span className="block text-[9px] text-brand-300 font-bold uppercase tracking-wider">Progress</span>
                </div>
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  Transcribing Speech with Faster-Whisper
                </h3>
                <p className="text-xs text-brand-300 font-medium">
                  {transcribeStatus || 'Processing audio stream...'}
                </p>
                <p className="text-[11px] text-gray-400">
                  Transcribing speech locally with word-level timestamps on your graphics card.
                </p>
              </div>

              {/* Wide Progress Bar */}
              <div className="max-w-md mx-auto space-y-1.5">
                <div className="w-full h-3 bg-surface-lighter rounded-full overflow-hidden border border-surface-border">
                  <div
                    className="h-full bg-gradient-to-r from-brand-600 via-accent-purple to-brand-400 transition-all duration-300 rounded-full shadow"
                    style={{ width: `${Math.max(5, transcribeProgress)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 px-1">
                  <span>{transcribeProgress < 20 ? 'Audio extraction' : transcribeProgress < 35 ? 'Model setup' : transcribeProgress < 90 ? 'Word-level alignment' : 'Finalizing transcript'}</span>
                  <span className="font-mono font-bold text-brand-400">{transcribeProgress}% completed</span>
                </div>
              </div>

              {/* Hardware & Model Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="text-[11px] bg-surface-lighter border border-surface-border text-gray-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-brand-400" />
                  {forceCpu ? 'CPU Fallback' : 'NVIDIA CUDA GPU'}
                </span>
                <span className="text-[11px] bg-surface-lighter border border-surface-border text-gray-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-brand-400" />
                  Language: {selectedLanguage === 'auto' ? 'Auto-Detect' : selectedLanguage.toUpperCase()}
                </span>
                <span className="text-[11px] bg-surface-lighter border border-surface-border text-gray-300 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  Model: {selectedModel}
                </span>
              </div>
            </div>
          ) : transcriptData?.found ? (
            <div className="bg-surface rounded-xl border border-surface-border divide-y divide-surface-border overflow-hidden">
              {filteredSegments.map((seg: any) => {
                const isActive = currentTime >= seg.start_time && currentTime <= seg.end_time;
                const isEditing = editingSegId === seg.id;
                const showWords = showWordsForSegId === seg.id;

                return (
                  <div
                    key={seg.id}
                    className={`p-4 transition-colors ${
                      isActive ? 'bg-brand-500/10 border-l-4 border-l-brand-400' : 'hover:bg-surface-lighter/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center space-x-2 text-xs">
                        {/* Clickable timestamp seeks video */}
                        <button
                          onClick={() => handleSeek(seg.start_time)}
                          className="font-mono text-brand-400 font-bold bg-brand-500/15 hover:bg-brand-500/30 px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors"
                          title="Click to seek video to this timestamp"
                        >
                          <Play className="w-2.5 h-2.5 fill-brand-400" />
                          <span>
                            {Math.floor(seg.start_time / 60)}:{(Math.floor(seg.start_time % 60)).toString().padStart(2, '0')}.{Math.floor((seg.start_time % 1) * 10)}
                          </span>
                        </button>

                        <span className="text-gray-400 flex items-center gap-1 font-semibold text-[11px]">
                          <User className="w-3 h-3 text-gray-500" />
                          {seg.speaker || 'Speaker 1'}
                        </span>

                        {seg.is_edited && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase">
                            Edited
                          </span>
                        )}
                      </div>

                      {/* Edit / Word Timestamps Toggle Buttons */}
                      <div className="flex items-center space-x-1">
                        {seg.words && seg.words.length > 0 && (
                          <button
                            onClick={() => setShowWordsForSegId(showWords ? null : seg.id)}
                            className="px-2 py-0.5 rounded bg-surface-lighter hover:bg-surface-border text-[10px] text-gray-400 hover:text-white"
                            title="Toggle Word-Level Timestamps"
                          >
                            {showWords ? 'Hide Words' : 'Words'}
                          </button>
                        )}
                        {!isEditing && (
                          <button
                            onClick={() => handleStartEdit(seg)}
                            className="p-1 rounded hover:bg-surface-lighter text-gray-400 hover:text-white"
                            title="Edit Segment Text"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Segment Text or Edit Form */}
                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          rows={2}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-surface-lighter border border-brand-500 rounded-lg p-2 text-xs text-white focus:outline-none"
                        />
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            placeholder="Speaker Label"
                            value={editSpeaker}
                            onChange={(e) => setEditSpeaker(e.target.value)}
                            className="bg-surface-lighter border border-surface-border rounded px-2 py-1 text-[11px] text-gray-300 w-36"
                          />
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => setEditingSegId(null)}
                              className="px-2.5 py-1 rounded bg-surface-lighter text-[11px] text-gray-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(seg.id)}
                              disabled={isSavingEdit}
                              className="px-3 py-1 rounded bg-accent-emerald hover:opacity-90 text-[11px] font-semibold text-black flex items-center gap-1"
                            >
                              <Save className="w-3 h-3" />
                              <span>{isSavingEdit ? 'Saving...' : 'Save'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-200 leading-relaxed">{seg.text}</p>
                    )}

                    {/* Expanded Word-Level Timestamps */}
                    {showWords && seg.words && seg.words.length > 0 && (
                      <div className="mt-2.5 p-2 rounded-lg bg-surface-lighter/60 border border-surface-border flex flex-wrap gap-1.5">
                        {seg.words.map((w: any, wIdx: number) => {
                          const isWordActive = currentTime >= w.start && currentTime <= w.end;
                          return (
                            <button
                              key={wIdx}
                              onClick={() => handleSeek(w.start)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                isWordActive
                                  ? 'bg-brand-500 text-white font-bold'
                                  : 'bg-surface hover:bg-surface-border text-gray-300'
                              }`}
                              title={`${w.start}s - ${w.end}s (conf: ${Math.round(w.probability * 100)}%)`}
                            >
                              {w.word}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bottom Next Step Banner */}
              {onNavigate && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-brand-900/30 via-surface-lighter to-brand-900/30 border border-brand-500/30 flex items-center justify-between mt-4">
                  <div>
                    <h4 className="text-xs font-bold text-white">Transcript Ready for Moment Analysis</h4>
                    <p className="text-[11px] text-gray-400">Use local AI to detect viral hooks, calculate scores, and extract vertical shorts.</p>
                  </div>
                  <button
                    onClick={() => onNavigate('clip-finder')}
                    className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Proceed to Clip Finder</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-xl p-12 text-center border border-surface-border space-y-3">
              <FileText className="w-12 h-12 text-gray-600 mx-auto" />
              <div className="text-base font-bold text-white">No Transcript Available</div>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                This video has not been transcribed yet. Click <strong>"Transcribe Video with AI"</strong> on the left to extract speech using Faster-Whisper.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
