import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiMusic } from 'react-icons/fi';

const CreatePlaylistModal = ({ isOpen, onClose, onCreate, defaultName }) => {
  const [name, setName] = useState(defaultName || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName || 'My Playlist');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <FiMusic size={20} />
            </div>
            <h2>Create Playlist</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <label htmlFor="playlist-name-input">Playlist Name</label>
          <input
            id="playlist-name-input"
            ref={inputRef}
            type="text"
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Favorites, Gym Hits..."
            maxLength={100}
          />
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn-create" disabled={!name.trim()}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePlaylistModal;
