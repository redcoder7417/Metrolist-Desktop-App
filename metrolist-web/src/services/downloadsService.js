/**
 * downloadsService.js
 * localStorage-based "offline saves" — stores tracks the user marks for offline
 */

import { API_BASE } from './api';

const DOWNLOADS_KEY = 'metrolist_downloads';

export const getDownloads = () => {
  try {
    const data = localStorage.getItem(DOWNLOADS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const isDownloaded = (videoId) => {
  return getDownloads().some(t => t.videoId === videoId || t.id === videoId);
};

export const addDownload = (track) => {
  if (!track) return;
  const id = track.videoId || track.id;
  if (!id) return;
  const list = getDownloads();
  if (list.some(t => (t.videoId || t.id) === id)) return; // already saved
  const item = {
    videoId: id,
    id,
    title: track.title || 'Unknown',
    artist: track.artist || track.author || '',
    thumbnail: track.thumbnail || track.thumbnailUrl || track.cover || '',
    duration: track.duration || 0,
    savedAt: Date.now(),
  };
  const updated = [item, ...list];
  localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('downloadsUpdated'));
  
  // Trigger physical background download on the backend
  fetch(`${API_BASE}/download/${id}`, { method: 'POST' }).catch(err => console.error('Download trigger failed', err));
  
  return item;
};

export const removeDownload = (videoId) => {
  const list = getDownloads().filter(t => (t.videoId || t.id) !== videoId);
  localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('downloadsUpdated'));
  
  // Delete physical file on the backend
  fetch(`${API_BASE}/download/${videoId}`, { method: 'DELETE' }).catch(err => console.error('Delete trigger failed', err));
};

export const clearDownloads = () => {
  const list = getDownloads();
  localStorage.removeItem(DOWNLOADS_KEY);
  window.dispatchEvent(new CustomEvent('downloadsUpdated'));
  
  // Try to delete physical files for all cleared downloads
  list.forEach(t => {
    const id = t.videoId || t.id;
    if (id) fetch(`${API_BASE}/download/${id}`, { method: 'DELETE' }).catch(() => {});
  });
};

export const getDownloadCount = () => getDownloads().length;
