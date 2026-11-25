const isDev = typeof window !== 'undefined' && window.location.port === '5173';
export const API_BASE = isDev ? '/api' : 'http://localhost:8091/api';

// Retry a fetch with exponential backoff — handles backend startup delay
const fetchWithRetry = async (url, options = {}, retries = 8, delayMs = 2000) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = Math.min(delayMs * Math.pow(1.5, attempt), 10000);
      await new Promise(res => setTimeout(res, wait));
    }
  }
};

export const fetchHome = async (params = null) => {
  const url = params
    ? `${API_BASE}/home?params=${encodeURIComponent(params)}`
    : `${API_BASE}/home`;
  const response = await fetchWithRetry(url);
  return response.json();
};

export const fetchSearch = async (query, filter = 'songs') => {
  const response = await fetchWithRetry(
    `${API_BASE}/search/v2?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}`
  );
  return response.json();
};

export const fetchPlaylist = async (id) => {
  const response = await fetchWithRetry(`${API_BASE}/playlist/${encodeURIComponent(id)}`);
  return response.json();
};

export const fetchAlbum = async (id) => {
  const response = await fetchWithRetry(`${API_BASE}/album/${encodeURIComponent(id)}`);
  return response.json();
};

export const fetchArtist = async (id) => {
  const response = await fetchWithRetry(`${API_BASE}/artist/${encodeURIComponent(id)}`);
  return response.json();
};

export const fetchRelated = async (videoId) => {
  const response = await fetchWithRetry(`${API_BASE}/innertube/next?videoId=${encodeURIComponent(videoId)}`);
  return response.json();
};

export const fetchLyrics = async ({ videoId, title, artist, duration }) => {
  const params = new URLSearchParams();
  if (videoId) params.set('videoId', videoId);
  if (title) params.set('title', title);
  if (artist) params.set('artist', artist);
  if (duration) params.set('duration', String(Math.round(duration)));
  const response = await fetch(`${API_BASE}/lyrics?${params.toString()}`);
  if (!response.ok) return null;
  return response.json();
};

// Health check — resolves when backend is alive
export const waitForBackend = async (maxWaitMs = 90000) => {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise(res => setTimeout(res, 1500));
  }
  return false;
};
