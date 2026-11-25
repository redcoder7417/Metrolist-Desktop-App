import React, { useContext } from 'react';
import { FiPlay, FiShuffle } from 'react-icons/fi';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';
import { fetchPlaylist, fetchAlbum } from '../services/api';

const HeroSection = ({ item, onOpenDetails }) => {
  const { playQueue, playTrack } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);

  if (!item) return null;

  const subtitle = item.subtitle?.replace('•', '').trim() || '';

  const handlePlay = async (shuffle = false) => {
    if (item.type === 'song' || item.type === 'video') {
      playTrack({
        videoId: item.id,
        title: item.title,
        artist: item.subtitle || item.artist || 'YouTube Music',
        thumbnail: item.cover || item.thumbnailUrl,
        duration: item.duration || 0,
      });
      return;
    }
    if (item.type === 'playlist' || item.type === 'album') {
      try {
        const data = item.type === 'playlist'
          ? await fetchPlaylist(item.id)
          : await fetchAlbum(item.id);
        const tracks = (data.tracks || data.songs || []).map(t => ({
          videoId: t.id || t.videoId,
          title: t.title,
          artist: t.artist || t.subtitle || '',
          thumbnail: t.cover || t.thumbnail || item.cover,
        })).filter(t => t.videoId);
        if (tracks.length > 0) {
          const ordered = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
          playQueue(ordered, 0);
          addToast(shuffle ? `Shuffling: ${item.title}` : `Playing: ${item.title}`);
        }
      } catch {
        if (onOpenDetails) onOpenDetails(item);
      }
    } else {
      if (onOpenDetails) onOpenDetails(item);
    }
  };

  return (
    <div className="hero-section">
      {/* Blurred background */}
      {item.cover && (
        <div
          className="hero-bg"
          style={{ backgroundImage: `url(${item.cover})` }}
        />
      )}
      <div className="hero-overlay" />

      {/* Content */}
      <div className="hero-content">
        <div className="hero-artwork-wrap">
          {item.cover ? (
            <img src={item.cover} alt={item.title} className="hero-artwork" />
          ) : (
            <div className="hero-artwork-placeholder">🎵</div>
          )}
        </div>

        <div className="hero-info">
          <span className="hero-label">
            {item.type === 'album' ? 'FEATURED ALBUM' : item.type === 'playlist' ? 'FEATURED PLAYLIST' : 'FEATURED'}
          </span>
          <h2 className="hero-title">{item.title}</h2>
          {subtitle && <p className="hero-subtitle">{subtitle}</p>}

          <div className="hero-actions">
            <button className="hero-play-btn" onClick={() => handlePlay(false)}>
              <FiPlay size={20} style={{ marginLeft: 2 }} />
              Play
            </button>
            <button className="hero-shuffle-btn" onClick={() => handlePlay(true)}>
              <FiShuffle size={18} />
              Shuffle
            </button>
            <button
              className="hero-details-btn"
              onClick={() => onOpenDetails && onOpenDetails(item)}
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
