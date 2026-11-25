import React, { useContext, useState } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import { FiX, FiMusic, FiPlay, FiPause, FiHeart } from 'react-icons/fi';

// Thumbnail with error fallback
const QueueThumb = ({ src, alt, size = 'default' }) => {
  const [failed, setFailed] = useState(false);
  return failed || !src ? (
    <div className={`queue-thumb-placeholder ${size}`}><FiMusic size={size === 'hero' ? 36 : 16} /></div>
  ) : (
    <img
      src={src}
      alt={alt || 'track'}
      className={`queue-item-img ${size}`}
      onError={() => setFailed(true)}
    />
  );
};

// Animated playing bars
const PlayingBars = () => (
  <div className="queue-item-playing-bars">
    <span /><span /><span />
  </div>
);

const QueuePanel = ({ onClose }) => {
  const { queue, queueIndex, playTrack, currentTrack, isPlaying, isBuffering, togglePlay } = useContext(PlayerContext);
  const { isLiked, toggleLike } = useLibrary();

  if (queue.length === 0) {
    return (
      <div className="queue-panel">
        <div className="queue-header">
          <h3>Queue</h3>
          <button className="queue-close-btn" onClick={onClose}><FiX size={20} /></button>
        </div>
        <div className="queue-empty">
          <FiMusic size={48} />
          <p>Queue is empty</p>
          <span>Play a song or playlist to fill the queue</span>
        </div>
      </div>
    );
  }

  const liked = currentTrack ? isLiked(currentTrack.videoId) : false;

  return (
    <div className="queue-panel">
      <div className="queue-header">
        <h3>Queue</h3>
        <button className="queue-close-btn" onClick={onClose}><FiX size={20} /></button>
      </div>

      {/* Expanded Now Playing Hero Card */}
      {currentTrack && (
        <div className="queue-section queue-section-now-playing">
          <p className="queue-section-label">NOW PLAYING</p>
          
          <div className="queue-now-playing-hero">
            <div className="queue-hero-art-container" onClick={togglePlay}>
              <QueueThumb src={currentTrack.thumbnail} alt={currentTrack.title} size="hero" />
              <div className="queue-hero-overlay">
                {isBuffering
                  ? <span className="queue-hero-spinner" />
                  : isPlaying
                    ? <PlayingBars />
                    : <FiPlay size={24} />}
              </div>
            </div>

            <div className="queue-hero-content">
              <div className="queue-hero-title-row">
                <span className="queue-hero-title" title={currentTrack.title}>
                  {currentTrack.title}
                </span>
                <span className="queue-hero-artist">{currentTrack.artist || 'Unknown Artist'}</span>
              </div>

              <div className="queue-hero-meta-bar">
                <div className="queue-hero-status-pill">
                  {isBuffering ? (
                    <span className="status-buffering">⏳ Loading...</span>
                  ) : isPlaying ? (
                    <span className="status-playing">🟢 Playing</span>
                  ) : (
                    <span className="status-paused">⏸ Paused</span>
                  )}
                </div>

                <div className="queue-hero-actions">
                  <button
                    className={`queue-action-btn ${liked ? 'liked' : ''}`}
                    onClick={() => toggleLike(currentTrack)}
                    title={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                  >
                    <FiHeart size={16} fill={liked ? "currentColor" : "none"} />
                  </button>
                  <AddToPlaylistMenu track={currentTrack} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Up Next */}
      {queue.length > queueIndex + 1 && (
        <div className="queue-section">
          <p className="queue-section-label">
            NEXT IN QUEUE ({queue.length - queueIndex - 1} TRACKS)
          </p>
          {queue.slice(queueIndex + 1).map((track, i) => {
            const absoluteIndex = queueIndex + 1 + i;
            const isActive = currentTrack?.videoId === track.videoId;
            return (
              <div
                key={track.videoId + absoluteIndex}
                className={`queue-item${isActive ? ' queue-item-active' : ''}`}
                onClick={() => playTrack(track, true)}
                title={`${track.title} — click to play`}
              >
                <div className="queue-thumb-wrap">
                  <QueueThumb src={track.thumbnail} alt={track.title} />
                  <div className="queue-thumb-play-icon"><FiPlay size={13} /></div>
                </div>
                <div className="queue-item-info">
                  <span className="queue-item-title">{track.title}</span>
                  <span className="queue-item-artist">{track.artist}</span>
                </div>
                <span className="queue-item-num">{absoluteIndex + 1}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Previously played */}
      {queueIndex > 0 && (
        <div className="queue-section">
          <p className="queue-section-label">PREVIOUSLY PLAYED</p>
          {queue.slice(0, queueIndex).map((track, i) => (
            <div
              key={track.videoId + i}
              className="queue-item queue-item-played"
              onClick={() => playTrack(track, true)}
              title={`${track.title} — click to replay`}
            >
              <div className="queue-thumb-wrap">
                <QueueThumb src={track.thumbnail} alt={track.title} />
                <div className="queue-thumb-play-icon"><FiPlay size={13} /></div>
              </div>
              <div className="queue-item-info">
                <span className="queue-item-title">{track.title}</span>
                <span className="queue-item-artist">{track.artist}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QueuePanel;
