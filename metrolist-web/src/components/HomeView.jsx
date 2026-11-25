import React, { useEffect, useState } from 'react';
import { fetchHome } from '../services/api';
import HeroSection from './HeroSection';
import QuickPicksSection from './QuickPicksSection';
import SpeedDialSection from './SpeedDialSection';
import CarouselSection from './CarouselSection';
import MoodGenreSection from './MoodGenreSection';
import SectionGrid from './SectionGrid';

const getTimeContext = () => {
  const hour = new Date().getHours();
  if (hour < 12) return {
    greeting: 'Good Morning',
    emoji: '☀️',
    notes: [
      'Ready to conquer the day with your favorite tunes?',
      'Start your morning with fresh rhythm & energy!',
      'Fuel your morning motivation with deep beats.',
    ],
  };
  if (hour < 18) return {
    greeting: 'Good Afternoon',
    emoji: '🌤️',
    notes: [
      'Keep the energy high with your custom beats!',
      'Time for an afternoon musical stretch & refresh.',
      'Let the rhythm power you through your afternoon.',
    ],
  };
  return {
    greeting: 'Good Evening',
    emoji: '✨',
    notes: [
      'Unwind and relax with your personalized night mix.',
      'Let the evening melody guide your thoughts.',
      'Soothe your evening with warm acoustic vibrations.',
    ],
  };
};

const classifySection = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('quick') || t.includes('pick') || t.includes('top song') || t.includes('trending song')) return 'quick-picks';
  if (t.includes('continue') || t.includes('recent') || t.includes('listen')) return 'continue-listening';
  if (t.includes('trend')) return 'trending';
  if (t.includes('recommend') || t.includes('for you') || t.includes('discover')) return 'recommended';
  if (t.includes('new') || t.includes('added') || t.includes('latest') || t.includes('release')) return 'recently-added';
  return 'grid';
};

