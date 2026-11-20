export interface HardwareStatus {
  os: {
    system: string;
    release: string;
    version: string;
    architecture: string;
  };
  cpu: {
    processor: string;
    physical_cores: number;
    logical_cores: number;
    current_usage_percent: number;
  };
  ram: {
    total_gb: number;
    available_gb: number;
    used_gb: number;
    percent_used: number;
  };
  gpu: {
    has_nvidia_gpu: boolean;
    name: string;
    driver_version: string;
    vram_total_mb: number;
    vram_used_mb: number;
    cuda_available: boolean;
    acceleration_mode: string;
  };
  disk: {
    storage_root: string;
    disks: Array<{
      device: string;
      mountpoint: string;
      total_gb: number;
      free_gb: number;
      percent_used: number;
    }>;
  };
  ffmpeg: {
    ffmpeg_installed: boolean;
    ffmpeg_bin: string;
    ffmpeg_version: string;
    ffprobe_installed: boolean;
    ffprobe_bin: string;
    ffprobe_version: string;
    nvenc_hardware_acceleration: boolean;
  };
  ollama: {
    running: boolean;
    url: string;
    available_models: string[];
  };
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  video_count: number;
  clip_count: number;
  approved_clip_count: number;
}

export interface SourceVideoItem {
  id: string;
  project_id: string;
  title: string;
  source_type: string;
  source_url?: string;
  channel_name?: string;
  duration: number;
  width: number;
  height: number;
  aspect_ratio?: string;
  fps: number;
  codec?: string;
  audio_codec?: string;
  has_audio?: boolean;
  file_size: number;
  status: string;
  thumbnail_url?: string;
  preview_url?: string;
  created_at: string;
}

