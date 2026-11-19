import React from 'react';
import {
  Share2,
  Video,
  CheckCircle2,
  AlertCircle,
  Download,
  Calendar,
  Lock,
  ArrowRight
} from 'lucide-react';

interface PublishingPageProps {
  onNavigate: (tab: string) => void;
}

export const PublishingPage: React.FC<PublishingPageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Social Media Publishing</h2>
        <p className="text-xs text-gray-400">
          Official OAuth 2.0 integration for YouTube Shorts and Instagram Graph API. All media files remain permanently saved on your local machine.
        </p>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-surface rounded-xl p-4 border border-surface-border flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-bold text-white">Direct Local Download is Always Available</div>
          <p className="text-gray-400">
            Publishing to social media is optional. If API quota limits or platform restrictions occur, your rendered 9:16 vertical videos remain intact and can be downloaded directly from the Download Center for manual upload.
          </p>
          <button
            onClick={() => onNavigate('downloads')}
            className="text-brand-400 hover:underline font-semibold flex items-center gap-1 pt-1"
          >
            <span>Open Download Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Platform Connection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* YouTube Shorts */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Video className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">YouTube Shorts</h3>
                <span className="text-[10px] text-gray-400">Google OAuth 2.0 API</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
              Not Connected
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Upload approved vertical clips directly to your YouTube channel with auto-generated titles, tags, and descriptions.
          </p>

          <button
            disabled
            className="w-full py-2 rounded-lg bg-surface-lighter border border-surface-border text-xs font-semibold text-gray-400 flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Connect YouTube Channel (Phase 8)</span>
          </button>
        </div>

        {/* Instagram Reels */}
        <div className="bg-surface rounded-xl p-5 border border-surface-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-pink-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Instagram Reels</h3>
                <span className="text-[10px] text-gray-400">Instagram Graph API</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
              Not Connected
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Publish to Instagram Professional / Creator accounts with platform-optimized captions and relevant hashtags.
          </p>

          <button
            disabled
            className="w-full py-2 rounded-lg bg-surface-lighter border border-surface-border text-xs font-semibold text-gray-400 flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Connect Instagram Account (Phase 8)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
