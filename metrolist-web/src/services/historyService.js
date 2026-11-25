// Service to store and manage song IDs and titles for last played tracks

const HISTORY_KEY = 'metrolist_recently_played';

export const getRecentlyPlayed = () => {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('[historyService] Failed to load history:', e);
    return [];
  }
};

export const addRecentlyPlayed = (track) => {
  if (!track || (!track.videoId && !track.id)) return;
  const songId = track.videoId || track.id;
  const songTitle = track.title || 'Unknown Track';
  const songArtist = track.artist || track.author || '';
  const songThumb = track.thumbnail || track.thumbnailUrl || track.cover || '';

  const item = {
    id: songId,
    videoId: songId,
    title: songTitle,
    artist: songArtist,
    thumbnail: songThumb,
    timestamp: Date.now()
  };

  try {
    const list = getRecentlyPlayed();
    // Deduplicate by song ID
    const filtered = list.filter(s => (s.videoId || s.id) !== songId);
    const updated = [item, ...filtered].slice(0, 50); // Keep last 50
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    
    // Dispatch custom window event so UI components update dynamically in real time!
    window.dispatchEvent(new CustomEvent('recentlyPlayedUpdated', { detail: item }));
  } catch (e) {
    console.warn('[historyService] Failed to save history:', e);
  }
};

export const getLastPlayedTrack = () => {
  const list = getRecentlyPlayed();
  return list.length > 0 ? list[0] : null;
};