export interface ClipItem {
  id: string;
  project_id: string;
  video_id?: string;
  title: string;
  description?: string;
  tags?: string[];
  is_favorite?: boolean;
  source_title?: string;
  main_topic?: string;
  start_time: number;
  end_time: number;
  duration: number;
  resolution?: string;
  aspect_ratio?: string;
  overall_score: number;
  hook_score: number;
  emotional_score: number;
  curiosity_score: number;
  story_score: number;
  information_score: number;
  shareability_score: number;
  ending_score?: number;
  clarity_score?: number;
  hook_summary?: string;
  target_audience?: string;
  score_explanation?: string;
  analysis_mode?: string;
  status: string;
  is_approved: boolean;
  thumbnail_url?: string;
  video_url?: string;
  stream_url?: string;
  download_url?: string;
  srt_download_url?: string;
  vtt_download_url?: string;
  metadata_download_url?: string;
  zip_download_url?: string;
  has_rendered_video?: boolean;
  output_path?: string;
  file_size_bytes?: number;
  ai_metadata?: {
    titles?: string[];
    descriptions?: string[];
    hashtags?: string[];
    target_audience?: string;
    key_takeaways?: string[];
    caption?: string;
    pinned_comment?: string;
    hook_summary?: string;
  };
  edit_config?: {
    aspect_ratio?: string;
    crop_mode?: string;
    framing?: string;
    manual_position?: number;
    caption_enabled?: boolean;
    caption_preset?: string;
    font_size?: number;
    text_color?: string;
    highlight_color?: string;
    outline_color?: string;
    outline_width?: number;
    position_y?: number;
    audio_volume?: number;
    force_cpu?: boolean;
    encoder?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface ProcessingJobItem {
  id: string;
  project_id: string;
  job_type: string;
  stage: string;
  stage_index: number;
  total_stages: number;
  progress_pct: number;
  status: string;
  message?: string;
  error_details?: string;
  created_at: string;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  action: string;
  title: string;
  description: string;
  status: string;
  timestamp: string;
}

export interface DashboardStats {
  stats: {
    total_projects: number;
    total_source_videos?: number;
    videos_processed: number;
    total_clips_generated: number;
    total_rendered_clips?: number;
    approved_clips: number;
    pending_clips?: number;
    rejected_clips?: number;
    downloadable_clips: number;
    failed_renders?: number;
    failed_processing_jobs: number;
    active_queue_count: number;
    storage_used_mb: number;
    storage_used_gb?: number;
    total_downloadable_video_bytes?: number;
    total_downloadable_video_mb?: number;
    storage_root: string;
  };
  recent_activities?: RecentActivityItem[];
  recent_projects: ProjectItem[];
  recent_clips: ClipItem[];
  recent_jobs: ProcessingJobItem[];
}

export interface ChannelProfile {
  id: string;
  name: string;
  platform: string;
  niche: string;
  target_audience_region: string;
  timezone: string;
  preferred_frequency_per_week: number;
  posting_days: string[];
  preferred_hours: string[];
  max_uploads_per_day: number;
  created_at?: string;
}

export interface TrendTopicItem {
  id?: string;
  snapshot_id?: string;
  niche: string;
  topic_name: string;
  explanation: string;
  source: string;
  source_url?: string;
  region: string;
  trend_status: 'rising' | 'stable' | 'declining';
  trend_indicator?: string;
  opportunity_score: number;
  why_attention?: string;
  target_audience?: string;
  related_keywords: string[];
  suggested_hashtags: string[];
  content_angles: string[];
  suggested_titles: string[];
  suggested_hooks: string[];
  video_formats: string[];
  competition_level: string;
  created_at?: string;
}

export interface TrendDataResponse {
  niche: string;
  region: string;
  source: string;
  fetched_at: string;
  is_cached: boolean;
  is_fallback: boolean;
  observation_window: string;
  topics: TrendTopicItem[];
}

export interface ContentIdeaItem {
  id?: string;
  project_id?: string;
  channel_profile_id?: string;
  niche: string;
  topic: string;
  concept: string;
  suggested_title: string;
  opening_hook: string;
  short_description?: string;
  target_audience?: string;
  keywords?: string[];
  hashtags?: string[];
  recommended_duration_seconds: number;
  why_create?: string;
  status: 'suggested' | 'saved' | 'in_production' | 'completed' | 'dismissed';
  associated_source_video_id?: string;
  associated_clip_id?: string;
  created_at?: string;
}

export interface ScheduledPostItem {
  id?: string;
  channel_profile_id?: string;
  clip_id?: string;
  content_idea_id?: string;
  platform: 'youtube_shorts' | 'instagram_reels' | 'tiktok';
  title: string;
  topic?: string;
  scheduled_date: string;
  scheduled_time: string;
  timezone: string;
  priority: 'high' | 'medium' | 'normal';
  recommendation_reason?: string;
  status: 'recommended' | 'scheduled' | 'published' | 'skipped' | 'draft';
  notes?: string;
  thumbnail_path?: string;
  duration?: number;
  created_at?: string;
}

export interface PerformanceInsights {
  has_enough_data: boolean;
  sample_size: number;
  message: string;
  best_days: string[];
  best_hours: string[];
  optimal_length_range: string;
  top_topics: Array<{ topic: string; avg_views: number; video_count: number }>;
  day_averages?: Record<string, { avg_views: number; count: number }>;
  hour_averages?: Record<string, { avg_views: number; count: number }>;
  duration_averages?: Record<string, number>;
}

export interface StrategyOverviewData {
  active_profile: {
    name: string;
    niche: string;
    platform: string;
    region: string;
    frequency_per_week: number;
  };
  trends_summary: {
    source: string;
    fetched_at?: string;
    is_fallback: boolean;
    top_trends: TrendTopicItem[];
  };
  ideas_summary: {
    total_in_pipeline: number;
    top_ideas: ContentIdeaItem[];
  };
  upcoming_schedule: ScheduledPostItem[];
  content_opportunities: Array<{
    id: string;
    title: string;
    duration: number;
    score: number;
    topic?: string;
  }>;
  performance_snapshot: {
    has_enough_data: boolean;
    best_days: string[];
    best_hours: string[];
    optimal_length: string;
  };
}
