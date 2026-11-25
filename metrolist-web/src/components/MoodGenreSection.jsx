import React from 'react';

const GENRES = [
  { label: 'Pop',        gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', query: 'pop' },
  { label: 'Rock',       gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)', query: 'rock' },
  { label: 'Hip-Hop',   gradient: 'linear-gradient(135deg,#43e97b,#38f9d7)', query: 'hip hop' },
  { label: 'EDM',        gradient: 'linear-gradient(135deg,#fa709a,#fee140)', query: 'edm' },
  { label: 'Jazz',       gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', query: 'jazz' },
  { label: 'Bollywood',  gradient: 'linear-gradient(135deg,#ff9a9e,#fad0c4)', query: 'bollywood' },
  { label: 'Punjabi',    gradient: 'linear-gradient(135deg,#fddb92,#d1fdff)', query: 'punjabi' },
  { label: 'Lo-Fi',      gradient: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)', query: 'lofi' },
  { label: 'Classical',  gradient: 'linear-gradient(135deg,#d4fc79,#96e6a1)', query: 'classical' },
  { label: 'K-Pop',      gradient: 'linear-gradient(135deg,#f6d365,#fda085)', query: 'kpop' },
  { label: 'R&B',        gradient: 'linear-gradient(135deg,#89f7fe,#66a6ff)', query: 'r&b' },
  { label: 'Metal',      gradient: 'linear-gradient(135deg,#868f96,#596164)', query: 'metal' },
  { label: 'Indie',      gradient: 'linear-gradient(135deg,#e0c3fc,#8ec5fc)', query: 'indie' },
  { label: 'Country',    gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', query: 'country' },
  { label: 'Soul',       gradient: 'linear-gradient(135deg,#fc5c7d,#6a3093)', query: 'soul' },
];

const MoodGenreSection = ({ onNavigateSearch }) => {
  return (
    <div className="home-section">
      <div className="home-section-header">
        <h3 className="section-title">Mood &amp; Genres</h3>
      </div>
      <div className="genre-chips-grid">
        {GENRES.map((g) => (
          <button
            key={g.label}
            className="genre-chip"
            style={{ background: g.gradient }}
            onClick={() => onNavigateSearch && onNavigateSearch(g.query)}
            aria-label={`Browse ${g.label}`}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MoodGenreSection;
