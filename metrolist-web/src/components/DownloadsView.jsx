import React, { useState, useEffect, useContext } from 'react';
import { FiDownload, FiPlay, FiPause, FiTrash2, FiTrash, FiMusic, FiClock, FiSearch } from 'react-icons/fi';
import { getDownloads, removeDownload, clearDownloads } from '../services/downloadsService';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';
import { API_BASE } from '../services/api';

const formatTime = (secs) => {
  if (!secs || isNaN(secs)) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const DownloadsView = () => {
  const [downloads, setDownloads] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [filter, setFilter] = useState('');
  const { playTrack, playQueue, currentTrack, isPlaying } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);

  const reload = () => setDownloads(getDownloads());

  useEffect(() => {
    reload();
    window.addEventListener('downloadsUpdated', reload);
    return () => window.removeEventListener('downloadsUpdated', reload);
  }, []);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch(`${API_BASE}/download/progress`);
        if (res.ok) {
          const data = await res.json();
          setProgressMap(data);
        }
      } catch (err) {
        // ignore
      }
    };
    fetchProgress();
    const interval = setInterval(fetchProgress, 1000);
    return () => clearInterval(interval);
  }, []);

  const filtered = downloads.filter(t =>
    !filter || t.title?.toLowerCase().includes(filter.toLowerCase()) ||
    t.artist?.toLowerCase().includes(filter.toLowerCase())
  );

  const handlePlay = (track) => {
    playTrack({
      videoId: track.videoId || track.id,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
    });
    addToast(`Playing: ${track.title}`);
  };

  const handlePlayAll = () => {
    if (filtered.length === 0) return;
    const tracks = filtered.map(t => ({
      videoId: t.videoId || t.id,
      title: t.title,
      artist: t.artist,
      thumbnail: t.thumbnail,
    }));
    playQueue(tracks, 0);
    addToast(`Playing ${tracks.length} saved songs`);
  };

  const handleRemove = (videoId, title) => {
    removeDownload(videoId);
    addToast(`Removed: ${title}`, 'info');
  };

  const handleClearAll = () => {
    clearDownloads();
    addToast('Cleared all saved songs', 'info');
  };

  return (
    <div className="tab-view">
      {/* Header */}
      <div className="tab-hero downloads-hero">
        <div className="tab-hero-icon" style={{ background: 'linear-gradient(135deg, #00d2ff, #0077b6)' }}>
          <FiDownload size={40} />
        </div>
        <div className="tab-hero-info">
          <h1 className="tab-hero-title">Saved Songs</h1>
          <p className="tab-hero-sub">{downloads.length} track{downloads.length !== 1 ? 's' : ''} saved offline</p>
          <div className="tab-hero-actions">
            {downloads.length > 0 && (
              <>
                <button className="hero-play-btn" onClick={handlePlayAll}>
                  <FiPlay size={18} style={{ marginLeft: 2 }} /> Play All
                </button>
                <button className="tab-danger-btn" onClick={handleClearAll}>
                  <FiTrash size={16} /> Clear All
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search filter */}
      {downloads.length > 0 && (
        <div className="tab-filter-row">
          <div className="tab-search-wrap">
            <FiSearch size={15} className="tab-search-icon" />
            <input
              className="tab-search-input"
              placeholder="Filter saved songs..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="tab-empty">
          <FiDownload size={56} />
          <h3>No saved songs</h3>
          <p>Save songs by clicking the download icon on any track. They'll appear here for quick access.</p>
        </div>
      ) : (
        <div className="track-list">
          <div className="track-list-header">
            <span className="col-index">#</span>
            <span className="col-title">TITLE</span>
            <span style={{ flex: 1, paddingLeft: 8, color: 'var(--text-subdued)', fontSize: 12 }}>SAVED ON</span>
            <span className="col-duration"><FiClock size={14} /></span>
          </div>
          {filtered.map((track, i) => {
            const id = track.videoId || track.id;
            const isActive = currentTrack?.videoId === id;
            const progress = progressMap[id];
            const isDownloading = progress !== undefined;

            return (
              <div
                key={id + i}
                className={`track-item${isActive ? ' active' : ''}`}
                onDoubleClick={() => !isDownloading && handlePlay(track)}
              >
                <div className="col-index">
                  <span className="index-num">{i + 1}</span>
                  <button className="play-overlay" onClick={() => handlePlay(track)} disabled={isDownloading}>
                    {isActive && isPlaying ? <FiPause size={16} /> : <FiPlay size={16} />}
                  </button>
                </div>
                <div className="col-title">
                  <div className="track-thumb-wrap">
                    {track.thumbnail
                      ? <img src={track.thumbnail} alt={track.title} className="track-list-thumb" />
                      : <div className="track-thumb-placeholder"><FiMusic size={14} /></div>
                    }
                  </div>
                  <div className="track-details">
                    <span className={`title-text${isActive ? ' active-text' : ''}`}>{track.title}</span>
                    <span className="artist-text">{track.artist || 'Unknown Artist'}</span>
                  </div>
                </div>
                <span style={{ flex: 1, paddingLeft: 8, fontSize: 13, color: 'var(--text-subdued)' }}>
                  {isDownloading ? (
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                      Downloading... {progress}%
                    </span>
                  ) : (
                    formatDate(track.savedAt)
                  )}
                </span>
                <span className="col-duration">{formatTime(track.duration || track.durationSeconds)}</span>
                <button
                  className="track-action-btn"
                  onClick={() => handleRemove(id, track.title)}
                  title="Remove from saved"
                >
                  <FiTrash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DownloadsView;
