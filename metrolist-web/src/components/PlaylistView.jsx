import React, { useEffect, useState, useContext } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { fetchPlaylist, fetchAlbum } from '../services/api';
import { API_BASE } from '../services/api';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import { FiPlay, FiShuffle, FiMusic, FiHeart, FiTrash2 } from 'react-icons/fi';

const ThumbFallback = ({ src, alt, size = 44 }) => {
  const [failed, setFailed] = useState(false);
  return failed || !src ? (
    <div style={{
      width: size, height: size, borderRadius: 6,
      background: '#2a2a2a', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#a7a7a7', flexShrink: 0
    }}>
      <FiMusic size={size * 0.4} />
    </div>
  ) : (
    <img
      src={src} alt={alt}
      style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
};

const PlaylistView = ({ media }) => {
  const [details, setDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { currentTrack, isPlaying, isBuffering, playTrack, playQueue } = useContext(PlayerContext);
  const { toggleLike, isLiked, removeSongFromPlaylist, fetchPlaylists, customPlaylists } = useLibrary();

  const loadDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      let res;
      if (media.type === 'custom-playlist') {
        try {
          const fetchRes = await fetch(`${API_BASE}/library/playlists/${media.id}`);
          if (fetchRes.ok) {
            res = await fetchRes.json();
          }
        } catch (apiErr) {
          console.warn('[PlaylistView] API fetch failed, trying local store:', apiErr);
        }

        if (!res) {
          const localPl = (customPlaylists || []).find(p => p.id === media.id);
          res = {
            id: media.id,
            title: localPl?.name || localPl?.title || media.title || 'Custom Playlist',
            author: 'You',
            thumbnailUrl: localPl?.thumbnailUrl || localPl?.songs?.[0]?.thumbnail || localPl?.songs?.[0]?.thumbnailUrl || null,
            songCount: localPl?.songs?.length || 0,
            songs: localPl?.songs || []
          };
        }
      } else if (media.type === 'playlist') {
        res = await fetchPlaylist(media.id);
      } else {
        res = await fetchAlbum(media.id);
      }
      setDetails(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (media?.id) loadDetails();
  }, [media]);

  if (isLoading) {
    return <div className="loading-state"><span className="card-spinner" style={{margin: '0 auto'}} /></div>;
  }

  if (error || !details) {
    return <div className="error-state">Failed to load details: {error}</div>;
  }

  // Fallback to the media object's cover if backend details don't have it
  const coverImage = details.thumbnailUrl || media.cover;

  const handlePlayAll = () => {
    if (!details.songs || details.songs.length === 0) return;
    const mapped = details.songs.map(t => ({
       videoId: t.id,
       title: t.title,
       artist: t.artist,
       thumbnail: t.thumbnailUrl || coverImage,
    }));
    playQueue(mapped);
  };

  const handleShuffle = () => {
    if (!details.songs || details.songs.length === 0) return;
    const mapped = details.songs.map(t => ({
       videoId: t.id,
       title: t.title,
       artist: t.artist,
       thumbnail: t.thumbnailUrl || coverImage,
    }));
    playQueue(mapped.sort(() => Math.random() - 0.5));
  };

  return (
    <div className="playlist-view">
      {/* DYNAMIC BLURRED BACKGROUND */}
      <div 
        className="playlist-hero-bg" 
        style={{ backgroundImage: `url(${coverImage})` }} 
      />

      <div className="playlist-hero">
        <ThumbFallback src={coverImage} alt={details.title} size={180} />
        <div className="playlist-hero-info">
          <span className="playlist-hero-type">{media.type}</span>
          <h1 className="playlist-hero-title">{details.title}</h1>
          <p className="playlist-hero-meta">
            {details.author && <span className="playlist-hero-author">{details.author} • </span>}
            {details.songCount} songs
          </p>
        </div>
      </div>

      <div className="library-content">
        <div className="library-controls">
          <button className="library-play-btn" onClick={handlePlayAll}>
            <FiPlay size={16} /> Play All
          </button>
          <button className="library-shuffle-btn" onClick={handleShuffle}>
            <FiShuffle size={16} /> Shuffle
          </button>
        </div>

        <div className="library-track-list">
          <div className="track-list-header">
            <div className="col-index">#</div>
            <div className="col-title">Title</div>
            <div style={{ width: 48 }} />
          </div>
          {details.songs.map((song, index) => {
            const isActive = currentTrack?.videoId === song.id;
            const track = {
              videoId: song.id,
              title: song.title,
              artist: song.artist,
              thumbnail: song.thumbnailUrl || coverImage,
            };
            return (
              <div
                key={song.id + index}
                className={`track-item${isActive ? ' active' : ''}`}
                onClick={() => playTrack(track, false)}
              >
                <div className="col-index">
                  {isActive && isBuffering
                    ? <span className="lib-mini-spinner" />
                    : isActive && isPlaying
                      ? <div className="lib-mini-bars"><span/><span/><span/></div>
                      : <>
                          <span className="index-num">{index + 1}</span>
                          <span className="play-overlay"><FiPlay size={14} /></span>
                        </>
                  }
                </div>
                <div className="col-title">
                  <ThumbFallback src={track.thumbnail} alt={song.title} />
                  <div className="track-details">
                    <span className={`title-text${isActive ? ' active-title' : ''}`}>{song.title}</span>
                    <span className="artist-text">{song.artist}</span>
                  </div>
                </div>
                {media.type === 'custom-playlist' ? (
                  <button
                    className="lib-unlike-btn"
                    onClick={async e => { 
                      e.stopPropagation(); 
                      await removeSongFromPlaylist(media.id, track.videoId);
                      loadDetails(); // reload to reflect deletion
                    }}
                    title="Remove from playlist"
                  >
                    <FiTrash2 size={15} />
                  </button>
                ) : (
                  <button
                    className={`lib-unlike-btn ${isLiked(track.videoId) ? 'liked' : ''}`}
                    onClick={e => { e.stopPropagation(); toggleLike(track); }}
                    title={isLiked(track.videoId) ? "Remove from liked" : "Add to liked"}
                  >
                    <FiHeart size={15} fill={isLiked(track.videoId) ? "currentColor" : "none"} />
                  </button>
                )}
                <AddToPlaylistMenu track={track} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlaylistView;
