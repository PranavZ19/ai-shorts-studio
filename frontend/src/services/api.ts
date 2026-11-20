import {
  HardwareStatus,
  DashboardStats,
  ProjectItem,
  SourceVideoItem,
  ClipItem,
  ProcessingJobItem,
  PublishingKitListItem,
  PublishingKitDetail,
  StorageStats,
  BackupItem,
  BackupValidationResult
} from '../types';

const API_BASE = '/api';

export const api = {
  // Hardware Diagnostics
  async getHardwareStatus(): Promise<HardwareStatus> {
    const res = await fetch(`${API_BASE}/hardware/status`);
    if (!res.ok) throw new Error('Failed to fetch hardware status');
    return res.json();
  },

  // Dashboard Analytics
  async getDashboard(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/analytics/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  // Projects
  async getProjects(): Promise<ProjectItem[]> {
    const res = await fetch(`${API_BASE}/projects/`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async getProject(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/projects/${id}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    return res.json();
  },

  async createProject(name: string, description?: string): Promise<ProjectItem> {
    const res = await fetch(`${API_BASE}/projects/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error('Failed to create project');
    return res.json();
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  // Videos
  async getVideos(projectId?: string, search?: string, sortBy?: string): Promise<SourceVideoItem[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId);
    if (search) params.append('search', search);
    if (sortBy) params.append('sort_by', sortBy);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/videos/${qs}`);
    if (!res.ok) throw new Error('Failed to fetch videos');
    return res.json();
  },

  async getVideo(id: string): Promise<SourceVideoItem> {
    const res = await fetch(`${API_BASE}/videos/${id}`);
    if (!res.ok) throw new Error('Failed to fetch video details');
    return res.json();
  },

  async deleteVideo(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/videos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete video' }));
      throw new Error(err.detail || 'Failed to delete video');
    }
  },

  // Chunked Upload
  async uploadChunkedVideo(
    projectId: string,
    file: File,
    onProgress: (percent: number, statusText: string) => void
  ): Promise<any> {
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunk size
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    onProgress(0, 'Initializing upload session...');
    const initRes = await fetch(`${API_BASE}/videos/upload/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        filename: file.name,
        total_size: file.size,
        total_chunks: totalChunks
      })
    });

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({ detail: 'Failed to initialize upload' }));
      throw new Error(err.detail || 'Failed to initialize upload');
    }

    const { upload_id } = await initRes.json();

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);

      const formData = new FormData();
      formData.append('upload_id', upload_id);
      formData.append('chunk_index', chunkIdx.toString());
      formData.append('file', chunkBlob, file.name);

      const pct = Math.round(((chunkIdx + 1) / totalChunks) * 85);
      onProgress(pct, `Uploading chunk ${chunkIdx + 1} of ${totalChunks} (${pct}%)...`);

      const chunkRes = await fetch(`${API_BASE}/videos/upload/chunk`, {
        method: 'POST',
        body: formData
      });

      if (!chunkRes.ok) {
        const err = await chunkRes.json().catch(() => ({ detail: `Failed uploading chunk ${chunkIdx}` }));
        throw new Error(err.detail || `Upload interrupted at chunk ${chunkIdx}`);
      }
    }

    onProgress(90, 'Assembling chunks and analyzing video with FFprobe...');
    const completeRes = await fetch(`${API_BASE}/videos/upload/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id })
    });

    if (!completeRes.ok) {
      const err = await completeRes.json().catch(() => ({ detail: 'Failed finalizing video upload' }));
      throw new Error(err.detail || 'Failed finalizing video');
    }

    onProgress(100, 'Video uploaded and analyzed successfully!');
    return completeRes.json();
  },

  // YouTube Inspector & Import
  async inspectYouTube(url: string): Promise<any> {
    const res = await fetch(`${API_BASE}/videos/youtube/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to inspect YouTube URL' }));
      throw new Error(err.detail || 'Failed to inspect YouTube URL');
    }
    return res.json();
  },

  async importYouTube(projectId: string, url: string, userAuthorized: boolean): Promise<any> {
    const res = await fetch(`${API_BASE}/videos/youtube/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        url,
        user_authorized: userAuthorized
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to import YouTube video' }));
      throw new Error(err.detail || 'Failed to import YouTube video');
    }
    return res.json();
  },

  // Transcripts
  async getTranscriptForVideo(videoId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/transcripts/video/${videoId}`);
    if (!res.ok) throw new Error('Failed to fetch transcript');
    return res.json();
  },

  async transcribeVideo(videoId: string, modelName = 'base', language = 'auto', forceCpu = false): Promise<any> {
    const res = await fetch(`${API_BASE}/transcripts/video/${videoId}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: modelName,
        language: language,
        force_cpu: forceCpu
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Transcription failed' }));
      throw new Error(err.detail || 'Transcription failed');
    }
    return res.json();
  },

  async updateTranscriptSegment(segmentId: string, text: string, speaker?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/transcripts/segments/${segmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker })
    });
    if (!res.ok) throw new Error('Failed to update segment');
    return res.json();
  },

  getSubtitleExportUrl(transcriptId: string, format: 'srt' | 'vtt' = 'srt'): string {
    return `${API_BASE}/transcripts/${transcriptId}/export?format=${format}`;
  },

  // Clips
  async getClipEngineStatus(): Promise<{
    ollama_available: boolean;
    available_models: string[];
    recommended_model: string;
    heuristic_fallback_available: boolean;
  }> {
    const res = await fetch(`${API_BASE}/clips/status`);
    if (!res.ok) throw new Error('Failed to fetch clip engine status');
    return res.json();
  },

  async analyzeVideoForClips(payload: {
    video_id: string;
    target_count?: number;
    target_duration?: number;
    min_duration?: number;
    max_duration?: number;
    model_name?: string;
    force_heuristic?: boolean;
  }): Promise<{
    success: boolean;
    video_id: string;
    video_title: string;
    clips_found: number;
    analysis_mode: string;
    clips: ClipItem[];
  }> {
    const res = await fetch(`${API_BASE}/clips/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to analyze video for clips' }));
      throw new Error(err.detail || 'Failed to analyze video for clips');
    }
    return res.json();
  },

  async getClips(options?: {
    projectId?: string;
    videoId?: string;
    approvedOnly?: boolean;
    status?: string;
    search?: string;
    isFavorite?: boolean;
    sortBy?: string;
    order?: string;
    limit?: number;
    offset?: number;
  } | string): Promise<ClipItem[]> {
    let url = `${API_BASE}/clips/`;
    const params = new URLSearchParams();

    if (typeof options === 'string') {
      params.append('project_id', options);
    } else if (options) {
      if (options.projectId) params.append('project_id', options.projectId);
      if (options.videoId) params.append('video_id', options.videoId);
      if (options.approvedOnly) params.append('approved_only', 'true');
      if (options.status) params.append('status', options.status);
      if (options.search) params.append('search', options.search);
      if (options.isFavorite !== undefined) params.append('is_favorite', String(options.isFavorite));
      if (options.sortBy) params.append('sort_by', options.sortBy);
      if (options.order) params.append('order', options.order);
      if (options.limit) params.append('limit', String(options.limit));
      if (options.offset) params.append('offset', String(options.offset));
    }

    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch clips');
    return res.json();
  },

  async toggleClipApproval(clipId: string, isApproved: boolean): Promise<any> {
    const res = await fetch(`${API_BASE}/clips/${clipId}/approval`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_approved: isApproved }),
    });
    if (!res.ok) throw new Error('Failed to update clip approval');
    return res.json();
  },

  async toggleClipFavorite(clipId: string): Promise<{ success: boolean; clip_id: string; is_favorite: boolean }> {
    const res = await fetch(`${API_BASE}/clips/${clipId}/favorite`, {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error('Failed to toggle favorite');
    return res.json();
  },

  async bulkApproveClips(clipIds: string[], isApproved: boolean): Promise<any> {
    const res = await fetch(`${API_BASE}/clips/bulk/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clip_ids: clipIds, is_approved: isApproved })
    });
    if (!res.ok) throw new Error('Failed to bulk update approvals');
    return res.json();
  },

  async bulkDeleteClips(clipIds: string[], deleteMedia = true): Promise<any> {
    const res = await fetch(`${API_BASE}/clips/bulk/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clip_ids: clipIds, delete_media: deleteMedia })
    });
    if (!res.ok) throw new Error('Failed to bulk delete clips');
    return res.json();
  },

  async updateClip(clipId: string, payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/clips/${clipId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update clip');
    return res.json();
  },

  async deleteClip(clipId: string, deleteMedia = true): Promise<any> {
    const res = await fetch(`${API_BASE}/clips/${clipId}?delete_media=${deleteMedia}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete clip' }));
      throw new Error(err.detail || 'Failed to delete clip');
    }
    return res.json();
  },

  async getCaptionPresets(): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE}/clips/presets`);
    if (!res.ok) throw new Error('Failed to fetch caption presets');
    return res.json();
  },

  async renderClip(clipId: string, payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/clips/${clipId}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to start clip rendering' }));
      throw new Error(err.detail || 'Failed to start clip rendering');
    }
    return res.json();
  },

  async getClipRenderStatus(clipId: string): Promise<{
    clip_id: string;
    status: string;
    stage: string;
    progress_pct: number;
    message: string;
    output_ready: boolean;
    clip?: ClipItem;
  }> {
    const res = await fetch(`${API_BASE}/clips/${clipId}/render-status`);
    if (!res.ok) throw new Error('Failed to fetch render status');
    return res.json();
  },

  async cancelClipRender(clipId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/clips/${clipId}/cancel-render`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to cancel render');
    return res.json();
  },

  // Jobs
  async getJobs(projectId?: string): Promise<ProcessingJobItem[]> {
    const url = projectId ? `${API_BASE}/jobs/?project_id=${projectId}` : `${API_BASE}/jobs/`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch jobs');
    return res.json();
  },

  // Settings
  async getSettings(): Promise<any> {
    const res = await fetch(`${API_BASE}/settings/`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async saveSettings(settings: any): Promise<any> {
    const res = await fetch(`${API_BASE}/settings/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return res.json();
  },

  // Downloads URL helpers
  getClipMp4Url(clipId: string, download = true) {
    return `${API_BASE}/downloads/clip/${clipId}/mp4${download ? '?download=true' : ''}`;
  },
  getClipStreamUrl(clipId: string) {
    return `${API_BASE}/downloads/clip/${clipId}/stream`;
  },
  getClipSrtUrl(clipId: string) {
    return `${API_BASE}/downloads/clip/${clipId}/srt`;
  },
  getClipVttUrl(clipId: string) {
    return `${API_BASE}/downloads/clip/${clipId}/vtt`;
  },
  getClipThumbUrl(clipId: string, download = false) {
    return `${API_BASE}/downloads/clip/${clipId}/thumbnail${download ? '?download=true' : ''}`;
  },
  getClipMetadataUrl(clipId: string) {
    return `${API_BASE}/downloads/clip/${clipId}/metadata`;
  },
  getClipZipUrl(clipId: string) {
    return `${API_BASE}/downloads/clip/${clipId}/zip`;
  },
  getBulkZipUrl(clipIds: string[], includeSubs = true, includeThumbs = true) {
    const ids = clipIds.join(',');
    return `${API_BASE}/downloads/bulk/zip?clip_ids=${encodeURIComponent(ids)}&include_subtitles=${includeSubs}&include_thumbnails=${includeThumbs}`;
  },
  getProjectZipUrl(projectId: string, includeSource = false) {
    return `${API_BASE}/downloads/project/${projectId}/zip?include_source=${includeSource}`;
  },
  async requestBulkZip(payload: {
    clip_ids: string[];
    include_subtitles?: boolean;
    include_thumbnails?: boolean;
    include_metadata?: boolean;
    package_name?: string;
  }): Promise<Blob> {
    const res = await fetch(`${API_BASE}/downloads/bulk/zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate bulk ZIP' }));
      throw new Error(err.detail || 'Failed to generate bulk ZIP');
    }
    return res.blob();
  },

  // ----------------- CREATOR STRATEGY -----------------
  async getStrategyProfiles(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/strategy/profiles`);
    if (!res.ok) throw new Error('Failed to fetch channel profiles');
    return res.json();
  },

  async createStrategyProfile(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create channel profile');
    return res.json();
  },

  async updateStrategyProfile(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update channel profile');
    return res.json();
  },

  async deleteStrategyProfile(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/profiles/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete channel profile');
    return res.json();
  },

  async getStrategyNiches(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/strategy/niches`);
    if (!res.ok) throw new Error('Failed to fetch niches');
    return res.json();
  },

  async getTrends(niche = 'Technology', region = 'US', forceRefresh = false): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/trends?niche=${encodeURIComponent(niche)}&region=${encodeURIComponent(region)}&force_refresh=${forceRefresh}`);
    if (!res.ok) throw new Error('Failed to fetch trends');
    return res.json();
  },

  async analyzeTrend(topicName: string, niche: string, sourceIndicator = ''): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/trends/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_name: topicName, niche, source_indicator: sourceIndicator })
    });
    if (!res.ok) throw new Error('Failed to analyze trend');
    return res.json();
  },

  async getContentIdeas(niche?: string, status?: string, projectId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (niche) params.append('niche', niche);
    if (status) params.append('status', status);
    if (projectId) params.append('project_id', projectId);
    const res = await fetch(`${API_BASE}/strategy/ideas?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch content ideas');
    return res.json();
  },

  async generateContentIdeas(payload: {
    niche: string;
    trending_topics?: string[];
    project_id?: string;
    count?: number;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/ideas/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to generate content ideas');
    return res.json();
  },

  async saveContentIdea(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to save content idea');
    return res.json();
  },

  async updateContentIdeaStatus(id: string, status: string): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/ideas/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update idea status');
    return res.json();
  },

  async convertIdeaToProject(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/ideas/${id}/convert-to-project`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to convert idea to project');
    return res.json();
  },

  async getScheduleRecommendations(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/schedule/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to generate schedule recommendations');
    return res.json();
  },

  async commitSchedule(posts: any[]): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/schedule/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts })
    });
    if (!res.ok) throw new Error('Failed to commit schedule');
    return res.json();
  },

  async getCalendar(params?: { startDate?: string; endDate?: string; platform?: string; status?: string }): Promise<any[]> {
    const q = new URLSearchParams();
    if (params?.startDate) q.append('start_date', params.startDate);
    if (params?.endDate) q.append('end_date', params.endDate);
    if (params?.platform) q.append('platform', params.platform);
    if (params?.status) q.append('status', params.status);
    const res = await fetch(`${API_BASE}/strategy/calendar?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch calendar');
    return res.json();
  },

  async addCalendarPost(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to schedule post' }));
      throw new Error(err.detail || 'Failed to schedule post');
    }
    return res.json();
  },

  async updateCalendarPost(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/calendar/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update scheduled post');
    return res.json();
  },

  async deleteCalendarPost(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/calendar/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete scheduled post');
    return res.json();
  },

  async updatePostStatus(id: string, status: string): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/calendar/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update post status');
    return res.json();
  },

  async getPerformanceInsights(platform?: string, profileId?: string): Promise<any> {
    const q = new URLSearchParams();
    if (platform) q.append('platform', platform);
    if (profileId) q.append('profile_id', profileId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${API_BASE}/strategy/performance${qs}`);
    if (!res.ok) throw new Error('Failed to fetch performance insights');
    return res.json();
  },

  async logPerformanceMetric(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/performance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to log performance metric');
    return res.json();
  },

  async getStrategyOverview(): Promise<any> {
    const res = await fetch(`${API_BASE}/strategy/overview`);
    if (!res.ok) throw new Error('Failed to fetch strategy overview');
    return res.json();
  },

  // Publishing Kits (Phase 9)
  async getPublishingKits(projectId?: string, clipId?: string, status?: string, search?: string): Promise<PublishingKitListItem[]> {
    const q = new URLSearchParams();
    if (projectId) q.append('project_id', projectId);
    if (clipId) q.append('clip_id', clipId);
    if (status) q.append('status', status);
    if (search) q.append('search', search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await fetch(`${API_BASE}/publishing-kits/${qs}`);
    if (!res.ok) throw new Error('Failed to fetch publishing kits');
    return res.json();
  },

  async getPublishingKit(kitId: string): Promise<PublishingKitDetail> {
    const res = await fetch(`${API_BASE}/publishing-kits/${kitId}`);
    if (!res.ok) throw new Error('Failed to fetch publishing kit');
    return res.json();
  },

  async getPublishingKitByClip(clipId: string): Promise<PublishingKitDetail | null> {
    const res = await fetch(`${API_BASE}/publishing-kits/by-clip/${clipId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch publishing kit for clip');
    return res.json();
  },

  async generatePublishingKit(
    clipId: string,
    channelProfileId?: string,
    modelName: string = 'qwen2.5:3b',
    regeneratePlatform?: 'youtube' | 'instagram'
  ): Promise<PublishingKitDetail> {
    const res = await fetch(`${API_BASE}/publishing-kits/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clip_id: clipId,
        channel_profile_id: channelProfileId || null,
        model_name: modelName,
        regenerate_platform: regeneratePlatform || null
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate publishing kit' }));
      throw new Error(err.detail || 'Failed to generate publishing kit');
    }
    return res.json();
  },

  async updatePublishingKit(kitId: string, data: any): Promise<PublishingKitDetail> {
    const res = await fetch(`${API_BASE}/publishing-kits/${kitId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update publishing kit' }));
      throw new Error(err.detail || 'Failed to update publishing kit');
    }
    return res.json();
  },

  async regeneratePublishingKit(
    kitId: string,
    platform: 'youtube' | 'instagram' | 'both',
    fieldName?: string,
    modelName: string = 'qwen2.5:3b'
  ): Promise<PublishingKitDetail> {
    const res = await fetch(`${API_BASE}/publishing-kits/${kitId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        field_name: fieldName || null,
        model_name: modelName
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to regenerate publishing kit content' }));
      throw new Error(err.detail || 'Failed to regenerate publishing kit content');
    }
    return res.json();
  },

  async markPublishingKitReady(kitId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/publishing-kits/${kitId}/mark-ready`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to mark publishing kit as ready');
    return res.json();
  },

  async markPublishingKitPublished(kitId: string, publishedUrl?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/publishing-kits/${kitId}/mark-published`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published_url: publishedUrl || null })
    });
    if (!res.ok) throw new Error('Failed to mark publishing kit as published');
    return res.json();
  },

  async deletePublishingKit(kitId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/publishing-kits/${kitId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete publishing kit');
    return res.json();
  },

  getPublishingKitExportUrl(kitId: string, format: 'txt' | 'json' | 'zip'): string {
    return `${API_BASE}/publishing-kits/${kitId}/export?format=${format}`;
  },

  // Storage Diagnostics & Cleanup (Phase 10)
  async getStorageStats(): Promise<StorageStats> {
    const res = await fetch(`${API_BASE}/settings/storage-stats`);
    if (!res.ok) throw new Error('Failed to fetch storage statistics');
    return res.json();
  },

  async cleanupTempFiles(): Promise<{
    success: boolean;
    freed_bytes: number;
    freed_mb: number;
    cleaned_count: number;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/settings/cleanup-temp`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to clean temporary files');
    return res.json();
  },

  // Backup & Restore (Phase 10)
  async createBackup(includeMedia: boolean = false, notes?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/settings/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_media: includeMedia, notes })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create backup' }));
      throw new Error(err.detail || 'Failed to create backup');
    }
    return res.json();
  },

  async getBackups(): Promise<BackupItem[]> {
    const res = await fetch(`${API_BASE}/settings/backups`);
    if (!res.ok) throw new Error('Failed to list backups');
    return res.json();
  },

  async validateBackup(filename: string): Promise<BackupValidationResult> {
    const res = await fetch(`${API_BASE}/settings/validate-backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Backup validation failed' }));
      throw new Error(err.detail || 'Backup validation failed');
    }
    return res.json();
  },

  async restoreBackup(filename: string, confirm: boolean = true): Promise<any> {
    const res = await fetch(`${API_BASE}/settings/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, confirm })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Backup restoration failed' }));
      throw new Error(err.detail || 'Backup restoration failed');
    }
    return res.json();
  },

  getBackupDownloadUrl(filename: string): string {
    return `${API_BASE}/settings/backups/${encodeURIComponent(filename)}/download`;
  }
};