const HomeView = ({ onOpenDetails, userName = 'Listener', onNavigateSearch, onNavigateTab }) => {
  const [sections, setSections] = useState([]);
  const [chips, setChips] = useState([]);
  const [activeChip, setActiveChip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeData] = useState(() => getTimeContext());
  const [randomNote] = useState(() => {
    const td = getTimeContext();
    return td.notes[Math.floor(Math.random() * td.notes.length)];
  });

  const loadHome = async (params = activeChip) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchHome(params);
      setSections(data.sections || []);
      if (!params && data.chips && data.chips.length > 0) {
        setChips(data.chips);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHome(null);
    const handleRefresh = () => loadHome(activeChip);
    window.addEventListener('appRefresh', handleRefresh);
    return () => window.removeEventListener('appRefresh', handleRefresh);
  }, []);

  const handleChipClick = (chipParams) => {
    const next = activeChip === chipParams ? null : chipParams;
    setActiveChip(next);
    loadHome(next);
  };

  if (isLoading) {
    return (
      <div className="home-view">
        <div className="home-greeting-group home-greeting-skeleton">
          <div className="skeleton-title" style={{ width: 280, height: 38, marginBottom: 8 }} />
          <div className="skeleton-line" style={{ width: 340, height: 16 }} />
        </div>
        <div className="speed-dial-grid">
          {[...Array(6)].map((_, i) => <div key={i} className="speed-dial-skeleton" />)}
        </div>
        <div className="home-section">
          <div className="skeleton-title" style={{ width: 180, height: 26, marginBottom: 20 }} />
          <div className="section-grid-layout">
            {[...Array(5)].map((_, i) => <div key={i} className="media-card-skeleton" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>Error loading content: {error}</p>
        <button className="splash-retry-btn" style={{ marginTop: 16 }} onClick={() => loadHome(activeChip)}>
          Retry
        </button>
      </div>
    );
  }

  const classified = {};
  sections.forEach(sec => {
    const role = classifySection(sec.title);
    if (!classified[role]) classified[role] = sec;
    else if (!classified[`${role}-2`]) classified[`${role}-2`] = sec;
    else classified[`${role}-3`] = sec;
  });

  const heroItem = sections[0]?.items?.[0] || null;
  const quickPicksItems  = classified['quick-picks']?.items         || sections[0]?.items || [];
  const continueItems    = classified['continue-listening']?.items  || sections[1]?.items || [];
  const trendingItems    = classified['trending']?.items            || sections[2]?.items || [];
  const recommendedItems = classified['recommended']?.items         || sections[3]?.items || [];
  const recentItems      = classified['recently-added']?.items      || sections[4]?.items || [];
  const latestItems      = classified['grid']?.items                || sections[5]?.items || [];
  const extraSections    = sections.slice(6);

  return (
    <div className="home-view">

      {/* ── Greeting + Dynamic YouTube Music Chips ── */}
      <div className="home-greeting-group">
        <h1 className="home-greeting">
          {timeData.greeting},{' '}
          <span className="user-name-highlight">{userName}</span>{' '}
          {timeData.emoji}
        </h1>
        {randomNote && <p className="home-random-note">{randomNote}</p>}

        {chips.length > 0 && (
          <div className="home-filter-chips">
            <button
              className={`home-chip${activeChip === null ? ' active' : ''}`}
              onClick={() => handleChipClick(null)}
            >
              All
            </button>
            {chips.map((c) => (
              <button
                key={c.title}
                className={`home-chip${activeChip === c.params ? ' active' : ''}`}
                onClick={() => handleChipClick(c.params)}
              >
                {c.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Speed Dial (shortcuts) ── */}
      <SpeedDialSection
        onOpenDetails={onOpenDetails}
        onNavigateSearch={onNavigateSearch}
        onNavigateTab={onNavigateTab}
      />

      {/* ── Hero Banner ── */}
      {heroItem && <HeroSection item={heroItem} onOpenDetails={onOpenDetails} />}

      {/* ── Quick Picks ── */}
      {quickPicksItems.length > 0 && (
        <QuickPicksSection
          items={quickPicksItems}
          onOpenDetails={onOpenDetails}
          onNavigateSearch={onNavigateSearch}
        />
      )}

      {/* ── Continue Listening carousel ── */}
      {continueItems.length > 0 && (
        <CarouselSection
          title={classified['continue-listening']?.title || 'Continue Listening'}
          items={continueItems}
          onOpenDetails={onOpenDetails}
          cardSize="large"
        />
      )}

      {/* ── Mood & Genres ── */}
      <MoodGenreSection onNavigateSearch={onNavigateSearch} />

      {/* ── Latest Playlists grid ── */}
      {latestItems.length > 0 && (
        <SectionGrid
          title={classified['grid']?.title || 'Latest Playlists'}
          items={latestItems}
          onOpenDetails={onOpenDetails}
        />
      )}

      {/* ── Trending carousel ── */}
      {trendingItems.length > 0 && (
        <CarouselSection
          title={classified['trending']?.title || 'Trending'}
          items={trendingItems}
          onOpenDetails={onOpenDetails}
        />
      )}

      {/* ── Recommended For You ── */}
      {recommendedItems.length > 0 && (
        <SectionGrid
          title={classified['recommended']?.title || 'Recommended For You'}
          items={recommendedItems}
          onOpenDetails={onOpenDetails}
        />
      )}

      {/* ── Recently Added ── */}
      {recentItems.length > 0 && (
        <SectionGrid
          title={classified['recently-added']?.title || 'Recently Added'}
          items={recentItems}
          onOpenDetails={onOpenDetails}
        />
      )}

      {/* ── Extra sections ── */}
      {extraSections.map((sec, idx) => (
        <SectionGrid
          key={idx}
          title={sec.title}
          items={sec.items || []}
          onOpenDetails={onOpenDetails}
        />
      ))}

    </div>
  );
};

export default HomeView;
