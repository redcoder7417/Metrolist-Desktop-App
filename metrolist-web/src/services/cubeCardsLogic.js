// Dynamic Speed Dial Cards Categories & Randomizer Logic (using real YouTube Music search queries or user history)

export const CUBE_CATEGORIES = [
  {
    name: 'Bollywood Hits',
    iconName: 'trending',
    gradient: 'linear-gradient(135deg, #ff007f, #7928ca)',
    query: 'Bollywood Top Hits',
    subtitle: 'Trending Hindi mixes'
  },
  {
    name: 'Lo-Fi Chill',
    iconName: 'radio',
    gradient: 'linear-gradient(135deg, #00d2ff, #0077b6)',
    query: 'Lofi hip hop beats chill',
    subtitle: 'Focus & study vibes'
  },
  {
    name: 'Monsoon Rain',
    iconName: 'rain',
    gradient: 'linear-gradient(135deg, #10b981, #00d2ff)',
    query: 'Monsoon Acoustic Indie Hindi',
    subtitle: 'Acoustic rain sessions'
  },
  {
    name: 'Deep Focus',
    iconName: 'disc',
    gradient: 'linear-gradient(135deg, #f5576c, #f093fb)',
    query: 'Instrumental Piano Focus',
    subtitle: 'Pure instrumental flow'
  },
  {
    name: 'Party Energy',
    iconName: 'zap',
    gradient: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
    query: 'Electronic Dance Workout Hits',
    subtitle: 'High-tempo energy'
  },
  {
    name: 'Late Night',
    iconName: 'sun',
    gradient: 'linear-gradient(135deg, #833ab4, #fd1d1d)',
    query: 'Late Night R&B Soul',
    subtitle: 'Smooth midnight grooves'
  }
];

export const getRandomCubeCards = (history = [], likedSongs = []) => {
  const likedTrack = likedSongs[0]
    ? {
        videoId: likedSongs[0].videoId || likedSongs[0].id,
        title: likedSongs[0].title,
        artist: likedSongs[0].artist || 'Liked Songs',
        thumbnail: likedSongs[0].thumbnailUrl || likedSongs[0].thumbnail || '',
      }
    : null;

  const card1 = {
    cardName: 'Liked Songs',
    songTitle: likedTrack ? likedTrack.title : 'Browse Favorites',
    track: likedTrack,
    actionTab: likedTrack ? null : 'liked',
    iconType: 'heart',
    gradient: 'linear-gradient(135deg, #450af5, #00d2ff)'
  };

  const recentTrack = history[0]
    ? {
        videoId: history[0].videoId || history[0].id,
        title: history[0].title,
        artist: history[0].artist || '',
        thumbnail: history[0].thumbnail || '',
      }
    : null;

  const card2 = {
    cardName: 'Last Played',
    songTitle: recentTrack ? recentTrack.title : 'Discover New Music',
    track: recentTrack,
    searchQuery: recentTrack ? null : 'Top Global Songs',
    iconType: 'trending',
    gradient: 'linear-gradient(135deg, #ff007f, #7928ca)'
  };

  const remainingCats = [...CUBE_CATEGORIES].sort(() => 0.5 - Math.random()).slice(0, 4);

  const dynamicCards = remainingCats.map(cat => ({
    cardName: cat.name,
    songTitle: cat.subtitle,
    searchQuery: cat.query,
    iconType: cat.iconName,
    gradient: cat.gradient
  }));

  return [card1, card2, ...dynamicCards];
};
