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
