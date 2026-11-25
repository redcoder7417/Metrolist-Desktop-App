import React, { useEffect, useState, useContext } from 'react';
import { fetchArtist } from '../services/api';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';
import MediaCard from './MediaCard';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import { FiPlay, FiShuffle, FiUser, FiHeart, FiMusic } from 'react-icons/fi';
import { useLibrary } from '../context/LibraryContext';

const formatDuration = (seconds) => {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const ArtistView = ({ artistId, fallbackMedia, onOpenDetails }) => {
  const [artist, setArtist] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { playTrack, playQueue, currentTrack, isPlaying } = useContext(PlayerContext);
  const { isLiked, toggleLike } = useLibrary();
  const { addToast } = useContext(ToastContext);

  useEffect(() => {
    if (!artistId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchArtist(artistId)
      .then((data) => {
        if (!cancelled) setArtist(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [artistId]);

  if (isLoading) {
    return (
      <div className="loading-state" style={{ padding: 64 }}>
        <span className="card-spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (error || !artist) {
    return <div className="error-state">Failed to load artist: {error || 'Unknown error'}</div>;
  }

  const songSection = artist.sections?.find((s) =>
    s.items?.some((i) => i.type === 'song' || i.type === 'video')
  );
  const topSongs = songSection?.items?.filter((i) => i.type === 'song' || i.type === 'video') || [];
  const otherSections = artist.sections?.filter((s) => s !== songSection) || [];
  const cover = artist.thumbnailUrl || fallbackMedia?.cover;

  const toTrack = (item) => ({
    videoId: item.id,
    title: item.title,
    artist: item.subtitle || artist.title,
    thumbnail: item.cover || cover,
    duration: item.duration || 0,
  });

  const handlePlayAll = (shuffle = false) => {
    if (topSongs.length === 0) return;
    const list = topSongs.map(toTrack);
    const ordered = shuffle ? [...list].sort(() => Math.random() - 0.5) : list;
    playQueue(ordered, 0);
    addToast(`${shuffle ? 'Shuffling' : 'Playing'} ${artist.title}`);
  };

  return (
    <div className="playlist-view">
      {cover && <div className="playlist-hero-bg" style={{ backgroundImage: `url(${cover})` }} />}

      <div className="playlist-hero artist-hero">
        {cover ? (
          <img src={cover} alt={artist.title} className="artist-hero-avatar" />
        ) : (
          <div className="artist-hero-avatar-ph"><FiUser size={56} /></div>
        )}
        <div className="playlist-hero-info">
          <span className="playlist-hero-type">ARTIST</span>
          <h1 className="playlist-hero-title">{artist.title}</h1>
          {artist.subscriberCount && (
            <p className="playlist-hero-meta">{artist.subscriberCount}</p>
          )}
          {artist.description && (
            <p className="artist-hero-desc">{artist.description}</p>
          )}
        </div>
      </div>

      <div className="library-content">
        {topSongs.length > 0 && (
          <>
            <div className="library-controls">
              <button className="library-play-btn" onClick={() => handlePlayAll(false)}>
                <FiPlay size={16} /> Play Top Songs
              </button>
              <button className="library-shuffle-btn" onClick={() => handlePlayAll(true)}>
                <FiShuffle size={16} /> Shuffle
              </button>
            </div>

            <div className="home-section">
              <div className="home-section-header">
                <h3 className="section-title">{songSection.title || 'Top Songs'}</h3>
              </div>
              <div className="library-track-list">
                {topSongs.map((song, idx) => {
                  const track = toTrack(song);
                  const isActive = currentTrack?.videoId === track.videoId;
                  const liked = isLiked(track.videoId);
                  return (
                    <div
                      key={song.id + idx}
                      className={`track-item${isActive ? ' active' : ''}`}
                      onClick={() => playTrack(track, false)}
                    >
                      <div className="col-index">
                        {isActive && isPlaying ? (
                          <div className="lib-mini-bars"><span /><span /><span /></div>
                        ) : (
                          <>
                            <span className="index-num">{idx + 1}</span>
                            <span className="play-overlay"><FiPlay size={14} /></span>
                          </>
                        )}
                      </div>
                      <div className="col-title">
                        {track.thumbnail ? (
                          <img src={track.thumbnail} alt={track.title} style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover' }} />
                        ) : (
                          <div className="track-thumb-placeholder"><FiMusic size={16} /></div>
                        )}
                        <div className="track-details">
                          <span className={`title-text${isActive ? ' active-title' : ''}`}>{track.title}</span>
                          <span className="artist-text">{track.artist}</span>
                        </div>
                      </div>
                      <span className="col-duration">{formatDuration(song.duration)}</span>
                      <button
                        className={`lib-unlike-btn ${liked ? 'liked' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
                      >
                        <FiHeart size={15} fill={liked ? 'currentColor' : 'none'} />
                      </button>
                      <AddToPlaylistMenu track={track} />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {otherSections.map((sec, sIdx) => (
          <div key={sIdx} className="home-section">
            <div className="home-section-header">
              <h3 className="section-title">{sec.title}</h3>
            </div>
            <div className="section-grid-layout">
              {sec.items.map((item, idx) => (
                <MediaCard key={item.id + idx} item={item} onOpenDetails={onOpenDetails} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArtistView;
