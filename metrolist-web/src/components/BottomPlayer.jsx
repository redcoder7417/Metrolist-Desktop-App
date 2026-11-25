import React, { useContext, useState, useRef, useEffect } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import {
  FiPlay, FiPause, FiSkipBack, FiSkipForward,
  FiRepeat, FiShuffle, FiVolume2, FiVolumeX, FiHeart,
  FiList, FiSliders, FiMaximize2, FiMoon
} from 'react-icons/fi';

const formatTime = (time) => {
  if (!time || isNaN(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatSleep = (val) => {
  if (val === 'end_of_track') return 'Track end';
  if (typeof val !== 'number') return '';
  const m = Math.floor(val / 60);
  const s = val % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const BottomPlayer = ({ onToggleRightSidebar, rightSidebarOpen, onOpenFullscreen, onOpenEq }) => {
  const {
    currentTrack, isPlaying, isBuffering,
    progress, duration, volume,
    togglePlay, seek, changeVolume,
    queue, queueIndex,
    playNext, playPrev,
    isShuffle, repeatMode,
    toggleShuffle, toggleRepeat,
    eqEnabled, sleepTimerSeconds, setSleepTimer, streamInfo
  } = useContext(PlayerContext);

  const { isLiked, toggleLike } = useLibrary();
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const sleepRef = useRef(null);

  useEffect(() => {
    const onOutside = (e) => {
      if (sleepRef.current && !sleepRef.current.contains(e.target)) {
        setSleepMenuOpen(false);
      }
    };
    if (sleepMenuOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [sleepMenuOpen]);

  const progressPercent = duration ? Math.min(100, (progress / duration) * 100) : 0;
  const canPrev = queue.length > 0 && (queueIndex > 0 || progress > 3);
  const canNext = queue.length > 0 && (queueIndex < queue.length - 1 || repeatMode !== 'off');

  const handleVolumeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    changeVolume(pct);
    if (pct > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (isMuted) { changeVolume(prevVolume || 0.7); setIsMuted(false); }
    else { setPrevVolume(volume); changeVolume(0); setIsMuted(true); }
  };

  return (
    <footer className="bottom-player">

      {/* Left: Track Info */}
      <div className="player-left">
        {currentTrack ? (
          <>
            <div
              className="track-cover-wrap clickable"
              onClick={onOpenFullscreen}
              title="Open Fullscreen & Synced Lyrics"
            >
              <img src={currentTrack.thumbnail} alt="cover" className="track-cover" />
              <div className="track-cover-expand">
                <FiMaximize2 size={14} />
              </div>
              {isPlaying && <div className="track-cover-pulse" />}
            </div>
            <div className="track-info" onClick={onOpenFullscreen} style={{ cursor: 'pointer', minWidth: 0 }}>
              <h4 className="track-title-marquee" title={currentTrack.title}>{currentTrack.title}</h4>
              <p>
                {currentTrack.artist}
                {streamInfo?.bitrate ? (
                  <span className="bp-quality-tag">
                    {Math.round(streamInfo.bitrate / 1000)}k
                  </span>
                ) : null}
              </p>
            </div>
            <button
              className={`like-btn icon-btn${currentTrack && isLiked(currentTrack.videoId) ? ' liked' : ''}`}
              onClick={() => currentTrack && toggleLike(currentTrack)}
              title={currentTrack && isLiked(currentTrack.videoId) ? 'Unlike' : 'Like'}
              disabled={!currentTrack}
            >
              <FiHeart size={18} />
            </button>
          </>
        ) : (
          <div className="empty-track-info">Select a track to play</div>
        )}
      </div>

      {/* Center: Controls + Progress */}
      <div className="player-center">
        <div className="player-controls">
          <button
            className="control-btn"
            onClick={toggleShuffle}
            title="Shuffle"
            style={{ color: isShuffle ? 'var(--accent-cyan)' : undefined }}
          >
            <FiShuffle size={17} />
            {isShuffle && <span className="active-dot" />}
          </button>

          <button
            className="control-btn"
            onClick={playPrev}
            disabled={!canPrev}
            title="Previous"
            style={{ opacity: canPrev ? 1 : 0.4 }}
          >
            <FiSkipBack size={21} />
          </button>

          <button
            className={`play-pause-btn${isBuffering ? ' buffering' : ''}`}
            onClick={togglePlay}
            disabled={!currentTrack || isBuffering}
            title={isBuffering ? 'Loading...' : 'Play/Pause'}
          >
            {isBuffering
              ? <span className="player-spinner" />
              : isPlaying
                ? <FiPause size={21} />
                : <FiPlay size={21} style={{ marginLeft: 2 }} />
            }
          </button>

          <button
            className="control-btn"
            onClick={playNext}
            disabled={!canNext}
            title="Next"
            style={{ opacity: canNext ? 1 : 0.4 }}
          >
            <FiSkipForward size={21} />
          </button>

          <button
            className="control-btn"
            onClick={toggleRepeat}
            title={repeatMode === 'off' ? 'Enable repeat' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
            style={{ color: repeatMode !== 'off' ? 'var(--accent-cyan)' : undefined, position: 'relative' }}
          >
            <FiRepeat size={17} />
            {repeatMode === 'one' && <span className="repeat-badge">1</span>}
            {repeatMode !== 'off' && <span className="active-dot" />}
          </button>
        </div>

        <div className="playback-bar">
          <span className="time-text">{formatTime(progress)}</span>
          <div
            className="progress-container"
            onClick={(e) => {
              if (!duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seek(pct * duration);
            }}
          >
            <div className="progress-bg">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
                <div className="progress-thumb" />
              </div>
            </div>
          </div>
          <span className="time-text">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: EQ, Sleep Timer, Lyrics/Fullscreen, Queue, Volume */}
      <div className="player-right" style={{ gap: 12 }}>
        <button
          className="control-btn"
          onClick={onOpenEq}
          title="Audio Equalizer & Speed"
          style={{ color: eqEnabled ? 'var(--accent-cyan)' : undefined, position: 'relative' }}
        >
          <FiSliders size={17} />
          {eqEnabled && <span className="active-dot" />}
        </button>

        <div ref={sleepRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button
            className="control-btn"
            onClick={() => setSleepMenuOpen(v => !v)}
            title="Sleep Timer"
            style={{ color: sleepTimerSeconds ? 'var(--accent-cyan)' : undefined, gap: 4 }}
          >
            <FiMoon size={17} />
            {sleepTimerSeconds && <span className="bp-sleep-badge">{formatSleep(sleepTimerSeconds)}</span>}
          </button>
          {sleepMenuOpen && (
            <div className="sleep-popover">
              <div className="sleep-popover-title">Sleep Timer</div>
              {[15, 30, 45, 60].map((min) => (
                <button
                  key={min}
                  className="sleep-option"
                  onClick={() => { setSleepTimer(min); setSleepMenuOpen(false); }}
                >
                  {min} minutes
                </button>
              ))}
              <button
                className={`sleep-option${sleepTimerSeconds === 'end_of_track' ? ' active' : ''}`}
                onClick={() => { setSleepTimer('end_of_track'); setSleepMenuOpen(false); }}
              >
                End of current track
              </button>
              {sleepTimerSeconds && (
                <button
                  className="sleep-option danger"
                  onClick={() => { setSleepTimer(null); setSleepMenuOpen(false); }}
                >
                  Turn off timer
                </button>
              )}
            </div>
          )}
        </div>

        <button
          className="control-btn"
          onClick={onOpenFullscreen}
          disabled={!currentTrack}
          title="Fullscreen & Lyrics"
          style={{ opacity: currentTrack ? 1 : 0.35 }}
        >
          <FiMaximize2 size={16} />
        </button>

        <button
          className="control-btn"
          onClick={onToggleRightSidebar}
          title="Now Playing & Queue"
          style={{ color: rightSidebarOpen ? 'var(--accent-cyan)' : undefined, position: 'relative' }}
        >
          <FiList size={19} />
          {rightSidebarOpen && <span className="active-dot" />}
        </button>

        <div className="volume-control">
          <button className="icon-btn volume-icon" onClick={toggleMute} title="Mute/Unmute">
            {volume === 0 || isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
          </button>
          <div className="volume-slider-container" onClick={handleVolumeClick}>
            <div className="progress-bg">
              <div className="progress-fill" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}>
                <div className="progress-thumb" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default BottomPlayer;
