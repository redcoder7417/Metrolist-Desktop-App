import React, { useState, useEffect } from 'react';
import { getRecentlyPlayed } from '../services/historyService';
import { getRandomCubeCards } from '../services/cubeCardsLogic';
import { useLibrary } from '../context/LibraryContext';
import SingleCubeCard from './SingleCubeCard';

const CubeCardsRow = ({ onOpenDetails }) => {
  const { likedSongs } = useLibrary();
  const [cards, setCards] = useState([]);

  const refreshCards = () => {
    const history = getRecentlyPlayed();
    const generated = getRandomCubeCards(history, likedSongs);
    setCards(generated);
  };

  useEffect(() => {
    refreshCards();

    const handleUpdate = () => {
      refreshCards();
    };

    window.addEventListener('recentlyPlayedUpdated', handleUpdate);
    return () => window.removeEventListener('recentlyPlayedUpdated', handleUpdate);
  }, [likedSongs]);

  return (
    <div className="cube-cards-row">
      {cards.map((card, index) => (
        <SingleCubeCard
          key={`${card.cardName}-${index}`}
          card={card}
          onOpenDetails={onOpenDetails}
        />
      ))}
    </div>
  );
};

export default CubeCardsRow;
