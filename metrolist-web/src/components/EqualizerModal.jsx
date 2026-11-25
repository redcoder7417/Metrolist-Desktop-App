import React, { useContext } from 'react';
import { PlayerContext, EQ_BANDS, EQ_PRESETS } from '../context/PlayerContext';
import { FiX, FiSliders, FiRotateCcw } from 'react-icons/fi';

const SPEEDS = [0.75, 0.9, 1.0, 1.1, 1.25, 1.5];

const EqualizerModal = ({ isOpen, onClose }) => {
  const {
    eqEnabled,
    eqPreset,
    eqGains,
    toggleEq,
    applyEqPreset,
    setEqBandGain,
    playbackRate,
    changePlaybackRate,
  } = useContext(PlayerContext);

  if (!isOpen) return null;

  // Build SVG smooth curve path across the 10 bands
  const width = 460;
  const height = 84;
  const padX = 18;
  const stepX = (width - padX * 2) / (EQ_BANDS.length - 1);
  const points = eqGains.map((g, idx) => {
    const x = padX + idx * stepX;
    const y = height / 2 - (g / 12) * (height / 2 - 10);
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content eq-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <FiSliders size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Audio Equalizer & DSP</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-subdued)' }}>
                Real-time 10-band Web Audio filter bank
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              role="switch"
              aria-checked={eqEnabled}
              className={`settings-toggle${eqEnabled ? ' on' : ''}`}
              onClick={toggleEq}
              title={eqEnabled ? 'Disable EQ' : 'Enable EQ'}
            >
              <span className="settings-toggle-thumb" />
            </button>
            <button className="modal-close-btn" onClick={onClose}>
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="eq-presets-row">
          {Object.keys(EQ_PRESETS).map((name) => (
            <button
              key={name}
              className={`eq-preset-chip${eqPreset === name ? ' active' : ''}`}
              onClick={() => applyEqPreset(name)}
            >
              {name}
            </button>
          ))}
        </div>

        {/* SVG Frequency Response Preview */}
        <div className={`eq-curve-card${!eqEnabled ? ' eq-disabled' : ''}`}>
          <svg viewBox={`0 0 ${width} ${height}`} className="eq-curve-svg">
            <defs>
              <linearGradient id="eqFillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <line x1={padX} y1={height / 2} x2={width - padX} y2={height / 2} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
            <path d={areaD} fill="url(#eqFillGrad)" />
            <path d={pathD} fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" strokeLinecap="round" />
            {points.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill="#fff" stroke="var(--accent-cyan)" strokeWidth="2" />
            ))}
          </svg>
        </div>

        {/* 10-Band Vertical Sliders */}
        <div className={`eq-sliders-grid${!eqEnabled ? ' eq-disabled' : ''}`}>
          {EQ_BANDS.map((band, idx) => (
            <div key={band.freq} className="eq-band-col">
              <span className="eq-db-val">
                {eqGains[idx] > 0 ? `+${eqGains[idx]}` : eqGains[idx]}dB
              </span>
              <div className="eq-slider-wrap">
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={eqGains[idx]}
                  onChange={(e) => setEqBandGain(idx, Number(e.target.value))}
                  className="eq-vertical-range"
                  aria-label={`${band.label} gain`}
                />
              </div>
              <span className="eq-freq-label">{band.label}</span>
            </div>
          ))}
        </div>

        {/* Playback Speed & Reset */}
        <div className="eq-footer">
          <div className="eq-speed-group">
            <span className="eq-speed-label">Speed</span>
            <div className="eq-speed-chips">
              {SPEEDS.map((spd) => (
                <button
                  key={spd}
                  className={`eq-speed-chip${playbackRate === spd ? ' active' : ''}`}
                  onClick={() => changePlaybackRate(spd)}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <button className="eq-reset-btn" onClick={() => applyEqPreset('Flat')}>
            <FiRotateCcw size={14} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default EqualizerModal;
