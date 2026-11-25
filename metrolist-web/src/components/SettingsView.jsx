import React, { useState, useEffect } from 'react';
import {
  FiSettings, FiVolume2, FiZap, FiBell, FiGlobe, FiType,
  FiSave, FiRotateCcw, FiChevronRight, FiCheck, FiMoon,
  FiSun, FiSliders, FiExternalLink, FiGithub
} from 'react-icons/fi';
import { getSettings, saveSetting, resetSettings } from '../services/settingsService';
import { ToastContext } from '../context/ToastContext';
import { useContext } from 'react';

const APP_VERSION = '14.0.0';

/* ── Reusable toggle ── */
const Toggle = ({ value, onChange, id }) => (
  <button
    id={id}
    role="switch"
    aria-checked={value}
    className={`settings-toggle${value ? ' on' : ''}`}
    onClick={() => onChange(!value)}
  >
    <span className="settings-toggle-thumb" />
  </button>
);

/* ── Reusable select ── */
const Select = ({ value, options, onChange }) => (
  <select
    className="settings-select"
    value={value}
    onChange={e => onChange(e.target.value)}
  >
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

/* ── Section wrapper ── */
const Section = ({ title, icon, children }) => (
  <div className="settings-section">
    <div className="settings-section-header">
      {icon}
      <h3>{title}</h3>
    </div>
    <div className="settings-section-body">
      {children}
    </div>
  </div>
);

/* ── Row wrapper ── */
const Row = ({ label, hint, children }) => (
  <div className="settings-row">
    <div className="settings-row-label">
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </div>
    <div className="settings-row-control">
      {children}
    </div>
  </div>
);

const ACCENT_COLORS = [
  '#00d2ff', '#0077b6', '#7928ca'
];

const SettingsView = () => {
  const [settings, setSettings] = useState(getSettings);
  const { addToast } = useContext(ToastContext);

  // Sync from storage whenever another component changes it
  useEffect(() => {
    const sync = () => setSettings(getSettings());
    window.addEventListener('settingsUpdated', sync);
    return () => window.removeEventListener('settingsUpdated', sync);
  }, []);

  const set = (key, value) => {
    saveSetting(key, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    resetSettings();
    setSettings(getSettings());
    addToast('Settings reset to defaults', 'info');
  };

  const handleSave = () => {
    addToast('Settings saved ✓', 'info');
  };

  // Apply accent color as CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-cyan', settings.accentColor);
    document.documentElement.style.setProperty('--essential-bright-accent', settings.accentColor);
    document.documentElement.style.setProperty('--text-bright-accent', settings.accentColor);
  }, [settings.accentColor]);

  // Apply font size
  useEffect(() => {
    const scale = settings.fontSize === 'small' ? '13px' : settings.fontSize === 'large' ? '16px' : '14px';
    document.documentElement.style.setProperty('--font-base', scale);
  }, [settings.fontSize]);

  // Apply theme
  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Apply compact mode
  useEffect(() => {
    if (settings.compactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }
  }, [settings.compactMode]);

  return (
    <div className="tab-view settings-view">
      {/* Header */}
      <div className="tab-hero" style={{ marginBottom: 8 }}>
        <div className="tab-hero-icon" style={{ background: 'linear-gradient(135deg, #868f96, #596164)' }}>
          <FiSettings size={40} />
        </div>
        <div className="tab-hero-info">
          <h1 className="tab-hero-title">Settings</h1>
          <p className="tab-hero-sub">Customize your MetroList experience</p>
        </div>
      </div>

      <div className="settings-grid">

        {/* ── Appearance ── */}
        <Section title="Appearance" icon={<FiMoon size={18} />}>
          <Row label="Theme" hint="Choose your color theme">
            <Select
              value={settings.theme}
              onChange={v => set('theme', v)}
              options={[
                { value: 'dark', label: '🌑 Dark' },
                { value: 'darker', label: '⬛ Darker' },
                { value: 'midnight', label: '🌌 Midnight' },
              ]}
            />
          </Row>
          <Row label="Accent Color" hint="Pick your brand color">
            <div className="accent-color-picker">
              {ACCENT_COLORS.map(color => (
                <button
                  key={color}
                  className={`accent-dot${settings.accentColor === color ? ' selected' : ''}`}
                  style={{ background: color }}
                  onClick={() => set('accentColor', color)}
                  title={color}
                >
                  {settings.accentColor === color && <FiCheck size={12} strokeWidth={3} />}
                </button>
              ))}
              
              <div 
                className={`accent-dot custom-picker-wrap${!ACCENT_COLORS.includes(settings.accentColor) ? ' selected' : ''}`}
                style={{ background: !ACCENT_COLORS.includes(settings.accentColor) ? settings.accentColor : 'linear-gradient(45deg, #ff007f, #f59e0b, #10b981)' }}
                title="Custom color"
              >
                {!ACCENT_COLORS.includes(settings.accentColor) && <FiCheck size={12} strokeWidth={3} style={{ zIndex: 1 }} />}
                <input
                  type="color"
                  className="custom-color-input"
                  value={settings.accentColor}
                  onChange={(e) => set('accentColor', e.target.value)}
                />
              </div>
            </div>
          </Row>
          <Row label="Font Size" hint="Adjust text size">
            <Select
              value={settings.fontSize}
              onChange={v => set('fontSize', v)}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
            />
          </Row>
          <Row label="Compact Mode" hint="Reduce spacing in lists">
            <Toggle id="compact-mode" value={settings.compactMode} onChange={v => set('compactMode', v)} />
          </Row>
        </Section>

        {/* ── Playback ── */}
        <Section title="Playback" icon={<FiVolume2 size={18} />}>
          <Row label="Stream Quality" hint="Higher = more data usage">
            <Select
              value={settings.streamQuality}
              onChange={v => set('streamQuality', v)}
              options={[
                { value: 'low', label: '📡 Low (128 kbps)' },
                { value: 'medium', label: '🎵 Medium (256 kbps)' },
                { value: 'high', label: '🎶 High (320 kbps)' },
              ]}
            />
          </Row>
          <Row label="Autoplay" hint="Continue playing similar tracks">
            <Toggle id="autoplay" value={settings.autoplay} onChange={v => set('autoplay', v)} />
          </Row>
          <Row label="Crossfade" hint="Smooth transition between tracks">
            <Toggle id="crossfade" value={settings.crossfade} onChange={v => set('crossfade', v)} />
          </Row>
          {settings.crossfade && (
            <Row label="Crossfade Duration" hint={`${settings.crossfadeDuration}s`}>
              <input
                type="range"
                className="settings-range"
                min={1} max={12} step={1}
                value={settings.crossfadeDuration}
                onChange={e => set('crossfadeDuration', Number(e.target.value))}
              />
            </Row>
          )}
        </Section>

        {/* ── Privacy ── */}
        <Section title="Privacy & Data" icon={<FiSliders size={18} />}>
          <Row label="Save Listening History" hint="Track what you've played">
            <Toggle id="save-history" value={settings.saveHistory} onChange={v => set('saveHistory', v)} />
          </Row>
          <Row label="Notifications" hint="Get playback notifications">
            <Toggle id="notifications" value={settings.showNotifications} onChange={v => set('showNotifications', v)} />
          </Row>
          <Row label="Language" hint="App language">
            <Select
              value={settings.language}
              onChange={v => set('language', v)}
              options={[
                { value: 'en', label: '🇬🇧 English' },
                { value: 'hi', label: '🇮🇳 Hindi' },
                { value: 'pa', label: '🇮🇳 Punjabi' },
              ]}
            />
          </Row>
        </Section>

        {/* ── About ── */}
        <Section title="About MetroList" icon={<FiZap size={18} />}>
          <Row label="Version">
            <span className="settings-value-text">v{APP_VERSION}</span>
          </Row>
          <Row label="Repository" hint="Official Metrolist Project">
            <a
              href="https://github.com/MetrolistGroup/Metrolist"
              target="_blank"
              rel="noopener noreferrer"
              className="settings-value-text"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#00d2ff',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              <FiGithub size={15} /> MetrolistGroup/Metrolist <FiExternalLink size={13} />
            </a>
          </Row>
          <Row label="Build">
            <span className="settings-value-text">Electron + React + Vite</span>
          </Row>
          <Row label="Storage Used">
            <span className="settings-value-text">
              {(new Blob([JSON.stringify(localStorage)]).size / 1024).toFixed(1)} KB
            </span>
          </Row>
          <Row label="Reset All Settings" hint="Restore defaults">
            <button className="tab-danger-btn" onClick={handleReset}>
              <FiRotateCcw size={14} /> Reset
            </button>
          </Row>
        </Section>
      </div>

      {/* Save button */}
      <div className="settings-footer">
        <button className="hero-play-btn" onClick={handleSave} style={{ fontSize: 14 }}>
          <FiSave size={16} /> Save Settings
        </button>
      </div>
    </div>
  );
};

export default SettingsView;
