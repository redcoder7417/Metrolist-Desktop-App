import React, { useContext } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { FiHeart, FiTrendingUp, FiRadio, FiCloudRain, FiDisc, FiPlay } from 'react-icons/fi';

const renderIcon = (iconType) => {
  switch (iconType) {
    case 'heart':
      return <FiHeart size={28} fill="#fff" />;
    case 'trending':
      return <FiTrendingUp size={28} />;
    case 'radio':
      return <FiRadio size={28} />;
    case 'rain':
      return <FiCloudRain size={28} />;
    case 'disc':
    default:
      return <FiDisc size={28} />;
  }
};

const SingleCubeCard = ({ card, onOpenDetails }) => {
  const { playTrack } = useContext(PlayerContext);

  const handleClick = () => {
    if (card.cardName === 'Liked Songs' && onOpenDetails && !card.track?.videoId) {
      onOpenDetails({ type: 'liked-songs', title: 'Liked Songs' });
      return;
    }

    if (card.track) {
      playTrack(card.track);
    }
  };

  return (
    <div
      className="cube-card"
      onClick={handleClick}
      title={`Play ${card.cardName}: ${card.songTitle} (ID: ${card.songId})`}
    >
      <div className="cube-card-art" style={{ background: card.gradient }}>
        {renderIcon(card.iconType)}
        <div className="cube-play-overlay">
          <FiPlay size={22} fill="#fff" />
        </div>
      </div>

      <div className="cube-card-info">
        <span className="cube-card-title">{card.cardName}</span>
        <span className="cube-card-sub" title={card.songTitle}>
          ♪ {card.songTitle}
        </span>
      </div>
    </div>
  );
};

export default SingleCubeCard;
