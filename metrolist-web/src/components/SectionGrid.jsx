import React from 'react';
import MediaCard from './MediaCard';

const SectionGrid = ({ title, items = [], onOpenDetails, showSeeAll = true, onSeeAll }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="home-section">
      <div className="home-section-header">
        <h3 className="section-title">{title}</h3>
        {showSeeAll && items.length > 5 && (
          <button className="see-all-btn" onClick={onSeeAll}>See all →</button>
        )}
      </div>
      <div className="section-grid-layout">
        {items.map((item, idx) => (
          <MediaCard key={item.id + idx} item={item} onOpenDetails={onOpenDetails} />
        ))}
      </div>
    </div>
  );
};

export default SectionGrid;
