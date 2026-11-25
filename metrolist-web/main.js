'use strict';

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');

function writeDebugLog(msg) {
  try {
    const logPath = 'C:\\metrolist-debug.txt';
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch(e) {}
}

// ── Ensure consistent app name for userData directory ──────────────────────
app.name = 'Metrolist';

// ── Prevent multiple instances gracefully ──────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[main] Another instance of Metrolist is already running. Quitting.');
  app.quit();
  process.exit(0);
}

// Disable hardware acceleration and sandbox to prevent Chromium crashes when running as Administrator
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// ── Global error guards ───────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err);
  writeDebugLog(`Uncaught Exception: ${err.stack}`);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
  writeDebugLog(`Unhandled Rejection: ${reason}`);
});

let mainWindow = null;
let backendProcess = null;
let staticServer = null;

// Helper to kill any stray backend instance on port 8091 before launching new one
function cleanupExistingBackend() {
  if (process.platform === 'win32') {
    try {
      const output = execSync('netstat -ano | findstr :8091', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (output) {
        const lines = output.trim().split('\n');
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            try {
              execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
              console.log(`[main] Killed existing backend PID ${pid}`);
            } catch (e) {}
          }
        });
      }
    } catch (e) {}
  }
}

// ── Backend startup ───────────────────────────────────────────────────────────
function startBackend() {
  cleanupExistingBackend();

  try {
    if (app.isPackaged) {
      const jarPath = path.join(process.resourcesPath, 'backend.jar');
      console.log('[main] Spawning packaged backend JAR from:', jarPath);

      if (!fs.existsSync(jarPath)) {
        console.error('[main] backend.jar missing at:', jarPath);
        dialog.showErrorBox(
          'Missing Backend Component',
          `Could not locate backend.jar at:\n${jarPath}\n\nPlease reinstall Metrolist.`
        );
        return;
      }

      backendProcess = spawn('java', ['-jar', jarPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    } else {
      const backendDir = path.join(__dirname, 'backend');
      console.log('[main] Spawning dev backend from:', backendDir);
      const command = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
      backendProcess = spawn(command, ['run'], {
        cwd: backendDir,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    if (backendProcess) {
      backendProcess.stdout.on('data', (data) => {
        console.log('[backend]', data.toString().trim());
      });

      backendProcess.stderr.on('data', (data) => {
        console.error('[backend-err]', data.toString().trim());
      });

      backendProcess.on('error', (err) => {
        console.error('[main] Failed to start backend process:', err.message);
        if (err.code === 'ENOENT') {
          dialog.showErrorBox(
            'Java Runtime Not Found',
            'Metrolist requires Java (JDK/JRE 25+) to run its internal audio server.\n\nPlease install Java 25+ or ensure "java" is added to your system PATH, then restart Metrolist.'
          );
        }
      });

      backendProcess.on('exit', (code, signal) => {
        console.log(`[main] Backend exited — code=${code}, signal=${signal}`);
        backendProcess = null;
      });
    }
  } catch (err) {
    console.error('[main] startBackend threw:', err.message);
  }
}

// ── Window creation ───────────────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Metrolist',
    icon: path.join(__dirname, 'build/icon.png'),
    backgroundColor: '#121212',
    show: true, // Show immediately to see if window opens at all
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
  });

  mainWindow.removeMenu();

  // Log renderer console messages in main process for easy debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[renderer console ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[main] Failed to load URL "${validatedURL}": ${errorDescription} (code: ${errorCode})`);
  });

  // Show window only after first paint
  mainWindow.once('ready-to-show', () => {
    writeDebugLog('Window ready-to-show emitted');
    mainWindow.show();
  });

  if (!app.isPackaged) {
    console.log('[main] Loading DEV environment from http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('[main] loadURL failed:', err.message);
    });
  } else {
    try {
      const distPath = path.join(__dirname, 'dist');
      const indexPath = path.join(distPath, 'index.html');
      console.log('[main] Loading PROD app file:', indexPath);
      mainWindow.loadFile(indexPath).catch((err) => {
        console.error('[main] loadFile failed:', err.message);
      });
    } catch (err) {
      console.error('[main] Failed to initialize static production file:', err);
    }
  }

  // Renderer crash recovery
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    writeDebugLog(`Renderer gone: ${details.reason}`);
    console.error('[main] Renderer gone:', details.reason);
    if (details.reason !== 'clean-exit') {
      dialog.showMessageBox({
        type: 'error',
        title: 'Metrolist crashed',
        message: 'The app renderer crashed. What would you like to do?',
        buttons: ['Reload', 'Quit'],
      }).then(({ response }) => {
        if (response === 0 && mainWindow) mainWindow.reload();
        else app.quit();
      }).catch(() => app.quit());
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    writeDebugLog('Renderer became unresponsive');
    console.warn('[main] Renderer became unresponsive');
  });

  mainWindow.on('closed', () => {
    writeDebugLog('mainWindow closed');
    mainWindow = null;
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  writeDebugLog('App is ready. Starting backend...');
  startBackend();
  writeDebugLog('Creating window...');
  await createWindow();
  writeDebugLog('Window creation finished.');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(err => writeDebugLog(`whenReady error: ${err}`));

// Second-instance: focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  writeDebugLog('window-all-closed triggered');
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (e) => {
  writeDebugLog('before-quit triggered');
  if (staticServer) {
    try {
      staticServer.close();
    } catch (e) {}
  }
  if (backendProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], { detached: true });
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (err) {
      writeDebugLog(`Error killing backend: ${err.message}`);
      console.error('[main] Error killing backend:', err.message);
    }
  }
});

// ── IPC helpers ───────────────────────────────────────────────────────────────
ipcMain.on('app-quit', () => app.quit());
