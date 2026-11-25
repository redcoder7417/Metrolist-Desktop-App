import React, { useState, useEffect, useContext, useRef } from 'react';
import { fetchSearch } from '../services/api';
import { PlayerContext } from '../context/PlayerContext';
import { ToastContext } from '../context/ToastContext';
import AddToPlaylistMenu from './AddToPlaylistMenu';
import MediaCard from './MediaCard';
import { FiSearch, FiPlay, FiPause, FiClock, FiMusic, FiList, FiHeart, FiDownload, FiCheck } from 'react-icons/fi';
import { useLibrary } from '../context/LibraryContext';
import { addDownload, isDownloaded } from '../services/downloadsService';

const SEARCH_FILTERS = [
  { id: 'songs', label: 'Songs' },
  { id: 'videos', label: 'Videos' },
  { id: 'albums', label: 'Albums' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'artists', label: 'Artists' },
];

const formatDuration = (seconds) => {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const Thumb = ({ src, alt, size = 48 }) => {
  const [failed, setFailed] = useState(false);
  return failed || !src ? (
    <div className="thumb-placeholder" style={{ width: size, height: size }}><FiMusic size={size * 0.37} /></div>
  ) : (
    <img
      src={src}
      alt={alt}
      className="track-thumb"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
};

const SearchView = ({ onOpenDetails, initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState('songs');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [, forceUpdate] = useState(0);
  const inputRef = useRef(null);

  const { playTrack, playQueue, addToQueue, currentTrack, isPlaying } = useContext(PlayerContext);
  const { isLiked, toggleLike } = useLibrary();
  const { addToast } = useContext(ToastContext);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== query) {
      setQuery(initialQuery);
      setDebouncedQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 380);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    const perform = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchSearch(debouncedQuery, activeFilter);
        if (!cancelled) setResults(data || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    perform();
    return () => { cancelled = true; };
  }, [debouncedQuery, activeFilter]);

  const isPlayableFilter = activeFilter === 'songs' || activeFilter === 'videos';

  const toTrack = (s) => ({
    videoId: s.id,
    title: s.title,
    artist: s.artist || s.subtitle || '',
    thumbnail: s.thumbnailUrl || s.thumbnail || s.cover || '',
    duration: s.duration || 0,
  });

  const handlePlayAll = () => {
    if (results.length === 0) return;
    playQueue(results.map(toTrack));
  };

  const handleAddAllToQueue = () => {
    if (results.length === 0) return;
    results.forEach(s => addToQueue(toTrack(s)));
    if (addToast) addToast(`Added ${results.length} songs to Queue`, 'info');
  };

  return (
    <div className="search-view">
      {/* Big centered search bar + filter chips */}
      <div className="search-hero">
        <div className="search-bar-wrap">
          <FiSearch className="search-icon" size={22} />
          <input
            ref={inputRef}
            type="text"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input-large"
          />
          {query && (
            <button className="search-clear-btn" onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        <div className="search-filter-tabs">
          {SEARCH_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`search-filter-pill${activeFilter === f.id ? ' active' : ''}`}
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="search-results-area">
        {isLoading && (
          <div className="search-skeletons">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-thumb" />
                <div className="skeleton-lines">
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line skeleton-artist" />
                </div>
                <div className="skeleton-line skeleton-duration" />
              </div>
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="search-error">
            <span>⚠</span>
            <p>Search failed: {error}</p>
          </div>
        )}

        {!isLoading && !error && results.length === 0 && debouncedQuery && (
          <div className="search-empty">
            <FiSearch size={48} />
            <h3>No {activeFilter} for "{debouncedQuery}"</h3>
            <p>Try a different category tab or check your spelling</p>
          </div>
        )}

        {!debouncedQuery && (
          <div className="search-idle">
            <p className="search-idle-label">Browse by genre</p>
            <div className="search-idle-grid">
              {['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Jazz', 'Classical', 'R&B', 'Indie', 'Lo-fi', 'K-Pop', 'Metal', 'Bollywood'].map(genre => (
                <div key={genre} className="genre-chip" onClick={() => setQuery(genre)}>
                  {genre}
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <>
            {isPlayableFilter ? (
              <div className="search-section">
                <div className="search-section-header">
                  <h2>{activeFilter === 'videos' ? 'Videos' : 'Songs'}</h2>
                  {results.length > 1 && (
                    <div className="search-header-actions">
                      <button className="search-play-all" onClick={handlePlayAll}>
                        <FiPlay size={13} /> Play all
                      </button>
                      <button className="search-queue-all" onClick={handleAddAllToQueue} title="Add all to queue">
                        <FiList size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="search-track-list">
                  <div className="search-track-header">
                    <span className="stl-num">#</span>
                    <span className="stl-title">Title</span>
                    <span className="stl-actions-head">Actions</span>
                    <span className="stl-duration"><FiClock size={14} /></span>
                  </div>
                  {results.map((track, i) => {
                    const trackData = toTrack(track);
                    const isActive = currentTrack?.videoId === trackData.videoId;
                    const liked = isLiked(trackData.videoId);
                    const saved = isDownloaded(track.id);

                    const handleSave = (e) => {
                      e.stopPropagation();
                      if (saved) return;
                      addDownload(trackData);
                      addToast(`Saved: ${track.title}`, 'info');
                      forceUpdate(n => n + 1);
                    };

                    return (
                      <div
                        key={track.id + i}
                        className={`search-track-row${isActive ? ' stl-active' : ''}`}
                        onClick={() => playTrack(trackData)}
                      >
                        <div className="stl-num">
                          {isActive && isPlaying ? (
                            <div className="mini-bars"><span /><span /><span /></div>
                          ) : (
                            <>
                              <span className="stl-index">{i + 1}</span>
                              <span className="stl-play-btn">
                                {isActive && !isPlaying ? <FiPause size={15} /> : <FiPlay size={15} />}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="stl-title">
                          <div className="stl-thumb-wrap">
                            <Thumb src={trackData.thumbnail} alt={trackData.title} />
                            <div className="stl-thumb-overlay">
                              {isActive && isPlaying ? <FiPause size={16} /> : <FiPlay size={16} />}
                            </div>
                          </div>
                          <div className="stl-info">
                            <span className="stl-name">{trackData.title}</span>
                            <span className="stl-artist">
                              {trackData.artist}{track.album ? ` · ${track.album}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="stl-actions" onClick={(e) => e.stopPropagation()}>
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
                          <AddToPlaylistMenu track={trackData} />
                        </div>

                        <span className="stl-duration">{formatDuration(track.duration)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="search-section">
                <div className="search-section-header">
                  <h2>{SEARCH_FILTERS.find(f => f.id === activeFilter)?.label}</h2>
                </div>
                <div className="section-grid-layout">
                  {results.map((item, i) => (
                    <MediaCard
                      key={item.id + i}
                      item={{
                        id: item.id,
                        title: item.title,
                        subtitle: item.subtitle || item.artist || '',
                        cover: item.thumbnailUrl,
                        type: item.type,
                      }}
                      onOpenDetails={onOpenDetails}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchView;
