import React, { useContext, useState } from 'react';
import { FiPlay, FiPause, FiDownload, FiCheck } from 'react-icons/fi';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';
import { fetchPlaylist, fetchAlbum } from '../services/api';
import { addDownload, isDownloaded } from '../services/downloadsService';

const MediaCard = ({ item, onOpenDetails }) => {
  const { playTrack, currentTrack, isPlaying, playQueue } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(() => isDownloaded(item.id));

  const isActive = currentTrack?.videoId === item.id;
  const isPlayable = item.type === 'song' || item.type === 'video';
  const subtitle = item.subtitle?.replace('•', '').trim() || 'Artist';

  const handlePlayClick = async () => {
    if (isPlayable) {
      playTrack({
        videoId: item.id,
        title: item.title,
        artist: subtitle,
        thumbnail: item.cover,
      });
      addToast(`Playing: ${item.title}`);
    } else if (item.type === 'playlist' || item.type === 'album' || item.type === 'artist') {
      if (onOpenDetails) {
        onOpenDetails(item);
      }
    } else {
      addToast(`Cannot play ${item.type} directly yet.`, 'warning');
    }
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    if (saved) return;
    addDownload({
      videoId: item.id,
      title: item.title,
      artist: subtitle,
      thumbnail: item.cover,
      duration: item.duration,
    });
    setSaved(true);
    addToast(`Saved: ${item.title}`, 'info');
  };

  return (
    <div className="media-card" onClick={handlePlayClick}>
      <div className="media-card-image-container">
        {item.cover ? (
          <img
            src={item.cover}
            alt={item.title}
            className={`media-card-image ${item.type === 'artist' ? 'artist-circle' : ''}`}
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling?.style && (e.target.nextSibling.style.display = 'flex');
            }}
          />
        ) : null}
        <div className="media-card-img-placeholder" style={{ display: item.cover ? 'none' : 'flex' }}>
          🎵
        </div>

        {/* Save button (top-right) */}
        {isPlayable && (
          <button
            className={`media-card-save-btn${saved ? ' saved' : ''}`}
            onClick={handleSave}
            title={saved ? 'Saved offline' : 'Save offline'}
          >
            {saved ? <FiCheck size={14} strokeWidth={3} /> : <FiDownload size={14} />}
          </button>
        )}

        {/* Play button (bottom-right) */}
        <button className={`media-card-play-btn ${isActive ? 'active' : ''}`} onClick={(e) => {
          e.stopPropagation();
          handlePlayClick();
        }}>
          {isLoading
            ? <span className="card-spinner" />
            : (isActive && isPlaying
              ? <FiPause size={20} color="#000" />
              : <FiPlay size={20} color="#000" className="play-icon-offset" />
            )
          }
        </button>
      </div>
      <div className="media-card-info">
        <h4 className="media-card-title">{item.title}</h4>
        <p className="media-card-subtitle">{subtitle}</p>
      </div>
    </div>
  );
};

export default MediaCard;
