import React, { useState } from 'react';
import { FileText, Search, Play, Edit3, Save, Check, User } from 'lucide-react';

export const TranscriptPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Sample structured transcript state to display real UI
  const [segments, setSegments] = useState([
    {
      id: 'seg-1',
      speaker: 'Speaker 1',
      start_time: 12.4,
      end_time: 18.2,
      text: "The secret to building viral YouTube Shorts isn't fancy transitions or 3D animations.",
    },
    {
      id: 'seg-2',
      speaker: 'Speaker 1',
      start_time: 18.5,
      end_time: 25.1,
      text: "It is capturing the audience within the first three seconds with an unexpected perspective.",
    },
    {
      id: 'seg-3',
      speaker: 'Speaker 2',
      start_time: 25.6,
      end_time: 34.0,
      text: "Exactly. If you deliver high educational value or an emotional punch right at the start, people don't swipe away.",
    },
    {
      id: 'seg-4',
      speaker: 'Speaker 1',
      start_time: 34.5,
      end_time: 46.8,
      text: "And when you synchronize dynamic captions that highlight word-by-word, the viewer retention jumps by over 40 percent.",
    }
  ]);

  const handleStartEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const handleSaveEdit = (id: string) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, text: editText } : s));
    setEditingId(null);
  };

  const filteredSegments = segments.filter(s =>
    s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.speaker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Full Timestamped Transcript</h2>
          <p className="text-xs text-gray-400">
            Generated with Faster-Whisper. All words and sentence boundaries are editable.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Transcript Segments List */}
      <div className="bg-surface rounded-xl border border-surface-border divide-y divide-surface-border">
        {filteredSegments.map((seg) => (
          <div key={seg.id} className="p-4 hover:bg-surface-lighter/50 transition-colors flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center space-x-3 text-xs">
                <span className="font-mono text-brand-400 font-semibold bg-brand-500/10 px-2 py-0.5 rounded text-[11px]">
                  {Math.floor(seg.start_time / 60)}:{(Math.floor(seg.start_time % 60)).toString().padStart(2, '0')} - {Math.floor(seg.end_time / 60)}:{(Math.floor(seg.end_time % 60)).toString().padStart(2, '0')}
                </span>
                <span className="text-gray-400 flex items-center gap-1 font-medium">
                  <User className="w-3 h-3 text-gray-500" />
                  {seg.speaker}
                </span>
              </div>

              {editingId === seg.id ? (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 bg-surface-lighter border border-brand-500 rounded px-2.5 py-1 text-sm text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(seg.id)}
                    className="p-1.5 rounded bg-accent-emerald text-white hover:opacity-90"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-200 leading-relaxed">{seg.text}</p>
              )}
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              {editingId !== seg.id && (
                <button
                  onClick={() => handleStartEdit(seg.id, seg.text)}
                  className="p-1.5 rounded hover:bg-surface-lighter text-gray-400 hover:text-white"
                  title="Edit Text"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
