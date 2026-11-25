import React, { useState, useEffect, useContext } from 'react';
import { FiClock, FiPlay, FiPause, FiTrash, FiSearch, FiMusic } from 'react-icons/fi';
import { getRecentlyPlayed } from '../services/historyService';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';

const HISTORY_KEY = 'metrolist_recently_played';

const formatDate = (ts) => {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Group history by date bucket
const groupByDate = (items) => {
  const groups = {};
  items.forEach(t => {
    const d = new Date(t.timestamp);
    const key = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
};

const HistoryView = () => {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('');
  const [grouped, setGrouped] = useState({});
  const { playTrack, playQueue, currentTrack, isPlaying } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);

  const reload = () => {
    const h = getRecentlyPlayed();
    setHistory(h);
    setGrouped(groupByDate(h));
  };

  useEffect(() => {
    reload();
    window.addEventListener('recentlyPlayedUpdated', reload);
    return () => window.removeEventListener('recentlyPlayedUpdated', reload);
  }, []);

  const filtered = filter
    ? history.filter(t =>
        t.title?.toLowerCase().includes(filter.toLowerCase()) ||
        t.artist?.toLowerCase().includes(filter.toLowerCase())
      )
    : null;

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
    const list = (filtered || history).slice(0, 50);
    if (list.length === 0) return;
    const tracks = list.map(t => ({
      videoId: t.videoId || t.id,
      title: t.title,
      artist: t.artist,
      thumbnail: t.thumbnail,
    }));
    playQueue(tracks, 0);
    addToast(`Playing ${tracks.length} tracks from history`);
  };

  const handleClearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    window.dispatchEvent(new CustomEvent('recentlyPlayedUpdated'));
    addToast('Listening history cleared', 'info');
  };

  const TrackRow = ({ track, idx }) => {
    const id = track.videoId || track.id;
    const isActive = currentTrack?.videoId === id;
    return (
      <div
        className={`track-item${isActive ? ' active' : ''}`}
        onDoubleClick={() => handlePlay(track)}
      >
        <div className="col-index">
          <span className="index-num">{idx + 1}</span>
          <button className="play-overlay" onClick={() => handlePlay(track)}>
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
        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingRight: 16 }}>
          {formatDate(track.timestamp)}
        </span>
      </div>
    );
  };

  return (
    <div className="tab-view">
      {/* Header */}
      <div className="tab-hero">
        <div className="tab-hero-icon" style={{ background: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' }}>
          <FiClock size={40} />
        </div>
        <div className="tab-hero-info">
          <h1 className="tab-hero-title">Listening History</h1>
          <p className="tab-hero-sub">{history.length} track{history.length !== 1 ? 's' : ''} played</p>
          <div className="tab-hero-actions">
            {history.length > 0 && (
              <>
                <button className="hero-play-btn" onClick={handlePlayAll}>
                  <FiPlay size={18} style={{ marginLeft: 2 }} /> Play All
                </button>
                <button className="tab-danger-btn" onClick={handleClearHistory}>
                  <FiTrash size={16} /> Clear History
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter */}
      {history.length > 0 && (
        <div className="tab-filter-row">
          <div className="tab-search-wrap">
            <FiSearch size={15} className="tab-search-icon" />
            <input
              className="tab-search-input"
              placeholder="Filter history..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div className="tab-empty">
          <FiClock size={56} />
          <h3>No listening history</h3>
          <p>Songs you play will appear here. Start listening to build your history.</p>
        </div>
      ) : filtered ? (
        /* Flat filtered list */
        <div className="track-list">
          <div className="track-list-header">
            <span className="col-index">#</span>
            <span className="col-title">TITLE</span>
            <span style={{ paddingRight: 16, color: 'var(--text-subdued)', fontSize: 12 }}>PLAYED</span>
          </div>
          {filtered.length === 0
            ? <div className="tab-empty" style={{ paddingTop: 32 }}><p>No matches found</p></div>
            : filtered.map((t, i) => <TrackRow key={t.videoId + i} track={t} idx={i} />)
          }
        </div>
      ) : (
        /* Grouped by date */
        Object.entries(grouped).map(([date, tracks]) => (
          <div key={date} className="history-group">
            <h3 className="history-group-label">{date}</h3>
            <div className="track-list">
              {tracks.map((t, i) => <TrackRow key={t.videoId + i} track={t} idx={i} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default HistoryView;
