import React, { useContext, useEffect, useRef, useState } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { ToastContext } from '../context/ToastContext';
import { fetchLyrics } from '../services/api';
import { addDownload, isDownloaded } from '../services/downloadsService';
import {
  FiChevronDown, FiPlay, FiPause, FiSkipBack, FiSkipForward,
  FiShuffle, FiRepeat, FiHeart, FiDownload, FiCheck, FiSliders, FiMusic
} from 'react-icons/fi';

const formatTime = (t) => {
  if (!t || isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const FullscreenPlayer = ({ isOpen, onClose, onOpenEq }) => {
  const {
    currentTrack, isPlaying, isBuffering,
    progress, duration,
    togglePlay, seek, playNext, playPrev,
    isShuffle, repeatMode, toggleShuffle, toggleRepeat,
    analyserRef, streamInfo
  } = useContext(PlayerContext);
  const { isLiked, toggleLike } = useLibrary();
  const { addToast } = useContext(ToastContext);

  const [lyrics, setLyrics] = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [ambientRgb, setAmbientRgb] = useState('0, 210, 255');
  const [saved, setSaved] = useState(false);

  const canvasRef = useRef(null);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (currentTrack?.videoId) {
      setSaved(isDownloaded(currentTrack.videoId));
    }
  }, [currentTrack?.videoId]);

  // Extract dominant artwork color for dynamic ambient backdrop
  useEffect(() => {
    if (!currentTrack?.thumbnail) {
      setAmbientRgb('0, 210, 255');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness > 30 && brightness < 235) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        if (count > 0) {
          setAmbientRgb(`${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`);
        }
      } catch {
        setAmbientRgb('0, 210, 255');
      }
    };
    img.onerror = () => setAmbientRgb('0, 210, 255');
    img.src = currentTrack.thumbnail;
  }, [currentTrack?.thumbnail]);

  // Fetch lyrics whenever track changes and fullscreen player is open
  useEffect(() => {
    if (!isOpen || !currentTrack?.videoId) return;
    let cancelled = false;
    setLyricsLoading(true);
    setLyrics(null);
    fetchLyrics({
      videoId: currentTrack.videoId,
      title: currentTrack.title,
      artist: currentTrack.artist,
      duration: duration || currentTrack.duration || 0,
    })
      .then((res) => {
        if (!cancelled) setLyrics(res);
      })
      .catch(() => {
        if (!cancelled) setLyrics(null);
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, currentTrack?.videoId]);

  // 60fps Canvas Audio Frequency Visualizer
  useEffect(() => {
    if (!isOpen) return;
    let animId;
    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef?.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const bars = 40;
        const gap = 4;
        const barW = (w - gap * (bars - 1)) / bars;

        if (analyser && isPlaying) {
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          for (let i = 0; i < bars; i++) {
            const val = data[Math.min(i, data.length - 1)] || 0;
            const barH = Math.max(4, (val / 255) * (h - 4));
            const x = i * (barW + gap);
            const y = h - barH;
            ctx.fillStyle = `rgba(${ambientRgb}, ${0.35 + (val / 255) * 0.65})`;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, 3);
            ctx.fill();
          }
        } else {
          for (let i = 0; i < bars; i++) {
            const x = i * (barW + gap);
            ctx.fillStyle = `rgba(${ambientRgb}, 0.18)`;
            ctx.beginPath();
            ctx.roundRect(x, h - 4, barW, 4, 2);
            ctx.fill();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [isOpen, isPlaying, ambientRgb, analyserRef]);

  // Determine active synced lyric line
  const progressMs = progress * 1000;
  let activeIndex = -1;
  if (lyrics?.synced && lyrics.lines?.length > 0) {
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].timeMs <= progressMs + 250) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  // Escape key closes fullscreen
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !currentTrack) return null;

  const liked = isLiked(currentTrack.videoId);
  const progressPct = duration ? (progress / duration) * 100 : 0;

  const handleSave = () => {
    if (saved) return;
    addDownload(currentTrack);
    setSaved(true);
    addToast(`Downloading for offline: ${currentTrack.title}`, 'info');
  };

  return (
    <div
      className="fullscreen-player"
      style={{
        background: `radial-gradient(circle at 22% 35%, rgba(${ambientRgb}, 0.34) 0%, rgba(10,12,18,0.96) 62%, #07080c 100%)`,
      }}
    >
      {currentTrack.thumbnail && (
        <div
          className="fs-backdrop-art"
          style={{ backgroundImage: `url(${currentTrack.thumbnail})` }}
        />
      )}

      {/* Header */}
      <header className="fs-header">
        <button className="fs-close-btn" onClick={onClose} title="Minimize (Esc)">
          <FiChevronDown size={22} />
          <span>Now Playing</span>
        </button>

        <div className="fs-badges">
          {streamInfo?.clientName && (
            <span className="fs-codec-pill">
              {streamInfo.isSabr ? 'SABR • ' : ''}
              {streamInfo.codecs?.toUpperCase() || 'AUDIO'}
              {streamInfo.bitrate ? ` • ${Math.round(streamInfo.bitrate / 1000)} kbps` : ''}
            </span>
          )}
          <button className="fs-pill-btn" onClick={onOpenEq} title="Equalizer & DSP">
            <FiSliders size={15} /> EQ
          </button>
        </div>
      </header>

      {/* Split Content */}
      <div className="fs-body">
        {/* Left: Artwork, Visualizer, Controls */}
        <div className="fs-left">
          <div className="fs-art-frame" style={{ boxShadow: `0 28px 70px rgba(${ambientRgb}, 0.32)` }}>
            {currentTrack.thumbnail ? (
              <img src={currentTrack.thumbnail} alt={currentTrack.title} className={`fs-art-img${isPlaying ? ' playing' : ''}`} />
            ) : (
              <div className="fs-art-placeholder"><FiMusic size={64} /></div>
            )}
          </div>

          <canvas ref={canvasRef} width={380} height={54} className="fs-visualizer-canvas" />

          <div className="fs-track-meta">
            <div className="fs-track-text">
              <h1 title={currentTrack.title}>{currentTrack.title}</h1>
              <p>{currentTrack.artist || 'Unknown Artist'}</p>
            </div>
            <div className="fs-track-actions">
              <button
                className={`fs-icon-btn${liked ? ' liked' : ''}`}
                onClick={() => toggleLike(currentTrack)}
                title={liked ? 'Unlike' : 'Like'}
              >
                <FiHeart size={20} fill={liked ? 'currentColor' : 'none'} />
              </button>
              <button
                className={`fs-icon-btn${saved ? ' saved' : ''}`}
                onClick={handleSave}
                title={saved ? 'Saved offline' : 'Save offline'}
              >
                {saved ? <FiCheck size={20} /> : <FiDownload size={20} />}
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="fs-progress-wrap">
            <div
              className="fs-progress-bar"
              onClick={(e) => {
                if (!duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
              }}
            >
              <div className="fs-progress-bg">
                <div className="fs-progress-fill" style={{ width: `${progressPct}%`, background: `rgb(${ambientRgb})` }}>
                  <div className="fs-progress-thumb" />
                </div>
              </div>
            </div>
            <div className="fs-time-row">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="fs-controls">
            <button
              className={`fs-ctrl-btn${isShuffle ? ' active' : ''}`}
              onClick={toggleShuffle}
              title="Shuffle"
            >
              <FiShuffle size={20} />
            </button>
            <button className="fs-ctrl-btn" onClick={playPrev} title="Previous">
              <FiSkipBack size={26} />
            </button>
            <button
              className="fs-play-btn"
              onClick={togglePlay}
              disabled={isBuffering}
              style={{ background: '#fff', color: '#000' }}
            >
              {isBuffering ? (
                <span className="player-spinner" />
              ) : isPlaying ? (
                <FiPause size={26} />
              ) : (
                <FiPlay size={26} style={{ marginLeft: 3 }} />
              )}
            </button>
            <button className="fs-ctrl-btn" onClick={playNext} title="Next">
              <FiSkipForward size={26} />
            </button>
            <button
              className={`fs-ctrl-btn${repeatMode !== 'off' ? ' active' : ''}`}
              onClick={toggleRepeat}
              title="Repeat"
            >
              <FiRepeat size={20} />
              {repeatMode === 'one' && <span className="fs-repeat-one">1</span>}
            </button>
          </div>
        </div>

        {/* Right: Synced Lyrics */}
        <div className="fs-lyrics-panel">
          <div className="fs-lyrics-header">
            <span>LYRICS</span>
            {lyrics?.source && (
              <span className="fs-lyrics-source">
                {lyrics.synced ? '● Synced' : 'Plain'} · {lyrics.source}
              </span>
            )}
          </div>

          <div className="fs-lyrics-scroll">
            {lyricsLoading && (
              <div className="fs-lyrics-state">
                <span className="card-spinner" />
                <p>Fetching lyrics...</p>
              </div>
            )}

            {!lyricsLoading && (!lyrics || (!lyrics.lines?.length && !lyrics.plain)) && (
              <div className="fs-lyrics-state">
                <FiMusic size={40} style={{ opacity: 0.4 }} />
                <p>No lyrics available for this track</p>
                <span>Enjoy the music!</span>
              </div>
            )}

            {!lyricsLoading && lyrics?.lines?.length > 0 && (
              <div className="fs-lyrics-lines">
                {lyrics.lines.map((line, idx) => {
                  const isCurrent = lyrics.synced && idx === activeIndex;
                  const isPast = lyrics.synced && idx < activeIndex;
                  return (
                    <p
                      key={`${line.timeMs}-${idx}`}
                      ref={isCurrent ? activeLineRef : null}
                      className={`fs-lyric-line${isCurrent ? ' active' : ''}${isPast ? ' past' : ''}${lyrics.synced ? ' clickable' : ''}`}
                      onClick={() => {
                        if (lyrics.synced) seek(line.timeMs / 1000);
                      }}
                    >
                      {line.text}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullscreenPlayer;
