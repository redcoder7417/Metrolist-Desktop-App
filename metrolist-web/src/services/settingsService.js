/**
 * settingsService.js
 * localStorage-based app settings store
 */

const SETTINGS_KEY = 'metrolist_settings';

export const DEFAULT_SETTINGS = {
  theme: 'dark',               // 'dark' | 'darker' | 'midnight'
  accentColor: '#00d2ff',      // hex
  streamQuality: 'high',       // 'low' | 'medium' | 'high'
  autoplay: true,
  crossfade: false,
  crossfadeDuration: 4,        // seconds
  showNotifications: true,
  saveHistory: true,
  language: 'en',
  fontSize: 'medium',          // 'small' | 'medium' | 'large'
  compactMode: false,
  eqEnabled: false,
  eqPreset: 'Flat',
  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  playbackRate: 1.0,
};

export const getSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSetting = (key, value) => {
  const current = getSettings();
  const updated = { ...current, [key]: value };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { key, value } }));
};

export const saveSettings = (settings) => {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
};

export const resetSettings = () => {
  localStorage.removeItem(SETTINGS_KEY);
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: DEFAULT_SETTINGS }));
};
