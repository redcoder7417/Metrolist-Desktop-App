import React, { useState } from 'react';
import { FiUser, FiCheck, FiX } from 'react-icons/fi';

const AVATAR_OPTIONS = ['Felix', 'Aneka', 'Oliver', 'Luna', 'Buster', 'Jasper'];

const UserNameModal = ({ isOpen, initialName = '', initialAvatar = 'Felix', onSave, onClose }) => {
  const [nameInput, setNameInput] = useState(initialName);
  const [avatarInput, setAvatarInput] = useState(initialAvatar);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalName = nameInput.trim() || 'Music Lover';
    onSave(finalName, avatarInput);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content username-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <FiUser className="modal-header-icon" size={22} />
            <h3>Welcome to Metrolist!</h3>
          </div>
          {onClose && (
            <button className="modal-close-btn" onClick={onClose}>
              <FiX size={18} />
            </button>
          )}
        </div>

        <p className="modal-subtitle">
          Please enter your name so we can personalize your music experience:
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="Your Name (e.g. Alex)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="modal-input"
              autoFocus
              maxLength={24}
            />
          </div>

          <p className="modal-subtitle" style={{ marginTop: '20px', marginBottom: '12px', fontSize: '13px' }}>
            Choose your robot avatar:
          </p>
          <div className="avatar-picker-grid" style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginBottom: '24px' }}>
            {AVATAR_OPTIONS.map(seed => (
              <div
                key={seed}
                onClick={() => setAvatarInput(seed)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  border: avatarInput === seed ? '3px solid #fff' : '2px solid transparent',
                  padding: '2px',
                  transition: 'all 0.2s ease',
                  background: avatarInput === seed ? 'rgba(255,255,255,0.1)' : 'transparent',
                  opacity: avatarInput === seed ? 1 : 0.6
                }}
              >
                <img 
                  src={`https://api.dicebear.com/9.x/bottts/svg?seed=${seed}`} 
                  alt="avatar option" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              </div>
            ))}
            </div>

          <div className="modal-actions">
            <button type="submit" className="modal-submit-btn">
              <FiCheck size={16} /> Save & Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserNameModal;
