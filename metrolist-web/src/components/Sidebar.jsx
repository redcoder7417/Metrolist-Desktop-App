import React, { useContext, useState } from 'react';
import {
  FiHome, FiSearch, FiBook, FiPlusSquare, FiHeart, FiMusic,
  FiDownload, FiClock, FiList, FiSettings, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { useLibrary } from '../context/LibraryContext';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';
import CreatePlaylistModal from './CreatePlaylistModal';

const APP_VERSION = '14.0.0';

const Sidebar = ({ activeTab, setActiveTab, onOpenDetails, selectedMedia, userName = 'Listener', userAvatar = 'Felix', onEditName, collapsed, onToggleCollapse }) => {
  const { likedSongs, customPlaylists, createPlaylist } = useLibrary();
  const { playTrack, currentTrack } = useContext(PlayerContext);
  const { addToast } = useContext(ToastContext);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateSubmit = async (name) => {
    const newPlaylist = await createPlaylist(name);
    if (newPlaylist) {
      if (addToast) addToast(`Created playlist "${newPlaylist.name}"`, 'info');
      if (onOpenDetails) {
        onOpenDetails({ id: newPlaylist.id, type: 'custom-playlist', title: newPlaylist.name });
      }
    }
  };

  const navItems = [
    { id: 'home',    icon: <FiHome size={20} />,     label: 'Home' },
    { id: 'search',  icon: <FiSearch size={20} />,   label: 'Search' },
    { id: 'library', icon: <FiBook size={20} />,     label: 'Your Library' },
  ];

  const secondaryItems = [
    { id: 'downloads', icon: <FiDownload size={20} />, label: 'Downloads' },
    { id: 'history',   icon: <FiClock size={20} />,   label: 'History' },
    {
      id: 'liked', icon: <FiHeart size={20} />, label: 'Liked Songs',
      badge: likedSongs.length > 0 ? likedSongs.length : null,
    },
    { id: 'playlists', icon: <FiList size={20} />, label: 'Playlists' },
    { id: 'settings',  icon: <FiSettings size={20} />, label: 'Settings' },
  ];

  return (
    <>
      <nav className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>

        {/* Logo + collapse toggle */}
        <div className="sidebar-logo-row">
          {!collapsed && <h1 className="logo-text">Metrolist</h1>}
          <button
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
          </button>
        </div>

        {/* Primary nav */}
        <ul className="nav-links">
          {navItems.map(item => (
            <li
              key={item.id}
              className={activeTab === item.id ? 'active' : ''}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </li>
          ))}
        </ul>

        <div className="sidebar-divider" />

        {/* Secondary nav */}
        <ul className="nav-links nav-secondary">
          {secondaryItems.map(item => (
            <li
              key={item.id}
              className={activeTab === item.id ? 'active' : ''}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && (
                <span className="nav-item-label">
                  {item.label}
                  {item.badge && (
                    <span className="sidebar-liked-count">{item.badge}</span>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Create Playlist */}
        <div className="sidebar-divider" />
        <div className="sidebar-actions">
          <div
            className="action-item"
            onClick={() => setIsModalOpen(true)}
            title={collapsed ? 'Create Playlist' : undefined}
          >
            <div className="icon-box create-playlist"><FiPlusSquare size={18} /></div>
            {!collapsed && <span>Create Playlist</span>}
          </div>
        </div>

        {/* Playlists scroll */}
        {!collapsed && (
          <div className="playlists-scroll">
            <p className="sidebar-section-label">MY PLAYLISTS</p>
            {customPlaylists && customPlaylists.length > 0 ? (
              <ul style={{ marginBottom: 12 }}>
                {customPlaylists.map(pl => {
                  const isSelected = activeTab === 'custom-playlist' && selectedMedia?.id === pl.id;
                  return (
                    <li
                      key={pl.id}
                      className={`sidebar-song-item${isSelected ? ' sidebar-song-active' : ''}`}
                      onClick={() => onOpenDetails({ id: pl.id, type: 'custom-playlist', title: pl.name })}
                    >
                      <div className="sidebar-song-thumb" style={{
                        background: isSelected ? 'rgba(0,210,255,0.2)' : '#333',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <FiList size={12} color={isSelected ? '#00d2ff' : '#aaa'} />
                      </div>
                      <span className="sidebar-song-name" style={{
                        color: isSelected ? '#00d2ff' : undefined,
                        fontWeight: isSelected ? '700' : 'normal'
                      }}>
                        {pl.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {likedSongs.length === 0 && customPlaylists.length === 0 ? (
              <p className="sidebar-empty-hint">Like songs or create playlists to see them here</p>
            ) : (
              <ul>
                {likedSongs.slice(0, 20).map(song => {
                  const isActive = currentTrack?.videoId === song.id;
                  return (
                    <li
                      key={song.id}
                      className={`sidebar-song-item${isActive ? ' sidebar-song-active' : ''}`}
                      onClick={() => playTrack({ videoId: song.id, title: song.title, thumbnail: song.thumbnailUrl, artist: song.artist || '' }, false)}
                      title={song.title}
                    >
                      <div className="sidebar-song-thumb">
                        {song.thumbnailUrl
                          ? <img src={song.thumbnailUrl} alt={song.title} onError={e => e.target.style.display = 'none'} />
                          : <FiMusic size={12} />
                        }
                        {isActive && <div className="sidebar-song-active-dot" />}
                      </div>
                      <span className="sidebar-song-name">{song.title}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User profile + version */}
        <div className="sidebar-footer">
          <div
            className="sidebar-user"
            onClick={onEditName}
            title={`Logged in as ${userName}. Click to edit.`}
          >
            <div className="sidebar-avatar" style={{ padding: 0, overflow: 'hidden' }}>
              <img 
                src={`https://api.dicebear.com/9.x/bottts/svg?seed=${userAvatar}`} 
                alt="Avatar" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{userName}</span>
                <span className="sidebar-user-sub">Your Account</span>
              </div>
            )}
          </div>
          {!collapsed && (
            <p className="sidebar-version">v{APP_VERSION}</p>
          )}
        </div>
      </nav>

      <CreatePlaylistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateSubmit}
        defaultName={`My Playlist #${customPlaylists.length + 1}`}
      />
    </>
  );
};

export default Sidebar;
