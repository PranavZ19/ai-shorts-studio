import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Sparkles,
  Calendar,
  Clock,
  BarChart2,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lightbulb,
  Layers,
  ChevronRight,
  Bookmark,
  Share2,
  Filter,
  Check,
  ChevronLeft,
  Info,
  Sliders,
  Flame,
  ArrowUpRight,
  CalendarDays,
  Target,
  Play
} from 'lucide-react';

const YoutubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 text-red-500' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 text-pink-500' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);
import { api } from '../services/api';
import {
  ChannelProfile,
  TrendTopicItem,
  TrendDataResponse,
  ContentIdeaItem,
  ScheduledPostItem,
  PerformanceInsights,
  StrategyOverviewData,
  ClipItem,
  ProjectItem
} from '../types';

interface CreatorStrategyPageProps {
  onNavigate: (tab: string) => void;
  onSelectClip?: (id: string) => void;
}

type SubTab = 'overview' | 'trends' | 'ideas' | 'schedule' | 'calendar' | 'insights';

export const CreatorStrategyPage: React.FC<CreatorStrategyPageProps> = ({
  onNavigate,
  onSelectClip
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<ChannelProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ChannelProfile | null>(null);

  // Overview
  const [overview, setOverview] = useState<StrategyOverviewData | null>(null);

  // Trends
  const [niches, setNiches] = useState<any[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<string>('Technology');
  const [customNiche, setCustomNiche] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('US');
  const [trendsData, setTrendsData] = useState<TrendDataResponse | null>(null);
  const [analyzingTopic, setAnalyzingTopic] = useState<string | null>(null);
  const [topicAnalysisResult, setTopicAnalysisResult] = useState<Record<string, any>>({});

  // Ideas
  const [ideas, setIdeas] = useState<ContentIdeaItem[]>([]);
  const [generatingIdeas, setGeneratingIdeas] = useState<boolean>(false);

  // Schedule & Calendar
  const [platform, setPlatform] = useState<'youtube_shorts' | 'instagram_reels'>('youtube_shorts');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [generatingSchedule, setGeneratingSchedule] = useState<boolean>(false);
  const [calendarPosts, setCalendarPosts] = useState<ScheduledPostItem[]>([]);
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [calendarFilter, setCalendarFilter] = useState<string>('all');
  const [availableClips, setAvailableClips] = useState<ClipItem[]>([]);

  // Performance Insights
  const [performance, setPerformance] = useState<PerformanceInsights | null>(null);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [metricForm, setMetricForm] = useState({
    upload_day_of_week: 'Friday',
    upload_hour: 18,
    views_count: 2500,
    retention_pct: 78.5,
    likes_count: 180,
    shares_count: 45,
    comments_count: 22,
    topic: 'AI Technology',
    video_duration: 35.0,
    platform: 'youtube_shorts'
  });

  // Schedule New Post Modal
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [newScheduleData, setNewScheduleData] = useState({
    clip_id: '',
    title: '',
    topic: '',
    platform: 'youtube_shorts',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '18:00',
    priority: 'medium'
  });

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Initial Data Fetch
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [profs, nchs, ov, clps] = await Promise.all([
        api.getStrategyProfiles(),
        api.getStrategyNiches(),
        api.getStrategyOverview(),
        api.getClips()
      ]);

      setProfiles(profs);
      if (profs.length > 0) {
        setSelectedProfile(profs[0]);
        setSelectedNiche(profs[0].niche || 'Technology');
      }
      setNiches(nchs);
      setOverview(ov);
      setAvailableClips(clps.filter((c: ClipItem) => c.status === 'exported' || c.status === 'candidate'));

      // Load initial trends
      const initialTrends = await api.getTrends(profs[0]?.niche || 'Technology', 'US', false);
      setTrendsData(initialTrends);

      // Load calendar & ideas
      const [cal, idList, perf] = await Promise.all([
        api.getCalendar(),
        api.getContentIdeas(profs[0]?.niche || 'Technology'),
        api.getPerformanceInsights()
      ]);
      setCalendarPosts(cal);
      setIdeas(idList);
      setPerformance(perf);
    } catch (err: any) {
      console.error('Failed to load Strategy data:', err);
      showNotification('Failed to load initial strategy data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch Trends for specific niche/region
  const handleFetchTrends = async (forceRefresh = false) => {
    setLoading(true);
    const targetNiche = customNiche.trim() || selectedNiche;
    try {
      const res = await api.getTrends(targetNiche, selectedRegion, forceRefresh);
      setTrendsData(res);
      showNotification(
        forceRefresh ? 'Fresh trend signals collected from public sources' : 'Trending topics loaded',
        'success'
      );
    } catch (err) {
      showNotification('Unable to fetch live trends; cached baseline available', 'error');
    } finally {
      setLoading(false);
    }
  };

  // AI Deep Analyze Trend Topic
  const handleAnalyzeTopic = async (topicName: string, sourceIndicator = '') => {
    setAnalyzingTopic(topicName);
    try {
      const res = await api.analyzeTrend(topicName, selectedNiche, sourceIndicator);
      setTopicAnalysisResult(prev => ({ ...prev, [topicName]: res }));
      showNotification(`AI Strategic Blueprint generated for "${topicName.slice(0, 30)}..."`, 'success');
    } catch (err) {
      showNotification('AI analysis failed', 'error');
    } finally {
      setAnalyzingTopic(null);
    }
  };

  // Generate Personalized Content Ideas
  const handleGenerateIdeas = async () => {
    setGeneratingIdeas(true);
    const targetNiche = customNiche.trim() || selectedNiche;
    const topics = trendsData?.topics.map(t => t.topic_name) || [];
    try {
      const res = await api.generateContentIdeas({
        niche: targetNiche,
        trending_topics: topics,
        count: 4
      });
      const freshIdeas = await api.getContentIdeas(targetNiche);
      setIdeas(freshIdeas);
      showNotification(`Generated ${res.ideas_count} personalized short concepts!`, 'success');
    } catch (err) {
      showNotification('Failed to generate content ideas', 'error');
    } finally {
      setGeneratingIdeas(false);
    }
  };

  // Save Idea Status
  const handleUpdateIdeaStatus = async (ideaId: string, status: string) => {
    try {
      await api.updateContentIdeaStatus(ideaId, status);
      setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, status: status as any } : i));
      showNotification(`Idea status updated to ${status}`, 'success');
    } catch (err) {
      showNotification('Failed to update idea status', 'error');
    }
  };

  // Convert Idea to Project
  const handleConvertToProject = async (ideaId: string) => {
    try {
      const res = await api.convertIdeaToProject(ideaId);
      showNotification(`Created new project: "${res.project_name}"`, 'success');
      onNavigate('video-library');
    } catch (err) {
      showNotification('Failed to convert idea to project', 'error');
    }
  };

  // Generate Recommended Schedule
  const handleGenerateSchedule = async () => {
    setGeneratingSchedule(true);
    try {
      const res = await api.getScheduleRecommendations({
        profile_id: selectedProfile?.id,
        platform,
        days_ahead: 7,
        timezone: selectedProfile?.timezone || 'UTC'
      });
      setRecommendations(res.schedule || []);
      showNotification(`Generated ${res.recommendations_count} optimal upload slots!`, 'success');
    } catch (err) {
      showNotification('Failed to generate schedule recommendations', 'error');
    } finally {
      setGeneratingSchedule(false);
    }
  };

  // Commit Schedule to Calendar
  const handleCommitSchedule = async () => {
    if (recommendations.length === 0) return;
    try {
      const res = await api.commitSchedule(recommendations);
      const updatedCal = await api.getCalendar();
      setCalendarPosts(updatedCal);
      setRecommendations([]);
      setActiveTab('calendar');
      showNotification(`Committed ${res.saved_count} uploads to the Content Calendar!`, 'success');
    } catch (err) {
      showNotification('Failed to commit schedule', 'error');
    }
  };

  // Update Scheduled Post Status
  const handlePostStatus = async (postId: string, status: string) => {
    try {
      await api.updatePostStatus(postId, status);
      setCalendarPosts(prev => prev.map(p => p.id === postId ? { ...p, status: status as any } : p));
      showNotification(`Post marked as ${status}`, 'success');
    } catch (err) {
      showNotification('Failed to update status', 'error');
    }
  };

  // Delete Calendar Post
  const handleDeletePost = async (postId: string) => {
    try {
      await api.deleteCalendarPost(postId);
      setCalendarPosts(prev => prev.filter(p => p.id !== postId));
      showNotification('Scheduled post removed', 'success');
    } catch (err) {
      showNotification('Failed to delete post', 'error');
    }
  };

  // Add Manual Calendar Post
  const handleAddCalendarPost = async () => {
    if (!newScheduleData.title.trim() || !newScheduleData.scheduled_date) {
      showNotification('Please provide a title and date', 'error');
      return;
    }
    try {
      await api.addCalendarPost({
        clip_id: newScheduleData.clip_id || undefined,
        title: newScheduleData.title,
        topic: newScheduleData.topic,
        platform: newScheduleData.platform,
        scheduled_date: newScheduleData.scheduled_date,
        scheduled_time: newScheduleData.scheduled_time,
        priority: newScheduleData.priority
      });
      const updated = await api.getCalendar();
      setCalendarPosts(updated);
      setShowScheduleModal(false);
      showNotification('Post added to calendar', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to add calendar post', 'error');
    }
  };

  // Log Performance Metric
  const handleLogPerformance = async () => {
    try {
      await api.logPerformanceMetric(metricForm);
      const perf = await api.getPerformanceInsights();
      setPerformance(perf);
      setShowLogModal(false);
      showNotification('Performance metrics recorded! AI learning updated.', 'success');
    } catch (err) {
      showNotification('Failed to record metrics', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center space-x-2 border transition-all duration-200 ${
          notification.type === 'success'
            ? 'bg-accent-emerald/20 text-emerald-300 border-accent-emerald/40'
            : 'bg-red-500/20 text-red-300 border-red-500/40'
        }`}>
          {notification.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-surface-border pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-purple text-white shadow-lg shadow-brand-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                AI Creator Strategy & Trend Engine
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30">
                  Phase 8
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Discover viral trends, generate personalized content ideas, and schedule high-retention uploads.
              </p>
            </div>
          </div>
        </div>

        {/* Global Channel & Niche Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Channel Profile Selector */}
          <div className="flex items-center space-x-1.5 bg-surface-lighter/80 border border-surface-border px-3 py-1.5 rounded-lg text-xs">
            <Target className="w-3.5 h-3.5 text-brand-400" />
            <select
              value={selectedProfile?.id || ''}
              onChange={(e) => {
                const prof = profiles.find(p => p.id === e.target.value);
                if (prof) {
                  setSelectedProfile(prof);
                  setSelectedNiche(prof.niche);
                }
              }}
              className="bg-transparent text-gray-200 outline-none cursor-pointer text-xs"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id} className="bg-surface text-gray-200">
                  {p.name} ({p.niche})
                </option>
              ))}
            </select>
          </div>

          {/* Region Selector */}
          <div className="flex items-center space-x-1.5 bg-surface-lighter/80 border border-surface-border px-3 py-1.5 rounded-lg text-xs">
            <span className="text-gray-400">Geo:</span>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
              }}
              className="bg-transparent text-gray-200 outline-none cursor-pointer text-xs font-semibold"
            >
              <option value="US" className="bg-surface">United States (US)</option>
              <option value="GLOBAL" className="bg-surface">Global Worldwide</option>
              <option value="IN" className="bg-surface">India (IN)</option>
              <option value="GB" className="bg-surface">United Kingdom (GB)</option>
              <option value="CA" className="bg-surface">Canada (CA)</option>
            </select>
          </div>

          {/* Quick Refresh Trends Button */}
          <button
            onClick={() => handleFetchTrends(true)}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface-lighter hover:bg-surface-border text-gray-300 rounded-lg text-xs font-medium border border-surface-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
            <span>Refresh Trends</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-surface-border overflow-x-auto pb-1 scrollbar-thin">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'trends', label: 'Trending Topics', icon: Flame },
          { id: 'ideas', label: 'Content Ideas', icon: Lightbulb },
          { id: 'schedule', label: 'Upload Schedule', icon: Clock },
          { id: 'calendar', label: 'Content Calendar', icon: CalendarDays },
          { id: 'insights', label: 'Performance Insights', icon: Sparkles }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SubTab)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-lighter'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface p-4 rounded-xl border border-surface-border space-y-1">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Active Niche</span>
              <p className="text-xl font-bold text-white flex items-center justify-between">
                <span>{selectedProfile?.niche || 'Technology'}</span>
                <Target className="w-5 h-5 text-brand-400 opacity-80" />
              </p>
              <span className="text-[11px] text-brand-400 font-medium">
                {selectedProfile?.target_audience_region} Region • {selectedProfile?.preferred_frequency_per_week || 5}x / week
              </span>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-surface-border space-y-1">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Top Trend Momentum</span>
              <p className="text-xl font-bold text-accent-emerald flex items-center justify-between">
                <span>{trendsData?.topics[0]?.trend_status.toUpperCase() || 'RISING'}</span>
                <Flame className="w-5 h-5 text-accent-emerald opacity-80" />
              </p>
              <span className="text-[11px] text-gray-400 truncate block">
                {trendsData?.topics[0]?.topic_name || 'Monitoring Public Feeds'}
              </span>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-surface-border space-y-1">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ideas in Pipeline</span>
              <p className="text-xl font-bold text-white flex items-center justify-between">
                <span>{ideas.length} Concepts</span>
                <Lightbulb className="w-5 h-5 text-amber-400 opacity-80" />
              </p>
              <span className="text-[11px] text-gray-400">
                {ideas.filter(i => i.status === 'saved').length} Saved • {ideas.filter(i => i.status === 'in_production').length} In Production
              </span>
            </div>

            <div className="bg-surface p-4 rounded-xl border border-surface-border space-y-1">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Upcoming Uploads</span>
              <p className="text-xl font-bold text-accent-cyan flex items-center justify-between">
                <span>{calendarPosts.filter(p => p.status === 'scheduled').length} Scheduled</span>
                <Calendar className="w-5 h-5 text-accent-cyan opacity-80" />
              </p>
              <span className="text-[11px] text-gray-400">
                Next: {calendarPosts[0]?.scheduled_date || 'None'} ({calendarPosts[0]?.scheduled_time || '--'})
              </span>
            </div>
          </div>

          {/* 2-Column High-Priority Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Trending Signals */}
            <div className="bg-surface rounded-xl border border-surface-border p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-semibold text-white">Top Trending Signals in {selectedNiche}</h3>
                </div>
                <button
                  onClick={() => setActiveTab('trends')}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {trendsData?.topics.slice(0, 3).map((t, idx) => (
                  <div key={idx} className="p-3 bg-surface-lighter/60 rounded-lg border border-surface-border space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-white">{t.topic_name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        {t.opportunity_score}/100 Score
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 line-clamp-2">{t.explanation}</p>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                      <span className="text-brand-400">{t.source}</span>
                      <span>{t.trend_indicator}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Recommended Content Ideas */}
            <div className="bg-surface rounded-xl border border-surface-border p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Recommended Video Concepts</h3>
                </div>
                <button
                  onClick={() => setActiveTab('ideas')}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1"
                >
                  <span>Explore Ideas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {ideas.length > 0 ? (
                  ideas.slice(0, 3).map((idea, idx) => (
                    <div key={idx} className="p-3 bg-surface-lighter/60 rounded-lg border border-surface-border space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-white">{idea.suggested_title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                          {Math.round(idea.recommended_duration_seconds)}s
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-300/90 italic bg-amber-950/20 p-2 rounded border border-amber-500/20">
                        "{idea.opening_hook}"
                      </div>
                      <p className="text-[11px] text-gray-400 line-clamp-1">{idea.concept}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    No ideas generated yet. Click below to generate from current trends.
                    <div className="mt-3">
                      <button
                        onClick={handleGenerateIdeas}
                        disabled={generatingIdeas}
                        className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-500"
                      >
                        {generatingIdeas ? 'Generating...' : 'Generate First Ideas'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Publishing Optimization & Available Clip Opportunities */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recommended Posting Windows */}
            <div className="bg-surface rounded-xl border border-surface-border p-5 space-y-3">
              <div className="flex items-center space-x-2 border-b border-surface-border pb-2.5">
                <Clock className="w-4 h-4 text-accent-cyan" />
                <h3 className="text-sm font-semibold text-white">Recommended Posting Windows</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded bg-surface-lighter/50 border border-surface-border">
                  <span className="text-gray-400 block text-[10px]">YouTube Shorts Peak:</span>
                  <span className="font-semibold text-white">12:00 PM – 3:00 PM & 6:00 PM – 8:00 PM</span>
                  <span className="text-[10px] text-emerald-400 block mt-0.5">Top Days: Thursday – Sunday</span>
                </div>
                <div className="p-2.5 rounded bg-surface-lighter/50 border border-surface-border">
                  <span className="text-gray-400 block text-[10px]">Instagram Reels Peak:</span>
                  <span className="font-semibold text-white">9:00 AM, 1:00 PM & 7:00 PM – 9:00 PM</span>
                  <span className="text-[10px] text-emerald-400 block mt-0.5">Top Days: Tuesday, Wednesday, Friday</span>
                </div>
              </div>
            </div>

            {/* Ready Video Clips Ready to Schedule */}
            <div className="bg-surface rounded-xl border border-surface-border p-5 space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-accent-purple" />
                  <h3 className="text-sm font-semibold text-white">Ready-to-Schedule Shorts in Library</h3>
                </div>
                <span className="text-xs text-gray-400">{availableClips.length} Available</span>
              </div>

              {availableClips.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableClips.slice(0, 4).map((clip) => (
                    <div key={clip.id} className="p-2.5 bg-surface-lighter/60 rounded-lg border border-surface-border flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-white truncate">{clip.title || 'Untitled Short'}</h4>
                        <span className="text-[10px] text-gray-400">
                          {Math.round(clip.duration)}s • Virality Score: {clip.overall_score}/100
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setNewScheduleData(prev => ({
                            ...prev,
                            clip_id: clip.id,
                            title: clip.title || 'Exported Short',
                            topic: clip.main_topic || 'Highlight'
                          }));
                          setShowScheduleModal(true);
                        }}
                        className="px-2.5 py-1 bg-brand-600/20 hover:bg-brand-600 text-brand-300 hover:text-white rounded text-[11px] font-medium border border-brand-500/30 transition-colors shrink-0"
                      >
                        Schedule
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-gray-400">
                  No rendered clips in library. Transcribe and render your first short in Phase 5!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: TRENDING TOPICS ==================== */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Niche & Source Filter Bar */}
          <div className="bg-surface p-4 rounded-xl border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-xs font-semibold text-gray-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Niche:
              </span>
              <select
                value={selectedNiche}
                onChange={(e) => {
                  setSelectedNiche(e.target.value);
                  setCustomNiche('');
                }}
                className="bg-surface-lighter border border-surface-border text-white text-xs px-3 py-1.5 rounded-lg outline-none"
              >
                {niches.map((n) => (
                  <option key={n.id} value={n.name}>{n.name}</option>
                ))}
                <option value="custom">Custom Niche...</option>
              </select>

              {selectedNiche === 'custom' && (
                <input
                  type="text"
                  placeholder="Enter custom niche..."
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  className="bg-surface-lighter border border-surface-border text-white text-xs px-3 py-1.5 rounded-lg outline-none w-48"
                />
              )}

              <button
                onClick={() => handleFetchTrends(false)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Apply Niche
              </button>
            </div>

            <div className="flex items-center space-x-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  trendsData?.is_fallback ? 'bg-amber-400' : trendsData?.is_cached ? 'bg-cyan-400' : 'bg-emerald-400 animate-pulse'
                }`} />
                Source: <strong className="text-gray-200">{trendsData?.source || 'Public Feeds'}</strong>
              </span>
              <span>•</span>
              <span>Collected: {trendsData?.fetched_at ? new Date(trendsData.fetched_at).toLocaleTimeString() : 'Recent'}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                trendsData?.is_fallback
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : trendsData?.is_cached
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}>
                {trendsData?.is_fallback ? 'Curated Baseline Reference' : trendsData?.is_cached ? 'Locally Cached Snapshot' : 'Live Public Feed'}
              </span>
            </div>
          </div>

          {/* Trend Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {trendsData?.topics.map((t, idx) => {
              const analysis = topicAnalysisResult[t.topic_name];
              const isAnalyzing = analyzingTopic === t.topic_name;

              return (
                <div key={idx} className="bg-surface rounded-xl border border-surface-border p-5 space-y-4 hover:border-surface-lighter transition-all">
                  {/* Topic Header */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold text-white tracking-tight">{t.topic_name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                        t.trend_status === 'rising'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {t.trend_status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-gray-400">
                      <span className="text-brand-400 font-medium">{t.source}</span>
                      <span>•</span>
                      <span>{t.region}</span>
                      <span>•</span>
                      <span className="text-accent-emerald font-semibold">{t.trend_indicator}</span>
                      {t.source_url && (
                        <a
                          href={t.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-400 hover:text-white inline-flex items-center ml-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Explanation */}
                  <p className="text-xs text-gray-300 leading-relaxed">{t.explanation}</p>

                  {/* Why Attention */}
                  {t.why_attention && (
                    <div className="p-2.5 rounded bg-surface-lighter/60 border border-surface-border text-xs text-gray-300 space-y-1">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Why It's Gaining Attention:</span>
                      <p>{t.why_attention}</p>
                    </div>
                  )}

                  {/* Opportunity Score Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 text-[11px]">AI Opportunity Assessment</span>
                      <span className="font-bold text-white">{t.opportunity_score} / 100</span>
                    </div>
                    <div className="w-full bg-surface-lighter rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 via-accent-cyan to-accent-emerald rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(10, t.opportunity_score))}%` }}
                      />
                    </div>
                  </div>

                  {/* Keywords & Hashtags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.suggested_hashtags.map((h, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-surface-lighter text-gray-400">
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Strategic Blueprint Action */}
                  <div className="pt-2 border-t border-surface-border flex items-center justify-between">
                    <button
                      onClick={() => handleAnalyzeTopic(t.topic_name, t.trend_indicator)}
                      disabled={isAnalyzing}
                      className="px-3 py-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border text-brand-300 hover:text-brand-200 text-xs font-medium border border-surface-border flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-brand-400' : ''}`} />
                      <span>{isAnalyzing ? 'Analyzing with AI...' : 'Generate AI Hooks & Angles'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('ideas');
                        handleGenerateIdeas();
                      }}
                      className="text-xs text-gray-400 hover:text-white flex items-center space-x-1"
                    >
                      <span>Draft Concept</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Expanded AI Analysis Result */}
                  {analysis && (
                    <div className="mt-3 p-3.5 rounded-lg bg-brand-950/20 border border-brand-500/30 text-xs space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-brand-400 font-semibold text-[11px]">
                        <span>AI Strategic Blueprint</span>
                        <span className="text-[10px] text-gray-400">Local Qwen Engine</span>
                      </div>

                      {analysis.suggested_titles && (
                        <div>
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Suggested Short Titles:</span>
                          <ul className="space-y-1">
                            {analysis.suggested_titles.map((title: string, ti: number) => (
                              <li key={ti} className="text-white font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                                {title}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysis.suggested_hooks && (
                        <div>
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Opening Hooks (First 3s):</span>
                          <div className="space-y-1.5">
                            {analysis.suggested_hooks.map((hook: string, hi: number) => (
                              <div key={hi} className="text-amber-300/90 italic bg-black/30 p-2 rounded border border-amber-500/20">
                                "{hook}"
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: CONTENT IDEAS ==================== */}
      {activeTab === 'ideas' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-surface p-4 rounded-xl border border-surface-border">
            <div>
              <h2 className="text-sm font-semibold text-white">Personalized Short Concepts</h2>
              <p className="text-xs text-gray-400">
                Generated from real trending momentum combined with your uploaded transcripts and past video history.
              </p>
            </div>
            <button
              onClick={handleGenerateIdeas}
              disabled={generatingIdeas}
              className="px-4 py-2 bg-gradient-to-r from-brand-600 to-accent-purple text-white rounded-lg text-xs font-medium hover:brightness-110 flex items-center space-x-2 disabled:opacity-50 transition-all shadow-md shadow-brand-500/20"
            >
              <Sparkles className={`w-3.5 h-3.5 ${generatingIdeas ? 'animate-spin' : ''}`} />
              <span>{generatingIdeas ? 'Synthesizing Concepts...' : 'Generate 4 New Ideas'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {ideas.map((idea, idx) => (
              <div key={idx} className="bg-surface rounded-xl border border-surface-border p-5 space-y-4 hover:border-surface-lighter transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 uppercase tracking-wider">
                      {idea.niche} • {Math.round(idea.recommended_duration_seconds)}s Target
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{idea.suggested_title}</h3>
                  </div>

                  <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap capitalize ${
                    idea.status === 'in_production'
                      ? 'bg-accent-purple/20 text-accent-purple border-accent-purple/40'
                      : idea.status === 'saved'
                      ? 'bg-accent-emerald/20 text-emerald-300 border-accent-emerald/40'
                      : 'bg-surface-lighter text-gray-400 border-surface-border'
                  }`}>
                    {idea.status}
                  </span>
                </div>

                {/* Spoken Hook Box */}
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 space-y-1">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">Spoken Hook (First 3-5s):</span>
                  <p className="text-xs text-amber-200/90 italic font-medium leading-relaxed">
                    "{idea.opening_hook}"
                  </p>
                </div>

                {/* Concept & Description */}
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Premise & Flow:</span>
                  <p className="text-gray-300 leading-relaxed">{idea.concept}</p>
                </div>

                {/* Why Create & Target Audience */}
                {idea.why_create && (
                  <div className="text-[11px] text-gray-400 bg-surface-lighter/50 p-2.5 rounded border border-surface-border">
                    <strong className="text-gray-300">Why It Works:</strong> {idea.why_create}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 border-t border-surface-border flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUpdateIdeaStatus(idea.id!, idea.status === 'saved' ? 'suggested' : 'saved')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition-colors ${
                        idea.status === 'saved'
                          ? 'bg-accent-emerald/20 text-emerald-300 border-accent-emerald/40'
                          : 'bg-surface-lighter text-gray-300 border-surface-border hover:bg-surface-border'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{idea.status === 'saved' ? 'Saved' : 'Save'}</span>
                    </button>

                    <button
                      onClick={() => handleConvertToProject(idea.id!)}
                      className="px-3 py-1.5 rounded-lg bg-surface-lighter hover:bg-surface-border text-brand-300 text-xs font-medium border border-surface-border flex items-center space-x-1.5 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Create Project</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setNewScheduleData(prev => ({
                        ...prev,
                        title: idea.suggested_title,
                        topic: idea.topic
                      }));
                      setShowScheduleModal(true);
                    }}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center space-x-1"
                  >
                    <span>Schedule</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 4: UPLOAD SCHEDULE ==================== */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* Scheduler Control Panel */}
          <div className="bg-surface p-5 rounded-xl border border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-400" />
                  Intelligent Upload Slot Allocator
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Calculates highest-retention publishing hours and spreads your library across optimal days.
                </p>
              </div>

              {/* Platform Selector */}
              <div className="flex items-center space-x-1 bg-surface-lighter p-1 rounded-lg border border-surface-border">
                <button
                  onClick={() => setPlatform('youtube_shorts')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-all ${
                    platform === 'youtube_shorts'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <YoutubeIcon className="w-3.5 h-3.5" />
                  <span>YouTube Shorts</span>
                </button>
                <button
                  onClick={() => setPlatform('instagram_reels')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-all ${
                    platform === 'instagram_reels'
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <InstagramIcon className="w-3.5 h-3.5" />
                  <span>Instagram Reels</span>
                </button>
              </div>
            </div>

            {/* Recommendation Reasoning Banner */}
            <div className="p-3.5 rounded-lg bg-surface-lighter/60 border border-surface-border flex items-start space-x-3 text-xs">
              <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">
                  {platform === 'youtube_shorts' ? 'YouTube Shorts Algorithm Strategy' : 'Instagram Reels Algorithm Strategy'}
                </strong>
                <p className="text-gray-400 leading-relaxed">
                  {platform === 'youtube_shorts'
                    ? 'Recommended pacing: 5-7 videos/week. Best performance window: 12:00-15:00 and 18:00-21:00 UTC (early evening relaxation). Automatic 4-hour collision prevention active.'
                    : 'Recommended pacing: 4-5 videos/week. Best performance window: 09:00, 13:00 and 19:00-21:00 UTC. Prioritizes Tuesday, Wednesday and Friday prime-time scroll.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-400">
                Ready Shorts in Queue: <strong className="text-white">{availableClips.length} clips</strong>
              </span>

              <button
                onClick={handleGenerateSchedule}
                disabled={generatingSchedule}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${generatingSchedule ? 'animate-spin' : ''}`} />
                <span>{generatingSchedule ? 'Calculating Slots...' : 'Generate Recommended Week'}</span>
              </button>
            </div>
          </div>

          {/* Generated Recommended Slots Preview */}
          {recommendations.length > 0 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Recommended Publishing Queue</h3>
                <button
                  onClick={handleCommitSchedule}
                  className="px-4 py-2 bg-accent-emerald hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Commit All to Content Calendar</span>
                </button>
              </div>

              <div className="space-y-3">
                {recommendations.map((slot, idx) => (
                  <div key={idx} className="bg-surface p-4 rounded-xl border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{slot.scheduled_date} at {slot.scheduled_time}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-surface-lighter text-gray-400 uppercase">
                          {slot.platform.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 font-semibold">
                          {slot.priority.toUpperCase()} PRIORITY
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-gray-200">{slot.title}</h4>
                      <p className="text-[11px] text-gray-400">{slot.recommendation_reason}</p>
                    </div>

                    <div className="text-right text-xs">
                      <span className="text-accent-emerald font-semibold text-[11px] block">Slot Approved</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 5: CONTENT CALENDAR ==================== */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Calendar Controls */}
          <div className="bg-surface p-4 rounded-xl border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 bg-surface-lighter p-1 rounded-lg border border-surface-border">
                <button
                  onClick={() => setCalendarView('week')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    calendarView === 'week' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Weekly View
                </button>
                <button
                  onClick={() => setCalendarView('month')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    calendarView === 'month' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Monthly View
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={calendarFilter}
                onChange={(e) => setCalendarFilter(e.target.value)}
                className="bg-surface-lighter border border-surface-border text-white text-xs px-3 py-1.5 rounded-lg outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled Only</option>
                <option value="published">Published</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>

            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Schedule Custom Post</span>
            </button>
          </div>

          {/* Calendar Entries List */}
          <div className="space-y-3">
            {calendarPosts
              .filter(p => calendarFilter === 'all' || p.status === calendarFilter)
              .map((post) => (
                <div key={post.id} className="bg-surface p-4 rounded-xl border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-lg bg-surface-lighter flex flex-col items-center justify-center shrink-0 border border-surface-border text-center">
                      <span className="text-[9px] uppercase font-bold text-brand-400">
                        {new Date(post.scheduled_date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-xs font-extrabold text-white">
                        {new Date(post.scheduled_date).getDate()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        {post.platform === 'youtube_shorts' ? (
                          <YoutubeIcon className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <InstagramIcon className="w-3.5 h-3.5 text-pink-500" />
                        )}
                        <span className="text-xs font-bold text-white">{post.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                          post.status === 'published'
                            ? 'bg-accent-emerald/20 text-emerald-300 border-accent-emerald/40'
                            : post.status === 'skipped'
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-brand-500/10 text-brand-400 border-brand-500/30'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {post.scheduled_date} at {post.scheduled_time} ({post.timezone}) • {post.recommendation_reason || 'Manual entry'}
                      </p>
                    </div>
                  </div>

                  {/* Calendar Card Actions */}
                  <div className="flex items-center space-x-2 self-end md:self-center">
                    {post.clip_id && (
                      <button
                        onClick={() => {
                          onSelectClip?.(post.clip_id!);
                          onNavigate('publishing');
                        }}
                        className="px-2.5 py-1 bg-brand-500/20 hover:bg-brand-500 text-brand-300 hover:text-white rounded text-[11px] font-medium border border-brand-500/40 transition-colors flex items-center gap-1"
                        title="Open AI Publishing Kit"
                      >
                        <Share2 className="w-3 h-3 text-pink-400" />
                        <span>Publishing Kit</span>
                      </button>
                    )}

                    {post.status !== 'published' && (
                      <button
                        onClick={() => handlePostStatus(post.id!, 'published')}
                        className="px-2.5 py-1 bg-accent-emerald/20 hover:bg-accent-emerald text-emerald-300 hover:text-white rounded text-[11px] font-medium border border-accent-emerald/40 transition-colors"
                      >
                        Mark Published
                      </button>
                    )}

                    {post.status !== 'skipped' && (
                      <button
                        onClick={() => handlePostStatus(post.id!, 'skipped')}
                        className="px-2.5 py-1 bg-surface-lighter hover:bg-surface-border text-gray-400 hover:text-white rounded text-[11px] font-medium border border-surface-border transition-colors"
                      >
                        Skip
                      </button>
                    )}

                    <button
                      onClick={() => handleDeletePost(post.id!)}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                      title="Delete entry"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

            {calendarPosts.length === 0 && (
              <div className="text-center py-12 bg-surface rounded-xl border border-surface-border text-gray-400 text-xs">
                No uploads on the calendar yet. Generate recommendations above or schedule a clip directly.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 6: PERFORMANCE INSIGHTS ==================== */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-surface p-4 rounded-xl border border-surface-border">
            <div>
              <h2 className="text-sm font-semibold text-white">Empirical Channel Performance Learning</h2>
              <p className="text-xs text-gray-400">
                {performance?.message || 'Analyzes your uploaded videos to reveal true empirical patterns.'}
              </p>
            </div>
            <button
              onClick={() => setShowLogModal(true)}
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Log Video Performance</span>
            </button>
          </div>

          {!performance?.has_enough_data && (
            <div className="p-3.5 rounded-lg bg-surface-lighter/80 border border-surface-border flex items-start space-x-3 text-xs">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Using General Estimates</strong>
                <p className="text-gray-400 leading-relaxed">
                  {performance?.message || 'Using general posting-time estimates. Add your publishing performance data to personalize recommendations.'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-surface p-5 rounded-xl border border-surface-border space-y-3">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Best Days to Post</span>
              <div className="space-y-2">
                {performance?.best_days.map((day, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-surface-lighter/60 border border-surface-border">
                    <span className="font-semibold text-white">#{i + 1} {day}</span>
                    <span className="text-accent-emerald text-[11px] font-medium">Top Engagement</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-surface-border space-y-3">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Best Hours to Post</span>
              <div className="space-y-2">
                {performance?.best_hours.map((hour, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-surface-lighter/60 border border-surface-border">
                    <span className="font-semibold text-white">#{i + 1} {hour}</span>
                    <span className="text-accent-cyan text-[11px] font-medium">Peak Scroll</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-surface-border space-y-3">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Optimal Short Length</span>
              <div className="p-4 rounded-lg bg-surface-lighter/60 border border-surface-border text-center space-y-1">
                <span className="text-2xl font-black text-brand-400">{performance?.optimal_length_range || '30 - 45s'}</span>
                <p className="text-[11px] text-gray-400">Highest completion and retention rate across your niche.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Schedule Custom Post */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border w-full max-w-md rounded-xl p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-white">Schedule Short Upload</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gray-400 block mb-1">Post Title</label>
                <input
                  type="text"
                  value={newScheduleData.title}
                  onChange={(e) => setNewScheduleData({ ...newScheduleData, title: e.target.value })}
                  className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  placeholder="e.g. 3 AI Tools That Feel Illegal to Know"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Platform</label>
                <select
                  value={newScheduleData.platform}
                  onChange={(e) => setNewScheduleData({ ...newScheduleData, platform: e.target.value })}
                  className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                >
                  <option value="youtube_shorts">YouTube Shorts</option>
                  <option value="instagram_reels">Instagram Reels</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Date</label>
                  <input
                    type="date"
                    value={newScheduleData.scheduled_date}
                    onChange={(e) => setNewScheduleData({ ...newScheduleData, scheduled_date: e.target.value })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Time</label>
                  <input
                    type="time"
                    value={newScheduleData.scheduled_time}
                    onChange={(e) => setNewScheduleData({ ...newScheduleData, scheduled_time: e.target.value })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-border flex justify-end space-x-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCalendarPost}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg"
              >
                Schedule Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log Performance Metrics */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border w-full max-w-md rounded-xl p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-white">Log Actual Upload Performance</h3>
              <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Day of Week</label>
                  <select
                    value={metricForm.upload_day_of_week}
                    onChange={(e) => setMetricForm({ ...metricForm, upload_day_of_week: e.target.value })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Upload Hour (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={metricForm.upload_hour}
                    onChange={(e) => setMetricForm({ ...metricForm, upload_hour: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 block mb-1">Views Count</label>
                  <input
                    type="number"
                    min="0"
                    value={metricForm.views_count}
                    onChange={(e) => setMetricForm({ ...metricForm, views_count: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Retention %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={metricForm.retention_pct}
                    onChange={(e) => setMetricForm({ ...metricForm, retention_pct: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-gray-400 block mb-1">Likes</label>
                  <input
                    type="number"
                    min="0"
                    value={metricForm.likes_count}
                    onChange={(e) => setMetricForm({ ...metricForm, likes_count: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Shares</label>
                  <input
                    type="number"
                    min="0"
                    value={metricForm.shares_count}
                    onChange={(e) => setMetricForm({ ...metricForm, shares_count: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Comments</label>
                  <input
                    type="number"
                    min="0"
                    value={metricForm.comments_count}
                    onChange={(e) => setMetricForm({ ...metricForm, comments_count: parseInt(e.target.value) || 0 })}
                    className="w-full bg-surface-lighter border border-surface-border px-3 py-2 rounded-lg text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-surface-border flex justify-end space-x-2">
              <button
                onClick={() => setShowLogModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleLogPerformance}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg"
              >
                Save Metrics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
