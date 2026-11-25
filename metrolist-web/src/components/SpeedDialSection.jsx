import React, { useState, useEffect } from 'react';
import { getRecentlyPlayed } from '../services/historyService';
import { getRandomCubeCards } from '../services/cubeCardsLogic';
import { useLibrary } from '../context/LibraryContext';
import { useContext } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { FiHeart, FiTrendingUp, FiRadio, FiCloudRain, FiDisc, FiPlay, FiPause, FiSun, FiZap } from 'react-icons/fi';

const renderIcon = (iconType, size = 28) => {
  switch (iconType) {
    case 'heart':     return <FiHeart size={size} fill="#fff" />;
    case 'trending':  return <FiTrendingUp size={size} />;
    case 'radio':     return <FiRadio size={size} />;
    case 'rain':      return <FiCloudRain size={size} />;
    case 'sun':       return <FiSun size={size} />;
    case 'zap':       return <FiZap size={size} />;
    case 'disc':
    default:          return <FiDisc size={size} />;
  }
};

const SpeedDialCard = ({ card, onOpenDetails, onNavigateSearch, onNavigateTab }) => {
  const { playTrack, currentTrack, isPlaying } = useContext(PlayerContext);
  const isActive = Boolean(card.track?.videoId && currentTrack?.videoId === card.track.videoId);

  const handleClick = () => {
    if (card.actionTab && onNavigateTab) {
      onNavigateTab(card.actionTab);
      return;
    }
    if (card.searchQuery && onNavigateSearch) {
      onNavigateSearch(card.searchQuery);
      return;
    }
    if (card.cardName === 'Liked Songs' && onOpenDetails && !card.track?.videoId) {
      onOpenDetails({ type: 'liked-songs', title: 'Liked Songs' });
      return;
    }
    if (card.track?.videoId) {
      playTrack(card.track);
    }
  };

  return (
    <div
      className={`speed-dial-card${isActive ? ' speed-dial-active' : ''}`}
      onClick={handleClick}
      title={`${card.cardName}: ${card.songTitle}`}
    >
      <div className="speed-dial-art" style={{ background: card.gradient }}>
        {renderIcon(card.iconType, 22)}
        <div className="speed-dial-overlay">
          {isActive && isPlaying
            ? <FiPause size={18} fill="#fff" />
            : <FiPlay size={18} style={{ marginLeft: 1 }} fill="#fff" />
          }
        </div>
      </div>
      <div className="speed-dial-info">
        <span className="speed-dial-title">{card.cardName}</span>
        <span className="speed-dial-sub" title={card.songTitle}>♪ {card.songTitle}</span>
      </div>
    </div>
  );
};

const SpeedDialSection = ({ onOpenDetails, onNavigateSearch, onNavigateTab }) => {
  const { likedSongs } = useLibrary();
  const [cards, setCards] = useState([]);

  const refresh = () => {
    const history = getRecentlyPlayed();
    const generated = getRandomCubeCards(history, likedSongs);
    setCards(generated);
  };

  useEffect(() => {
    refresh();
    window.addEventListener('recentlyPlayedUpdated', refresh);
    return () => window.removeEventListener('recentlyPlayedUpdated', refresh);
  }, [likedSongs]);

  if (cards.length === 0) return null;

  return (
    <div className="home-section">
      <div className="home-section-header">
        <h3 className="section-title">Speed Dial</h3>
        <span className="section-subtitle">Jump back in</span>
      </div>
      <div className="speed-dial-grid">
        {cards.map((card, idx) => (
          <SpeedDialCard
            key={`${card.cardName}-${idx}`}
            card={card}
            onOpenDetails={onOpenDetails}
            onNavigateSearch={onNavigateSearch}
            onNavigateTab={onNavigateTab}
          />
        ))}
      </div>
    </div>
  );
};

export default SpeedDialSection;
