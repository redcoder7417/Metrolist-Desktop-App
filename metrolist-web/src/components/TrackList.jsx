import React, { useContext, useState, useEffect } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { ToastContext } from '../context/ToastContext';
import { FiPlay, FiPause, FiClock, FiHeart, FiDownload, FiCheck } from 'react-icons/fi';
import { addDownload, isDownloaded } from '../services/downloadsService';

const formatDuration = (seconds) => {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const TrackRow = ({ track, index }) => {
  const { playTrack, currentTrack, isPlaying } = useContext(PlayerContext);
  const { isLiked, toggleLike } = useLibrary();
  const { addToast } = useContext(ToastContext);

  const trackDuration = track.duration || track.durationSeconds || 0;
  const trackData = {
    videoId: track.id,
    title: track.title,
    artist: track.artist || track.subtitle,
    thumbnail: track.thumbnail || track.cover,
    duration: trackDuration,
  };
  const isActive = currentTrack?.videoId === trackData.videoId;
  const liked = isLiked(trackData.videoId);
  const [saved, setSaved] = useState(() => isDownloaded(track.id));

  useEffect(() => {
    setSaved(isDownloaded(track.id));
  }, [track.id]);

  const handleSave = (e) => {
    e.stopPropagation();
    if (saved) return;
    addDownload(trackData);
    setSaved(true);
    addToast(`Saved: ${track.title}`, 'info');
  };

  return (
    <div
      className={`track-item ${isActive ? 'active' : ''}`}
      onDoubleClick={() => playTrack(trackData)}
    >
      <div className="col-index">
        <span className="index-num">{index + 1}</span>
        <button className="play-overlay" onClick={() => playTrack(trackData)}>
          {isActive && isPlaying ? <FiPause size={14} /> : <FiPlay size={14} className="play-icon-offset" />}
        </button>
      </div>
      <div className="col-title">
        {trackData.thumbnail && (
          <img src={trackData.thumbnail} alt={trackData.title} />
        )}
        <div className="track-details">
          <span className={`title-text${isActive ? ' active-text' : ''}`}>{trackData.title}</span>
          <span className="artist-text">{trackData.artist}</span>
        </div>
      </div>
      <div className="track-list-actions">
        <button
          className={`track-icon-btn${liked ? ' liked' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleLike(trackData); }}
          title={liked ? 'Unlike' : 'Like'}
        >
          <FiHeart size={15} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button
          className={`track-icon-btn${saved ? ' saved-icon' : ''}`}
          onClick={handleSave}
          title={saved ? 'Saved offline' : 'Save offline'}
        >
          {saved ? <FiCheck size={15} strokeWidth={3} /> : <FiDownload size={15} />}
        </button>
      </div>
      <div className="col-duration">{formatDuration(trackDuration)}</div>
    </div>
  );
};

const TrackList = ({ tracks = [] }) => {
  if (tracks.length === 0) {
    return <div className="track-list-empty">No tracks found.</div>;
  }

  return (
    <div className="track-list">
      <div className="track-list-header">
        <div className="col-index">#</div>
        <div className="col-title">Title</div>
        <div className="col-duration" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiClock size={14} />
        </div>
      </div>

      {tracks.map((track, index) => (
        <TrackRow key={`${track.id}-${index}`} track={track} index={index} />
      ))}
    </div>
  );
};

export default TrackList;
