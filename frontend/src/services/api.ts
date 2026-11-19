import { HardwareStatus, DashboardStats, ProjectItem, SourceVideoItem, ClipItem, ProcessingJobItem } from '../types';

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

  async getClips(projectId?: string, videoId?: string, approvedOnly = false): Promise<ClipItem[]> {
    let url = `${API_BASE}/clips/`;
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId);
    if (videoId) params.append('video_id', videoId);
    if (approvedOnly) params.append('approved_only', 'true');
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

  async updateClip(clipId: string, payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/clips/${clipId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update clip');
    return res.json();
  },

  async deleteClip(clipId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/clips/${clipId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete clip' }));
      throw new Error(err.detail || 'Failed to delete clip');
    }
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
  getClipMp4Url(clipId: string) {
    return `${API_BASE}/downloads/clip/${clipId}/mp4`;
  },
  getClipSrtUrl(clipId: string) {
    return `${API_BASE}/downloads/clip/${clipId}/srt`;
  },
  getClipThumbUrl(clipId: string) {
    return `${API_BASE}/downloads/clip/${clipId}/thumbnail`;
  },
  getProjectZipUrl(projectId: string) {
    return `${API_BASE}/downloads/project/${projectId}/zip`;
  }
};
