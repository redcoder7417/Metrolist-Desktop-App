import React, { useContext, useState } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import { FiMusic, FiList, FiShuffle, FiPlay, FiHeart, FiPause, FiTrash2 } from 'react-icons/fi';

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

const LibraryView = ({ activeTab }) => {
  const { queue, queueIndex, currentTrack, isPlaying, isBuffering, playTrack, playQueue } = useContext(PlayerContext);
  const { likedSongs, toggleLike, isLiked } = useLibrary();

  // ── Liked Songs Tab ────────────────────────────────────────────────────────
  const renderLikedSongs = () => {
    if (likedSongs.length === 0) {
      return (
        <div className="library-empty">
          <FiHeart size={64} style={{ color: '#00d2ff' }} />
          <h2>Songs you like will appear here</h2>
          <p>Tap the heart ♥ on any track to add it</p>
        </div>
      );
    }

    const tracks = likedSongs.map(s => ({
      videoId: s.id,
      title: s.title,
      thumbnail: s.thumbnailUrl,
      artist: s.artist || '',
      duration: s.duration > 0 ? s.duration : 0,
    }));

    return (
      <div className="library-content">
        <div className="library-header">
          <div className="liked-songs-hero">
            <div className="liked-hero-icon"><FiHeart size={40} /></div>
            <div>
              <p className="liked-hero-label">Playlist</p>
              <h1>Liked Songs</h1>
              <p className="liked-hero-count">{likedSongs.length} song{likedSongs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        <div className="library-controls">
          <button className="library-play-btn" onClick={() => playQueue(tracks)}>
            <FiPlay size={16} /> Play All
          </button>
          <button className="library-shuffle-btn" onClick={() => {
            const shuffled = [...tracks].sort(() => Math.random() - 0.5);
            playQueue(shuffled);
          }}>
            <FiShuffle size={16} /> Shuffle
          </button>
        </div>

        <div className="library-track-list">
          <div className="track-list-header">
            <div className="col-index">#</div>
            <div className="col-title">Title</div>
            <div style={{ width: 48 }} />
          </div>
          {likedSongs.map((song, index) => {
            const isActive = currentTrack?.videoId === song.id;
            const track = tracks[index];
            return (
              <div
                key={song.id}
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
                  <ThumbFallback src={song.thumbnailUrl} alt={song.title} />
                  <div className="track-details">
                    <span className={`title-text${isActive ? ' active-title' : ''}`}>{song.title}</span>
                    <span className="artist-text">{song.artist || 'Liked Song'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="lib-unlike-btn"
                    onClick={e => { e.stopPropagation(); toggleLike(track); }}
                    title="Remove from liked"
                  >
                    <FiHeart size={15} fill={isLiked(track.videoId) ? "currentColor" : "none"} />
                  </button>
                  <AddToPlaylistMenu track={track} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Queue / Library Tab ────────────────────────────────────────────────────
  const renderQueue = () => {
    const hasQueue = queue.length > 0;

    return (
      <div>
        <div className="library-header">
          <h1>Your Library</h1>
          {hasQueue && (
            <div className="library-queue-info">
              <FiList size={18} />
              <span>{queue.length} tracks in queue</span>
            </div>
          )}
        </div>

        {hasQueue ? (
          <div className="library-content">
            <div className="library-controls">
              <button className="library-play-btn" onClick={() => playQueue([...queue])}>
                <FiPlay size={16} /> Play All
              </button>
              <button className="library-shuffle-btn" onClick={() => {
                const shuffled = [...queue].sort(() => Math.random() - 0.5);
                playQueue(shuffled);
              }}>
                <FiShuffle size={16} /> Shuffle
              </button>
            </div>

            <div className="library-track-list">
              <div className="track-list-header">
                <div className="col-index">#</div>
                <div className="col-title">Title</div>
                <div style={{ width: 80, textAlign: 'right' }}>Status</div>
              </div>
              {queue.map((track, index) => {
                const isActive = currentTrack?.videoId === track.videoId;
                return (
                  <div
                    key={track.videoId + index}
                    className={`track-item${isActive ? ' active' : ''}${index < queueIndex ? ' track-played' : ''}`}
                    onClick={() => playTrack(track, true)}
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
                      <ThumbFallback src={track.thumbnail} alt={track.title} />
                      <div className="track-details">
                        <span className={`title-text${isActive ? ' active-title' : ''}`}>{track.title}</span>
                        <span className="artist-text">{track.artist}</span>
                      </div>
                    </div>
                    <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: 'var(--text-subdued)' }}>
                      {index === queueIndex ? '▶ Playing' : index < queueIndex ? 'Played' : 'Up next'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="library-empty">
            <FiMusic size={64} />
            <h2>Your library is empty</h2>
            <p>Play a playlist or album from the Home page to fill your queue</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="library-view">
      {activeTab === 'liked' ? renderLikedSongs() : renderQueue()}
    </div>
  );
};

export default LibraryView;
