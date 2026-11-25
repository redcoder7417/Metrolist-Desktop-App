import React, { useState, useContext, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import BottomPlayer from './components/BottomPlayer';
import HomeView from './components/HomeView';
import SearchView from './components/SearchView';
import LibraryView from './components/LibraryView';
import PlaylistView from './components/PlaylistView';
import UserNameModal from './components/UserNameModal';
import RightSidebar from './components/RightSidebar';
import DownloadsView from './components/DownloadsView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import ArtistView from './components/ArtistView';
import FullscreenPlayer from './components/FullscreenPlayer';
import EqualizerModal from './components/EqualizerModal';
import { PlayerContext } from './context/PlayerContext';
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { getSettings } from './services/settingsService';

function AppContent() {
  const [navHistory, setNavHistory] = useState([{ tab: 'home', media: null }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [topbarSearchFocused, setTopbarSearchFocused] = useState(false);

  // User Name Onboarding & Storage
  const [userName, setUserName] = useState(() =>
    localStorage.getItem('metrolist_username') || 'Listener'
  );
  const [userAvatar, setUserAvatar] = useState(() =>
    localStorage.getItem('metrolist_useravatar') || 'Felix'
  );
  const [isNameModalOpen, setIsNameModalOpen] = useState(() =>
    !localStorage.getItem('metrolist_username') && !localStorage.getItem('metrolist_user_name')
  );

  const handleSaveUserName = (name, avatar) => {
    setUserName(name);
    if (avatar) setUserAvatar(avatar);
    localStorage.setItem('metrolist_username', name);
    if (avatar) localStorage.setItem('metrolist_useravatar', avatar);
    setIsNameModalOpen(false);
  };

  const activeTab = navHistory[historyIndex]?.tab || 'home';
  const selectedMedia = navHistory[historyIndex]?.media || null;

  const navigateTo = (tab, media = null) => {
    if (activeTab === tab && selectedMedia?.id === media?.id) return;
    const nextHistory = navHistory.slice(0, historyIndex + 1);
    nextHistory.push({ tab, media });
    setNavHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleSetActiveTab = (tab) => navigateTo(tab, null);

  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);

  const handleOpenDetails = (item) => {
    const tab = item.type === 'album'
      ? 'album'
      : item.type === 'artist'
        ? 'artist'
        : item.type === 'custom-playlist'
          ? 'custom-playlist'
          : 'playlist';
    navigateTo(tab, item);
  };

  const handleNavigateSearch = (query) => {
    setSearchQuery(query);
    navigateTo('search', null);
  };

  const goBack    = () => { if (historyIndex > 0) setHistoryIndex(p => p - 1); };
  const goForward = () => { if (historyIndex < navHistory.length - 1) setHistoryIndex(p => p + 1); };
  
  const handleRefresh = () => {
    if (activeTab === 'home') {
      window.dispatchEvent(new CustomEvent('appRefresh'));
    }
  };

  const { togglePlay, playNext, playPrev, seek, progress, duration, changeVolume, volume } = useContext(PlayerContext);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault(); togglePlay(); break;
        case 'ArrowRight':
          if (e.altKey)   { e.preventDefault(); playNext(); }
          else if (e.shiftKey) { e.preventDefault(); seek(Math.min(duration, progress + 10)); }
          break;
        case 'ArrowLeft':
          if (e.altKey)   { e.preventDefault(); playPrev(); }
          else if (e.shiftKey) { e.preventDefault(); seek(Math.max(0, progress - 10)); }
          break;
        case 'ArrowUp':
          e.preventDefault(); changeVolume(Math.min(1, volume + 0.1)); break;
        case 'ArrowDown':
          e.preventDefault(); changeVolume(Math.max(0, volume - 0.1)); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, playNext, playPrev, seek, progress, duration, changeVolume, volume]);

  const getHeaderTitle = () => {
    if (activeTab === 'home')      return 'Home';
    if (activeTab === 'search')    return 'Search';
    if (activeTab === 'library')   return 'Your Library';
    if (activeTab === 'liked')     return 'Liked Songs';
    if (activeTab === 'downloads') return 'Saved Songs';
    if (activeTab === 'history')   return 'History';
    if (activeTab === 'settings')  return 'Settings';
    if (activeTab === 'playlists') return 'Playlists';
    if (selectedMedia?.title)      return selectedMedia.title;
    if (activeTab === 'album')     return 'Album';
    return 'Playlist';
  };

  const canGoBack    = historyIndex > 0;
  const canGoForward = historyIndex < navHistory.length - 1;

  return (
    <div
      className="app-container"
      style={{
        '--sidebar-collapsed-width': sidebarCollapsed ? '68px' : '260px',
        '--right-sidebar-width': rightSidebarOpen ? '300px' : '0px',
      }}
    >
      <UserNameModal
        isOpen={isNameModalOpen}
        initialName={userName !== 'Listener' ? userName : ''}
        initialAvatar={userAvatar}
        onSave={handleSaveUserName}
        onClose={userName !== 'Listener' ? () => setIsNameModalOpen(false) : undefined}
      />

      <div className="main-wrapper">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          onOpenDetails={handleOpenDetails}
          selectedMedia={selectedMedia}
          userName={userName}
          userAvatar={userAvatar}
          onEditName={() => setIsNameModalOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        />

        {/* Center content */}
        <main className="main-content">
          <header className="topbar">
            {/* Nav arrows + refresh */}
            <div className="topbar-nav">
              <button
                className={`topbar-nav-btn${!canGoBack ? ' disabled' : ''}`}
                onClick={goBack}
                disabled={!canGoBack}
                title="Go back"
              >
                <FiChevronLeft size={19} />
              </button>
              <button
                className={`topbar-nav-btn${!canGoForward ? ' disabled' : ''}`}
                onClick={goForward}
                disabled={!canGoForward}
                title="Go forward"
              >
                <FiChevronRight size={19} />
              </button>
              <button
                className="topbar-nav-btn"
                onClick={handleRefresh}
                title="Refresh"
              >
                <FiRefreshCw size={17} />
              </button>
            </div>

            {/* Center search bar */}
            <div className={`topbar-search-wrap${topbarSearchFocused ? ' focused' : ''}`}>
              <FiSearch size={16} className="topbar-search-icon" />
              <input
                className="topbar-search"
                type="text"
                placeholder="Search songs, playlists, albums..."
                value={activeTab === 'search' ? searchQuery : ''}
                onFocus={() => {
                  setTopbarSearchFocused(true);
                  if (activeTab !== 'search') navigateTo('search', null);
                }}
                onBlur={() => setTopbarSearchFocused(false)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Right: keyboard hints + avatar */}
            <div className="topbar-right">
              <div className="keyboard-hint">
                <kbd>Space</kbd> Play · <kbd>Alt+→</kbd> Next · <kbd>Shift+→</kbd> +10s
              </div>
              <div
                className="user-avatar"
                title={`Logged in as ${userName}. Click to edit name.`}
                onClick={() => setIsNameModalOpen(true)}
              >
                <img 
                  src={`https://api.dicebear.com/9.x/bottts/svg?seed=${userAvatar}`} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%' }} 
                />
              </div>
            </div>
          </header>

          <div className="content-area">
            {activeTab === 'home' && (
              <HomeView
                onOpenDetails={handleOpenDetails}
                userName={userName}
                onNavigateSearch={handleNavigateSearch}
                onNavigateTab={handleSetActiveTab}
              />
            )}
            {activeTab === 'search' && (
              <SearchView
                onOpenDetails={handleOpenDetails}
                initialQuery={searchQuery}
              />
            )}
            {(activeTab === 'library' || activeTab === 'liked' || activeTab === 'playlists') && (
              <LibraryView activeTab={activeTab} />
            )}
            {(activeTab === 'playlist' || activeTab === 'album' || activeTab === 'custom-playlist') && (
              <PlaylistView media={selectedMedia} />
            )}
            {activeTab === 'artist' && (
              <ArtistView
                artistId={selectedMedia?.id}
                fallbackMedia={selectedMedia}
                onOpenDetails={handleOpenDetails}
              />
            )}
            {activeTab === 'downloads' && <DownloadsView />}
            {activeTab === 'history'   && <HistoryView />}
            {activeTab === 'settings'  && <SettingsView />}
          </div>
        </main>

        {/* Right Sidebar */}
        <RightSidebar isOpen={rightSidebarOpen} onOpenFullscreen={() => setFullscreenOpen(true)} />
      </div>

      <BottomPlayer
        onToggleRightSidebar={() => setRightSidebarOpen(v => !v)}
        rightSidebarOpen={rightSidebarOpen}
        onOpenFullscreen={() => setFullscreenOpen(true)}
        onOpenEq={() => setEqOpen(true)}
      />

      <FullscreenPlayer
        isOpen={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        onOpenEq={() => setEqOpen(true)}
      />

      <EqualizerModal
        isOpen={eqOpen}
        onClose={() => setEqOpen(false)}
      />
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
