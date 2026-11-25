import React, { useRef } from 'react';
import MediaCard from './MediaCard';

const CardCarousel = ({ items = [], onOpenDetails }) => {
  const scrollRef = useRef(null);

  if (!items || items.length === 0) return null;

  return (
    <div className="card-carousel-wrapper">
      <div className="card-carousel" ref={scrollRef}>
        {items.map((item, index) => (
          <MediaCard key={item.id + index} item={item} onOpenDetails={onOpenDetails} />
        ))}
      </div>
    </div>
  );
};

export default CardCarousel;
