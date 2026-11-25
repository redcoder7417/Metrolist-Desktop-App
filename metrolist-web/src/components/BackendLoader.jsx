import React, { useState, useEffect } from 'react';
import { waitForBackend } from '../services/api';

const BackendLoader = ({ children }) => {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'ready' | 'timeout'
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
      setElapsed(e => e + 1);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Backend health check
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const alive = await waitForBackend(90000);
      if (!cancelled) {
        setStatus(alive ? 'ready' : 'timeout');
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  if (status === 'ready') return children;

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo">
          <div className="splash-logo-icon">M</div>
          <h1>Metrolist</h1>
        </div>

        {status === 'connecting' && (
          <>
            <div className="splash-spinner">
              <div className="spinner-ring" />
            </div>
            <p className="splash-message">Starting music server{dots}</p>
            <span className="splash-sub">
              {elapsed < 10
                ? 'Initializing backend...'
                : elapsed < 30
                ? 'Compiling and warming up...'
                : 'Almost ready, hang tight...'}
            </span>
            <div className="splash-progress">
              <div
                className="splash-progress-fill"
                style={{ width: `${Math.min((elapsed / 60) * 100, 90)}%` }}
              />
            </div>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="splash-error-icon">⚠</div>
            <p className="splash-message">Backend failed to start</p>
            <span className="splash-sub">Make sure Java is installed and try restarting the app</span>
            <button
              className="splash-retry-btn"
              onClick={() => { setStatus('connecting'); setElapsed(0); }}
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BackendLoader;
