import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import MediaCard from './MediaCard';

const CarouselSection = ({ title, items = [], onOpenDetails, cardSize = 'normal' }) => {
  const scrollRef = React.useRef(null);

  if (!items || items.length === 0) return null;

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const amount = cardSize === 'large' ? 600 : 480;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="home-section">
      <div className="home-section-header">
        <h3 className="section-title">{title}</h3>
        <div className="carousel-controls">
          <button className="carousel-arrow" onClick={() => scroll('left')} aria-label="Scroll left">
            <FiChevronLeft size={20} />
          </button>
          <button className="carousel-arrow" onClick={() => scroll('right')} aria-label="Scroll right">
            <FiChevronRight size={20} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`carousel-scroll${cardSize === 'large' ? ' carousel-large' : ''}`}
      >
        {items.map((item, idx) => (
          <div
            key={item.id + idx}
            className={`carousel-card-wrap${cardSize === 'large' ? ' carousel-card-large' : ''}`}
          >
            <MediaCard item={item} onOpenDetails={onOpenDetails} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CarouselSection;
