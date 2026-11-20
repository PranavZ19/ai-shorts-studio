import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { CreatorStrategyPage } from './pages/CreatorStrategyPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { VideoLibraryPage } from './pages/VideoLibraryPage';
import { ClipFinderPage } from './pages/ClipFinderPage';
import { TranscriptPage } from './pages/TranscriptPage';
import { ClipEditorPage } from './pages/ClipEditorPage';
import { GeneratedShortsPage } from './pages/GeneratedShortsPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { PublishingPage } from './pages/PublishingPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { api } from './services/api';
import { HardwareStatus, DashboardStats, ProjectItem, SourceVideoItem, ClipItem } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [hardware, setHardware] = useState<HardwareStatus | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [videos, setVideos] = useState<SourceVideoItem[]>([]);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [hw, dash, projs, vids, clps] = await Promise.allSettled([
        api.getHardwareStatus(),
        api.getDashboard(),
        api.getProjects(),
        api.getVideos(selectedProjectId || undefined),
        api.getClips(selectedProjectId || undefined)
      ]);

      if (hw.status === 'fulfilled') setHardware(hw.value);
      if (dash.status === 'fulfilled') setDashboardStats(dash.value);
      if (projs.status === 'fulfilled') setProjects(projs.value);
      if (vids.status === 'fulfilled') setVideos(vids.value);
      if (clps.status === 'fulfilled') setClips(clps.value);
    } catch (err) {
      console.error('Error fetching studio data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [selectedProjectId]);

  const handleProjectCreated = (newId: string) => {
    setSelectedProjectId(newId);
    fetchAllData();
    setCurrentTab('video-library');
  };

  return (
    <div className="flex h-screen bg-background text-gray-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        hardware={hardware}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          currentTab={currentTab}
          onNewProject={() => setCurrentTab('new-project')}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={(id) => setSelectedProjectId(id || null)}
          onRefresh={fetchAllData}
          loading={loading}
        />

        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {currentTab === 'dashboard' && (
            <DashboardPage
              stats={dashboardStats}
              hardware={hardware}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'creator-strategy' && (
            <CreatorStrategyPage
              onNavigate={setCurrentTab}
              onSelectClip={(id) => setSelectedClipId(id)}
            />
          )}

          {currentTab === 'new-project' && (
            <NewProjectPage
              onProjectCreated={handleProjectCreated}
            />
          )}

          {currentTab === 'video-library' && (
            <VideoLibraryPage
              videos={videos}
              onNavigate={setCurrentTab}
              onSelectVideo={(id) => setSelectedVideoId(id)}
              onRefresh={fetchAllData}
            />
          )}

          {currentTab === 'clip-finder' && (
            <ClipFinderPage
              clips={clips}
              selectedVideoId={selectedVideoId}
              onSelectVideo={(id) => setSelectedVideoId(id)}
              onNavigate={(tab) => {
                setCurrentTab(tab);
              }}
              onSelectClip={(id) => setSelectedClipId(id)}
              onRefresh={fetchAllData}
            />
          )}

          {currentTab === 'transcript' && (
            <TranscriptPage
              videos={videos}
              selectedVideoId={selectedVideoId}
              onSelectVideo={(id) => setSelectedVideoId(id)}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'clip-editor' && (
            <ClipEditorPage
              clips={clips}
              videos={videos}
              selectedClipId={selectedClipId}
              onSelectClip={(id) => setSelectedClipId(id)}
              onRefresh={fetchAllData}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'generated-shorts' && (
            <GeneratedShortsPage
              clips={clips}
              onSelectClip={(id) => setSelectedClipId(id)}
              onNavigate={setCurrentTab}
              onRefresh={fetchAllData}
            />
          )}

          {currentTab === 'downloads' && (
            <DownloadsPage
              clips={clips}
              projects={projects}
              storageUsedMb={dashboardStats?.stats.storage_used_mb ?? 0}
              onRefresh={fetchAllData}
            />
          )}

          {currentTab === 'publishing' && (
            <PublishingPage onNavigate={setCurrentTab} />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsPage stats={dashboardStats} />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              hardware={hardware}
              onRefreshHardware={fetchAllData}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
