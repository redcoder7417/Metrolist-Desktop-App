import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import { fetchRelated } from '../services/api';
import { addRecentlyPlayed } from '../services/historyService';
import { getSettings, saveSetting } from '../services/settingsService';

const getApiBase = () => (window.location.port === '5173' ? '/api' : 'http://localhost:8091/api');

export const EQ_BANDS = [
  { freq: 32, label: '32' },
  { freq: 64, label: '64' },
  { freq: 125, label: '125' },
  { freq: 250, label: '250' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1K' },
  { freq: 2000, label: '2K' },
  { freq: 4000, label: '4K' },
  { freq: 8000, label: '8K' },
  { freq: 16000, label: '16K' },
];

export const EQ_PRESETS = {
  'Flat':        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost':  [7, 6, 5, 3, 1, 0, 0, 0, 1, 2],
  'Pop':         [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  'Rock':        [4, 3, 2, 0, -1, 0, 2, 3, 4, 4],
  'Electronic':  [5, 4, 2, 0, -2, 1, 2, 3, 4, 5],
  'Jazz':        [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  'Classical':   [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  'Vocal':       [-2, -2, -1, 1, 4, 5, 4, 2, 0, -1],
  'Late Night':  [3, 2, 1, 0, -1, -1, 0, 1, 0, -2],
};

export const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [streamInfo, setStreamInfo] = useState(null);

  // Queue state
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  // Modes
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'

  // EQ & Playback Speed
  const initialSettings = getSettings();
  const [eqEnabled, setEqEnabled] = useState(initialSettings.eqEnabled);
  const [eqPreset, setEqPreset] = useState(initialSettings.eqPreset);
  const [eqGains, setEqGains] = useState(initialSettings.eqGains || EQ_PRESETS.Flat);
  const [playbackRate, setPlaybackRate] = useState(initialSettings.playbackRate || 1.0);

  // Sleep Timer
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState(null); // number | 'end_of_track' | null

  const audioRef = useRef(null);
  if (!audioRef.current) {
    const a = new Audio();
    a.crossOrigin = 'anonymous';
    a.preload = 'auto';
    audioRef.current = a;
  }

  // Web Audio graph refs
  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const filtersRef = useRef([]);
  const analyserRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const playRequestIdRef = useRef(0);

  const stateRefs = useRef({ queue, queueIndex, isShuffle, repeatMode, sleepTimerSeconds, volume });
  useEffect(() => {
    stateRefs.current = { queue, queueIndex, isShuffle, repeatMode, sleepTimerSeconds, volume };
  }, [queue, queueIndex, isShuffle, repeatMode, sleepTimerSeconds, volume]);

  // ─── Initialize Web Audio API Graph (10-band EQ + Analyser) ─────────────────
  const ensureAudioGraph = useCallback(() => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaElementSource(audioRef.current);

      const filters = EQ_BANDS.map((band, idx) => {
        const filter = ctx.createBiquadFilter();
        filter.type = idx === 0 ? 'lowshelf' : idx === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1.4;
        filter.gain.value = eqEnabled ? (eqGains[idx] || 0) : 0;
        return filter;
      });

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;

      let prevNode = source;
      filters.forEach((f) => {
        prevNode.connect(f);
        prevNode = f;
      });
      prevNode.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      sourceNodeRef.current = source;
      filtersRef.current = filters;
      analyserRef.current = analyser;
    } catch (err) {
      console.warn('[PlayerContext] Web Audio graph fallback:', err.message);
    }
  }, [eqEnabled, eqGains]);

  // Sync EQ filter gains live
  useEffect(() => {
    if (filtersRef.current.length === EQ_BANDS.length) {
      filtersRef.current.forEach((filter, idx) => {
        filter.gain.value = eqEnabled ? (eqGains[idx] || 0) : 0;
      });
    }
  }, [eqEnabled, eqGains]);

  const toggleEq = () => {
    const next = !eqEnabled;
    setEqEnabled(next);
    saveSetting('eqEnabled', next);
  };

  const applyEqPreset = (presetName) => {
    const gains = EQ_PRESETS[presetName] || EQ_PRESETS.Flat;
    setEqPreset(presetName);
    setEqGains([...gains]);
    if (!eqEnabled && presetName !== 'Flat') {
      setEqEnabled(true);
      saveSetting('eqEnabled', true);
    }
    saveSetting('eqPreset', presetName);
    saveSetting('eqGains', gains);
  };

  const setEqBandGain = (index, val) => {
    setEqGains((prev) => {
      const next = [...prev];
      next[index] = val;
      saveSetting('eqGains', next);
      return next;
    });
    setEqPreset('Custom');
    saveSetting('eqPreset', 'Custom');
    if (!eqEnabled) {
      setEqEnabled(true);
      saveSetting('eqEnabled', true);
    }
  };

  const changePlaybackRate = (rate) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    saveSetting('playbackRate', rate);
  };

  // ─── Restore last activity ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedActivity = localStorage.getItem('metrolist_last_activity');
      if (savedActivity) {
        const data = JSON.parse(savedActivity);
        if (data.currentTrack) setCurrentTrack(data.currentTrack);
        if (data.queue && Array.isArray(data.queue)) setQueue(data.queue);
        if (typeof data.queueIndex === 'number') setQueueIndex(data.queueIndex);
        if (typeof data.progress === 'number') setProgress(data.progress);
        if (typeof data.volume === 'number') {
          setVolume(data.volume);
          audioRef.current.volume = data.volume;
        }
      }
      audioRef.current.playbackRate = initialSettings.playbackRate || 1.0;
    } catch (e) {
      console.warn('[PlayerContext] Failed to restore last activity:', e);
    }
  }, []);

  // ─── Persist last activity state ────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack && queue.length === 0) return;
    try {
      const activityData = {
        currentTrack,
        queue,
        queueIndex,
        progress,
        volume,
        timestamp: Date.now()
      };
      localStorage.setItem('metrolist_last_activity', JSON.stringify(activityData));
    } catch (e) {
      console.warn('[PlayerContext] Failed to save last activity:', e);
    }
  }, [currentTrack, queue, queueIndex, progress, volume]);

  // ─── Sleep Timer Countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof sleepTimerSeconds !== 'number') return;
    const interval = setInterval(() => {
      setSleepTimerSeconds((prev) => {
        if (typeof prev !== 'number') return prev;
        if (prev <= 1) {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsPlaying(false);
          window.dispatchEvent(new CustomEvent('appToast', { detail: { message: 'Sleep timer ended — playback paused', type: 'info' } }));
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerSeconds]);

  // ─── Volume Fade helper (Crossfade / Smooth Start) ───────────────────────────
  const fadeVolume = (targetVol, durationMs = 600) => {
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    const audio = audioRef.current;
    if (!audio) return;
    const startVol = audio.volume;
    const steps = 15;
    const stepTime = Math.max(20, Math.floor(durationMs / steps));
    let currentStep = 0;
    fadeTimerRef.current = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;
      audio.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * ratio));
      if (currentStep >= steps) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    }, stepTime);
  };

  // ─── Audio element events ───────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;

    const updateProgress = () => {
      setProgress(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setProgress(0);
      try {
        const saved = localStorage.getItem('metrolist_last_activity');
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.progress = 0;
          localStorage.setItem('metrolist_last_activity', JSON.stringify(parsed));
        }
      } catch {}

      if (stateRefs.current.sleepTimerSeconds === 'end_of_track') {
        setSleepTimerSeconds(null);
        setIsPlaying(false);
        window.dispatchEvent(new CustomEvent('appToast', { detail: { message: 'Sleep timer: track finished', type: 'info' } }));
        return;
      }

      if (playNextRef.current) playNextRef.current();
    };
    const handlePlaying = () => { setIsBuffering(false); setIsPlaying(true); };
    const handlePause   = () => { setIsPlaying(false); };
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleError   = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      window.dispatchEvent(new CustomEvent('appToast', { detail: { message: 'Stream unavailable — skipping or try again', type: 'error' } }));
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended',      handleEnded);
    audio.addEventListener('playing',    handlePlaying);
    audio.addEventListener('pause',      handlePause);
    audio.addEventListener('waiting',    handleWaiting);
    audio.addEventListener('canplay',    handleCanPlay);
    audio.addEventListener('error',      handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended',      handleEnded);
      audio.removeEventListener('playing',    handlePlaying);
      audio.removeEventListener('pause',      handlePause);
      audio.removeEventListener('waiting',    handleWaiting);
      audio.removeEventListener('canplay',    handleCanPlay);
      audio.removeEventListener('error',      handleError);
    };
  }, []);

  // ─── Auto-queue (Endless Radio) ─────────────────────────────────────────────
  useEffect(() => {
    if (queue.length > 0 && queueIndex === queue.length - 1) {
      if (!getSettings().autoplay) return;
      const track = queue[queueIndex];
      const videoId = track.videoId || track.id;
      if (videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
        fetchRelated(videoId).then(data => {
          if (data?.items && data.items.length > 0) {
            const related = data.items.map(item => ({
              videoId: item.id || item.videoId,
              title: item.title,
              artist: item.artists ? item.artists.map(a => a.name).join(', ') : (item.artist || item.author || ''),
              thumbnail: item.thumbnail || item.thumbnailUrl || '',
              duration: item.duration || 0,
            })).filter(t => !queue.some(q => (q.videoId || q.id) === (t.videoId || t.id)));

            if (related.length > 0) {
              setQueue(prev => [...prev, ...related.slice(0, 15)]);
            }
          }
        }).catch(err => console.error('Failed to fetch related for auto-queue:', err));
      }
    }
  }, [queueIndex, queue.length]);

  // ─── Internal fetch-and-play ────────────────────────────────────────────────
  const playTrackInternal = async (track, resumeTime = 0) => {
    const requestId = ++playRequestIdRef.current;
    const settings = getSettings();
    const audio = audioRef.current;

    ensureAudioGraph();

    if (settings.crossfade && isPlaying) {
      fadeVolume(0, Math.min(800, (settings.crossfadeDuration || 4) * 200));
    }
    audio.pause();
    setIsPlaying(false);
    setIsBuffering(true);
    setCurrentTrack(track);
    setProgress(resumeTime);
    setDuration(track.duration || 0);
    setStreamInfo(null);

    if (settings.saveHistory) {
      addRecentlyPlayed(track);
    }

    // Update OS MediaSession metadata
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || 'Metrolist',
          artist: track.artist || 'YouTube Music',
          artwork: track.thumbnail ? [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
        });
      } catch {}
    }

    if (settings.showNotifications && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Now Playing', { body: `${track.title}${track.artist ? ` — ${track.artist}` : ''}` });
      }
    }

    try {
      const videoId = track.videoId || track.id;
      const streamApiUrl = `${getApiBase()}/stream/${encodeURIComponent(videoId)}?quality=${settings.streamQuality}`;
      let response = await fetch(streamApiUrl);
      if (!response.ok && response.status >= 500) {
        await new Promise((r) => setTimeout(r, 350));
        if (requestId !== playRequestIdRef.current) return;
        response = await fetch(streamApiUrl);
      }
      if (requestId !== playRequestIdRef.current) return;
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Stream fetch failed: ${response.status}`);
      }

      const data = await response.json();
      if (requestId !== playRequestIdRef.current) return;

      if (data.url) {
        let streamUrl = data.url;
        if (streamUrl.startsWith('http://localhost:8091/api') && window.location.port === '5173') {
          streamUrl = streamUrl.replace('http://localhost:8091/api', '/api');
        }
        setStreamInfo({
          mimeType: data.mimeType,
          bitrate: data.bitrate,
          codecs: data.codecs,
          clientName: data.clientName,
          isSabr: data.isSabr,
        });
        if (data.durationSeconds && (!track.duration || track.duration === 0)) {
          setDuration(data.durationSeconds);
        }

        audio.crossOrigin = 'anonymous';
        audio.src = streamUrl;
        audio.playbackRate = playbackRate;
        if (resumeTime > 0) {
          audio.currentTime = resumeTime;
        }
        if (settings.crossfade) {
          audio.volume = 0.05;
        } else {
          audio.volume = stateRefs.current.volume;
        }

        try {
          await audio.play();
          setIsPlaying(true);
          if (settings.crossfade) {
            fadeVolume(stateRefs.current.volume, (settings.crossfadeDuration || 4) * 300);
          }
        } catch (playErr) {
          console.warn('play() rejected:', playErr);
        }
        setIsBuffering(false);
      }
    } catch (err) {
      if (requestId !== playRequestIdRef.current) return;
      console.error('Playback failed', err);
      setIsBuffering(false);
      window.dispatchEvent(new CustomEvent('appToast', { detail: { message: `Playback failed: ${err.message}`, type: 'error' } }));
    }
  };

  // ─── Public playTrack ───────────────────────────────────────────────────────
  const playTrack = async (track, fromQueue = false) => {
    const normalized = {
      videoId: track.videoId || track.id,
      title: track.title,
      artist: track.artist || track.subtitle || track.author || '',
      thumbnail: track.thumbnail || track.thumbnailUrl || track.cover || '',
      duration: track.duration || 0,
    };

    if (!fromQueue && currentTrack?.videoId === normalized.videoId) {
      togglePlay();
      return;
    }

    if (!fromQueue) {
      setQueue([normalized]);
      setQueueIndex(0);
    }

    await playTrackInternal(normalized);
  };

  // ─── Play full queue ────────────────────────────────────────────────────────
  const playQueue = async (tracks, startIndex = 0) => {
    if (!tracks || tracks.length === 0) return;
    const normalized = tracks.map(t => ({
      videoId: t.videoId || t.id,
      title: t.title,
      artist: t.artist || t.subtitle || t.author || '',
      thumbnail: t.thumbnail || t.thumbnailUrl || t.cover || '',
      duration: t.duration || 0,
    }));
    const idx = Math.max(0, Math.min(startIndex, normalized.length - 1));
    setQueue(normalized);
    setQueueIndex(idx);
    await playTrackInternal(normalized[idx]);
  };

  // ─── Next / Prev ────────────────────────────────────────────────────────────
  const playNext = async () => {
    const { queue, queueIndex, isShuffle, repeatMode } = stateRefs.current;
    if (queue.length === 0) return;

    if (repeatMode === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    let nextIndex;
    if (isShuffle && queue.length > 1) {
      do { nextIndex = Math.floor(Math.random() * queue.length); }
      while (nextIndex === queueIndex);
    } else {
      nextIndex = queueIndex + 1;
    }

    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') nextIndex = 0;
      else { setIsPlaying(false); setProgress(0); return; }
    }

    setQueueIndex(nextIndex);
    await playTrackInternal(queue[nextIndex]);
  };

  const playPrev = async () => {
    const { queue, queueIndex } = stateRefs.current;
    if (progress > 3) {
      seek(0);
    } else if (queue.length > 0 && queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      setQueueIndex(prevIndex);
      await playTrackInternal(queue[prevIndex]);
    } else {
      seek(0);
    }
  };

  const playNextRef = useRef(playNext);
  const playPrevRef = useRef(playPrev);
  useEffect(() => {
    playNextRef.current = playNext;
    playPrevRef.current = playPrev;
  });

  // MediaSession action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNextRef.current?.());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrevRef.current?.());
    } catch {}
  }, []);

  // ─── Controls ───────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!currentTrack) return;
    ensureAudioGraph();

    if (!audioRef.current.src || audioRef.current.src === '' || audioRef.current.src === window.location.href) {
      playTrackInternal(currentTrack, progress);
      return;
    }

    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else            { audioRef.current.play().catch(() => {}); setIsPlaying(true); }
  };

  const seek = (time) => {
    if (audioRef.current && !isNaN(time)) {
      audioRef.current.currentTime = Math.max(0, time);
      setProgress(Math.max(0, time));
    }
  };

  const changeVolume = (val) => {
    const clamped = Math.max(0, Math.min(1, val));
    if (audioRef.current) { audioRef.current.volume = clamped; setVolume(clamped); }
  };

  const toggleShuffle = () => setIsShuffle(prev => !prev);

  const toggleRepeat = () => setRepeatMode(prev => {
    if (prev === 'off') return 'all';
    if (prev === 'all') return 'one';
    return 'off';
  });

  const removeFromQueue = (index) => {
    setQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(index, 1);
      return newQueue;
    });
    if (index < queueIndex) {
      setQueueIndex(prev => prev - 1);
    }
  };

  const clearUpNext = () => {
    if (queueIndex < 0) {
      setQueue([]);
      return;
    }
    setQueue(prev => prev.slice(0, queueIndex + 1));
  };

  const addToQueue = (track) => {
    if (!track) return;
    const formattedTrack = {
      videoId: track.videoId || track.id,
      title: track.title,
      artist: track.artist || track.author || track.subtitle || '',
      thumbnail: track.thumbnail || track.thumbnailUrl || track.cover || '',
      duration: track.duration || 0,
    };
    setQueue(prev => {
      if (prev.length === 0) {
        setQueueIndex(0);
        playTrackInternal(formattedTrack);
        return [formattedTrack];
      }
      return [...prev, formattedTrack];
    });
  };

  const playNextInQueue = (track) => {
    if (!track) return;
    const formattedTrack = {
      videoId: track.videoId || track.id,
      title: track.title,
      artist: track.artist || track.author || track.subtitle || '',
      thumbnail: track.thumbnail || track.thumbnailUrl || track.cover || '',
      duration: track.duration || 0,
    };
    setQueue(prev => {
      if (prev.length === 0) {
        setQueueIndex(0);
        playTrackInternal(formattedTrack);
        return [formattedTrack];
      }
      const next = [...prev];
      next.splice(queueIndex + 1, 0, formattedTrack);
      return next;
    });
  };

  const setSleepTimer = (minutesOrMode) => {
    if (minutesOrMode === null) {
      setSleepTimerSeconds(null);
    } else if (minutesOrMode === 'end_of_track') {
      setSleepTimerSeconds('end_of_track');
    } else {
      setSleepTimerSeconds(minutesOrMode * 60);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isBuffering,
        progress,
        duration,
        volume,
        queue,
        queueIndex,
        isShuffle,
        repeatMode,
        streamInfo,
        analyserRef,
        eqEnabled,
        eqPreset,
        eqGains,
        playbackRate,
        sleepTimerSeconds,
        playTrack,
        playQueue,
        addToQueue,
        playNextInQueue,
        clearUpNext,
        playNext,
        playPrev,
        togglePlay,
        seek,
        changeVolume,
        toggleShuffle,
        toggleRepeat,
        removeFromQueue,
        toggleEq,
        applyEqPreset,
        setEqBandGain,
        changePlaybackRate,
        setSleepTimer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
