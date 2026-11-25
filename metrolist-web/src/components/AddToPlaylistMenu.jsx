import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';
import { FiPlus, FiX, FiList, FiHeart } from 'react-icons/fi';

const AddToPlaylistMenu = ({ track }) => {
  const { customPlaylists, addSongToPlaylist, toggleLike, isLiked } = useLibrary();
  const { addToQueue } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef();

  const liked = track?.videoId ? isLiked(track.videoId) : false;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggleLike = async () => {
    await toggleLike(track);
    if (addToast) {
      addToast(liked ? `Removed from Liked Songs` : `Added "${track.title}" to Liked Songs`, 'info');
    }
    setIsOpen(false);
  };

  const handleAddPlaylist = async (playlistId, playlistName) => {
    await addSongToPlaylist(playlistId, track);
    if (addToast) addToast(`Added to playlist "${playlistName}"`, 'info');
    setIsOpen(false);
  };

  const handleAddToQueue = () => {
    addToQueue(track);
    if (addToast) addToast(`Added "${track.title}" to Queue`, 'info');
    setIsOpen(false);
  };

  return (
    <div className="add-to-playlist-container" ref={menuRef} style={{ position: 'relative' }}>
      <button
        className="lib-unlike-btn"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Add to queue, playlist, or liked songs"
      >
        <FiPlus size={16} />
      </button>

      {isOpen && (
        <div className="add-to-playlist-dropdown">
          <div className="dropdown-header">
            <span>Add Options</span>
            <button className="close-dropdown" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
              <FiX size={14}/>
            </button>
          </div>

          <ul className="dropdown-list">
            <li className="dropdown-queue-item" onClick={(e) => { e.stopPropagation(); handleAddToQueue(); }}>
              <FiList size={14} style={{ marginRight: 8, color: '#00d2ff' }} />
              <strong>Add to Queue</strong>
            </li>

            <li className="dropdown-queue-item" onClick={(e) => { e.stopPropagation(); handleToggleLike(); }}>
              <FiHeart size={14} style={{ marginRight: 8, color: liked ? '#ff4d6d' : '#fff' }} fill={liked ? '#ff4d6d' : 'none'} />
              <strong>{liked ? 'Remove from Liked' : 'Add to Liked Songs'}</strong>
            </li>

            {customPlaylists && customPlaylists.length > 0 && (
              <>
                <li className="dropdown-divider-item" disabled style={{ padding: '4px 16px', fontSize: 10, color: '#777', cursor: 'default' }}>
                  PLAYLISTS
                </li>
                {customPlaylists.map(pl => (
                  <li key={pl.id} onClick={(e) => { e.stopPropagation(); handleAddPlaylist(pl.id, pl.name); }}>
                    {pl.name}
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AddToPlaylistMenu;
