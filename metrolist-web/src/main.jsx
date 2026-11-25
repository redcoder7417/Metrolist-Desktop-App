import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { PlayerProvider } from './context/PlayerContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { LibraryProvider } from './context/LibraryContext.jsx'
import BackendLoader from './components/BackendLoader.jsx'
import { getSettings } from './services/settingsService.js'

// Apply user settings (e.g. accent color) instantly before initial render
const settings = getSettings();
const accent = (settings && settings.accentColor) ? settings.accentColor : '#00d2ff';
document.documentElement.style.setProperty('--accent-cyan', accent);
document.documentElement.style.setProperty('--essential-bright-accent', accent);
document.documentElement.style.setProperty('--text-bright-accent', accent);

if (settings && settings.theme) {
  document.body.setAttribute('data-theme', settings.theme);
}
if (settings && settings.compactMode) {
  document.body.classList.add('compact-mode');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BackendLoader>
      <ToastProvider>
        <PlayerProvider>
          <LibraryProvider>
            <App />
          </LibraryProvider>
        </PlayerProvider>
      </ToastProvider>
    </BackendLoader>
  </React.StrictMode>,
)
