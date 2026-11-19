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
  async getVideos(projectId?: string): Promise<SourceVideoItem[]> {
    const url = projectId ? `${API_BASE}/videos/?project_id=${projectId}` : `${API_BASE}/videos/`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch videos');
    return res.json();
  },

  // Clips
  async getClips(projectId?: string, approvedOnly = false): Promise<ClipItem[]> {
    let url = `${API_BASE}/clips/`;
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId);
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
