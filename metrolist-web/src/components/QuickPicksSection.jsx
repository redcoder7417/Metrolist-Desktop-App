import React, { useContext } from 'react';
import { FiPlay, FiPause } from 'react-icons/fi';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const QuickPickRow = ({ songs, onOpenDetails }) => {
  const { playTrack, currentTrack, isPlaying } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);

  return (
    <div className="quick-picks-row">
      {songs.map((item) => {
        const isActive = currentTrack?.videoId === item.id;
        const subtitle = item.subtitle?.replace('•', '').trim() || '';

        const handlePlay = (e) => {
          e.stopPropagation();
          if (item.type === 'song' || item.type === 'video') {
            playTrack({
              videoId: item.id,
              title: item.title,
              artist: subtitle,
              thumbnail: item.cover,
            });
            addToast(`Playing: ${item.title}`);
          } else if (onOpenDetails) {
            onOpenDetails(item);
          }
        };

        return (
          <div
            key={item.id}
            className={`quick-pick-card${isActive ? ' qp-active' : ''}`}
            onClick={handlePlay}
          >
            <div className="qp-thumb-wrap">
              {item.cover ? (
                <img src={item.cover} alt={item.title} className="qp-thumb" />
              ) : (
                <div className="qp-thumb-placeholder">🎵</div>
              )}
              <button className="qp-play-btn" onClick={handlePlay}>
                {isActive && isPlaying
                  ? <FiPause size={16} />
                  : <FiPlay size={16} style={{ marginLeft: 1 }} />
                }
              </button>
            </div>
            <div className="qp-info">
              <span className={`qp-title${isActive ? ' qp-title-active' : ''}`}>{item.title}</span>
              <span className="qp-artist">{subtitle}</span>
            </div>
            {item.duration && (
              <span className="qp-duration">{formatDuration(item.duration)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const QuickPicksSection = ({ items = [], onOpenDetails, onNavigateSearch }) => {
  if (!items || items.length === 0) return null;

  // Songs only, split into rows of up to 4 each, max 3 rows
  const songs = items.filter(i => i.type === 'song' || i.type === 'video' || i.type === 'playlist').slice(0, 12);
  const rows = [];
  for (let i = 0; i < songs.length; i += 4) {
    rows.push(songs.slice(i, i + 4));
  }

  return (
    <div className="home-section">
      <div className="home-section-header">
        <h3 className="section-title">Quick Picks</h3>
        <button
          className="see-all-btn"
          onClick={() => {
            if (onNavigateSearch) onNavigateSearch(items[0]?.title ? items[0].subtitle || 'Trending' : 'Music');
          }}
        >
          See all →
        </button>
      </div>
      <div className="quick-picks-grid">
        {rows.map((row, idx) => (
          <QuickPickRow key={idx} songs={row} onOpenDetails={onOpenDetails} />
        ))}
      </div>
    </div>
  );
};

export default QuickPicksSection;
