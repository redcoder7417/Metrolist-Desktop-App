import React, { useContext, useState, useRef } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import {
  FiPlay, FiPause, FiSkipBack, FiSkipForward,
  FiVolume2, FiVolumeX, FiHeart, FiMusic, FiList,
  FiChevronDown, FiChevronUp, FiX, FiMaximize2, FiTrash2
} from 'react-icons/fi';

const formatTime = (t) => {
  if (!t || isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// Animated playing bars
const PlayingBars = () => (
  <div className="rs-playing-bars">
    <span /><span /><span />
  </div>
);

const QueueThumb = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  return (failed || !src) ? (
    <div className="rs-queue-thumb-ph"><FiMusic size={12} /></div>
  ) : (
    <img src={src} alt={alt || 'track'} className="rs-queue-thumb" onError={() => setFailed(true)} />
  );
};

const RightSidebar = ({ isOpen, onOpenFullscreen }) => {
  const {
    currentTrack, isPlaying, isBuffering,
    progress, duration, volume,
    togglePlay, seek, changeVolume,
    queue, queueIndex, playTrack, playNext, playPrev, removeFromQueue, clearUpNext
  } = useContext(PlayerContext);

  const { isLiked, toggleLike } = useLibrary();
  const [isMuted, setIsMuted] = useState(false);
  const [prevVol, setPrevVol] = useState(1);
  const [showQueue, setShowQueue] = useState(true);

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const liked = currentTrack ? isLiked(currentTrack.videoId) : false;
  const canPrev = queue.length > 0 && queueIndex > 0;
  const canNext = queue.length > 0 && queueIndex < queue.length - 1;

  const handleSeek = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * duration);
  };

  const handleVolume = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    changeVolume(pct);
    if (pct > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (isMuted) { changeVolume(prevVol || 0.7); setIsMuted(false); }
    else { setPrevVol(volume); changeVolume(0); setIsMuted(true); }
  };

  const upNext = queue.slice(queueIndex + 1).slice(0, 8);

  if (!isOpen) return null;

  return (
    <aside className="right-sidebar">
      {/* Now Playing */}
      <div className="rs-now-playing">
        <p className="rs-section-label">NOW PLAYING</p>

        {currentTrack ? (
          <>
            {/* Large Album Art */}
            <div className="rs-artwork-wrap" onClick={togglePlay}>
              {currentTrack.thumbnail ? (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="rs-artwork"
                />
              ) : (
                <div className="rs-artwork-placeholder"><FiMusic size={48} /></div>
              )}
              <div className="rs-artwork-overlay">
                {isBuffering
                  ? <span className="rs-spinner" />
                  : isPlaying
                    ? <PlayingBars />
                    : <FiPlay size={28} />}
              </div>
            </div>

            {/* Track Info */}
            <div className="rs-track-info">
              <div className="rs-track-title-row">
                <h4 className="rs-track-title" title={currentTrack.title}>
                  {currentTrack.title}
                </h4>
                <button
                  className={`rs-like-btn${liked ? ' liked' : ''}`}
                  onClick={() => toggleLike(currentTrack)}
                  title={liked ? 'Unlike' : 'Like'}
                >
                  <FiHeart size={18} fill={liked ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p className="rs-track-artist">{currentTrack.artist || 'Unknown Artist'}</p>
            </div>

            {/* Progress */}
            <div className="rs-progress-area">
              <div className="rs-progress-bar" onClick={handleSeek}>
                <div className="rs-progress-bg">
                  <div className="rs-progress-fill" style={{ width: `${progressPercent}%` }}>
                    <div className="rs-progress-thumb" />
                  </div>
                </div>
              </div>
              <div className="rs-time-row">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="rs-controls">
              <button className="rs-ctrl-btn" onClick={playPrev} disabled={!canPrev} style={{ opacity: canPrev ? 1 : 0.35 }}>
                <FiSkipBack size={20} />
              </button>
              <button
                className={`rs-play-btn${isBuffering ? ' buffering' : ''}`}
                onClick={togglePlay}
                disabled={isBuffering}
              >
                {isBuffering
                  ? <span className="rs-spinner-sm" />
                  : isPlaying
                    ? <FiPause size={22} />
                    : <FiPlay size={22} style={{ marginLeft: 2 }} />
                }
              </button>
              <button className="rs-ctrl-btn" onClick={playNext} disabled={!canNext} style={{ opacity: canNext ? 1 : 0.35 }}>
                <FiSkipForward size={20} />
              </button>
            </div>

            {/* Volume */}
            <div className="rs-volume-row">
              <button className="rs-ctrl-btn rs-vol-icon" onClick={toggleMute}>
                {volume === 0 || isMuted ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
              </button>
              <div className="rs-volume-slider" onClick={handleVolume}>
                <div className="rs-progress-bg">
                  <div className="rs-progress-fill" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}>
                    <div className="rs-progress-thumb" />
                  </div>
                </div>
              </div>
            </div>

            {/* Add to Playlist & Fullscreen Lyrics */}
            <div className="rs-actions-row">
              <AddToPlaylistMenu track={currentTrack} />
              {onOpenFullscreen && (
                <button className="rs-fs-btn" onClick={onOpenFullscreen} title="Fullscreen & Synced Lyrics">
                  <FiMaximize2 size={14} /> Lyrics
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="rs-empty">
            <div className="rs-empty-art">
              <FiMusic size={40} />
            </div>
            <p>Nothing playing yet</p>
            <span>Pick a song to start listening</span>
          </div>
        )}
      </div>

      {/* Queue */}
      <div className="rs-queue">
        <div className="rs-queue-header-wrap">
          <button className="rs-queue-header" onClick={() => setShowQueue(v => !v)}>
            <span><FiList size={15} style={{ marginRight: 6 }} />Up Next</span>
            {upNext.length > 0 && <span className="rs-queue-count">{upNext.length}</span>}
            {showQueue ? <FiChevronUp size={15} /> : <FiChevronDown size={15} />}
          </button>
          {upNext.length > 0 && clearUpNext && (
            <button
              className="rs-queue-clear-btn"
              onClick={clearUpNext}
              title="Clear Up Next"
            >
              <FiTrash2 size={13} />
            </button>
          )}
        </div>

        {showQueue && (
          <div className="rs-queue-list">
            {upNext.length === 0 ? (
              <p className="rs-queue-empty">Queue is empty</p>
            ) : (
              upNext.map((track, i) => (
                <div
                  key={track.videoId + i}
                  className="rs-queue-item"
                  onClick={() => playTrack(track, true)}
                  title={`${track.title} — click to play`}
                >
                  <QueueThumb src={track.thumbnail} alt={track.title} />
                  <div className="rs-queue-info">
                    <span className="rs-queue-title">{track.title}</span>
                    <span className="rs-queue-artist">{track.artist}</span>
                  </div>
                  <button 
                    className="rs-queue-remove-btn" 
                    title="Remove from queue"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(queueIndex + 1 + i);
                    }}
                  >
                    <FiX size={16} />
                  </button>
                  <span className="rs-queue-num">{queueIndex + i + 2}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default RightSidebar;
