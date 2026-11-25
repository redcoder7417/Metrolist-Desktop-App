import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../services/api';

export const LibraryContext = createContext();

export const LibraryProvider = ({ children }) => {
  const [likedSongs, setLikedSongs] = useState(() => {
    try {
      const saved = localStorage.getItem('metrolist_liked_songs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [likedIds, setLikedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('metrolist_liked_songs');
      const list = saved ? JSON.parse(saved) : [];
      return new Set(list.map(s => s.id || s.videoId));
    } catch (e) {
      return new Set();
    }
  });

  const [customPlaylists, setCustomPlaylists] = useState(() => {
    try {
      const saved = localStorage.getItem('metrolist_custom_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  // ── Save to local storage DB whenever likedSongs or customPlaylists change ──
  useEffect(() => {
    try {
      localStorage.setItem('metrolist_liked_songs', JSON.stringify(likedSongs));
    } catch (e) {
      console.warn('[LibraryContext] Failed to persist liked songs:', e);
    }
  }, [likedSongs]);

  useEffect(() => {
    try {
      localStorage.setItem('metrolist_custom_playlists', JSON.stringify(customPlaylists));
    } catch (e) {
      console.warn('[LibraryContext] Failed to persist custom playlists:', e);
    }
  }, [customPlaylists]);

  // ── Fetch liked songs from backend ──────────────────────────────────────────
  const fetchLiked = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/library/songs/liked`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setLikedSongs(data);
        setLikedIds(new Set(data.map(s => s.id)));
      }
    } catch (err) {
      console.warn('[LibraryContext] fetchLiked failed, using local store:', err.message);
    }
  }, []);

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/library/playlists`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCustomPlaylists(data);
        }
      }
    } catch (err) {
      console.warn('[LibraryContext] fetchPlaylists failed, using local store:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiked();
    fetchPlaylists();
  }, [fetchLiked, fetchPlaylists]);

  // ── Check if a song is liked ─────────────────────────────────────────────────
  const isLiked = (videoId) => likedIds.has(videoId);

  // ── Toggle like ──────────────────────────────────────────────────────────────
  const toggleLike = async (track) => {
    if (!track?.videoId) return;

    const nowLiked = !likedIds.has(track.videoId);

    // Optimistic update
    setLikedIds(prev => {
      const next = new Set(prev);
      nowLiked ? next.add(track.videoId) : next.delete(track.videoId);
      return next;
    });
    setLikedSongs(prev =>
      nowLiked
        ? [{
            id: track.videoId,
            videoId: track.videoId,
            title: track.title,
            artist: track.artist || track.author || '',
            thumbnailUrl: track.thumbnail || track.thumbnailUrl || ''
          }, ...prev]
        : prev.filter(s => (s.id || s.videoId) !== track.videoId)
    );

    try {
      // Make sure the song is saved in the DB first
      if (nowLiked) {
        await fetch(`${API_BASE}/library/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: track.videoId,
            title: track.title,
            artist: track.artist || track.author || null,
            duration: track.duration || -1,
            thumbnailUrl: track.thumbnail || null,
            albumId: null,
            albumName: null,
          }),
        });
      }

      // Toggle like state
      await fetch(`${API_BASE}/library/songs/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.videoId, liked: nowLiked }),
      });
    } catch (err) {
      console.error('[LibraryContext] toggleLike failed:', err.message);
      // Revert optimistic update on failure
      fetchLiked();
    }
  };

  const createPlaylist = async (name) => {
    const newId = 'pl_' + Date.now();
    const newPlaylist = { id: newId, name, title: name, songs: [] };

    setCustomPlaylists(prev => [...prev, newPlaylist]);

    try {
      const res = await fetch(`${API_BASE}/library/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const created = await res.json();
        setCustomPlaylists(prev => prev.map(p => p.id === newId ? { ...p, id: created.id } : p));
        return created;
      }
    } catch (err) {
      console.warn('Failed to create playlist on backend, saved locally', err);
    }
    return newPlaylist;
  };

  const addSongToPlaylist = async (playlistId, track) => {
    const songItem = {
      id: track.videoId || track.id,
      videoId: track.videoId || track.id,
      title: track.title,
      artist: track.artist || track.author || '',
      thumbnailUrl: track.thumbnail || track.thumbnailUrl || ''
    };

    setCustomPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        const existing = pl.songs || [];
        if (existing.some(s => (s.id || s.videoId) === songItem.id)) return pl;
        return { ...pl, songs: [...existing, songItem] };
      }
      return pl;
    }));

    try {
      await fetch(`${API_BASE}/library/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: songItem.id,
          title: songItem.title,
          artist: songItem.artist,
          thumbnailUrl: songItem.thumbnailUrl
        })
      });
    } catch (err) {
      console.warn('Failed to add song to backend, saved locally', err);
    }
  };

  const removeSongFromPlaylist = async (playlistId, trackId) => {
    setCustomPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId) {
        return { ...pl, songs: (pl.songs || []).filter(s => (s.id || s.videoId) !== trackId) };
      }
      return pl;
    }));

    try {
      await fetch(`${API_BASE}/library/playlists/${playlistId}/songs/${trackId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Failed to remove song from backend', err);
    }
  };

  const deletePlaylist = async (playlistId) => {
    setCustomPlaylists(prev => prev.filter(pl => pl.id !== playlistId));
    try {
      await fetch(`${API_BASE}/library/playlists/${playlistId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Failed to delete playlist on backend', err);
    }
  };

  return (
    <LibraryContext.Provider value={{ 
      likedSongs, 
      likedIds, 
      customPlaylists,
      isLoading,
      isLiked, 
      toggleLike, 
      fetchLiked,
      createPlaylist,
      deletePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      fetchPlaylists
    }}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => useContext(LibraryContext);
