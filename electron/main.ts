import { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, shell, Notification } from 'electron';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let helperProcess: ChildProcessWithoutNullStreams | null = null;
let helperRestartTimer: NodeJS.Timeout | null = null;
let isQuitting = false;

let pillBoundsInScreen = { x: 0, y: 0, width: 0, height: 0 };

// Windows only shows toast notifications for an app with an AppUserModelID (matches build.appId)
if (process.platform === 'win32') {
  app.setAppUserModelId('com.topdeck.windows');
}
let isMouseInsidePill = false;
let hitTestInterval: NodeJS.Timeout | null = null;

const WINDOW_WIDTH = 560;
const WINDOW_HEIGHT = 280;
const TOP_OFFSET = 0;

function repositionWindow(win: BrowserWindow) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;
  const x = Math.round(bounds.x + (bounds.width - WINDOW_WIDTH) / 2);
  const y = bounds.y + TOP_OFFSET;
  win.setBounds({ x, y, width: WINDOW_WIDTH, height: WINDOW_HEIGHT });
}

function startNativeHelper() {
  if (isQuitting) return;

  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, 'native/helper.ps1')
    : path.join(__dirname, '../native/helper.ps1');
  if (!fs.existsSync(helperPath)) {
    console.error('Helper script not found at:', helperPath);
    return;
  }

  try {
    helperProcess = spawn('powershell.exe', [
      '-NonInteractive',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      helperPath,
    ]);

    let buffer = '';

    helperProcess.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('media-update', parsed);
          }
        } catch {
          // Non-JSON diagnostic line, ignore
        }
      }
    });

    helperProcess.stderr.on('data', (err) => {
      console.warn('Native helper warning:', err.toString());
    });

    helperProcess.on('exit', (code) => {
      console.log(`Native helper exited with code ${code}`);
      helperProcess = null;
      if (!isQuitting) {
        if (helperRestartTimer) clearTimeout(helperRestartTimer);
        helperRestartTimer = setTimeout(() => {
          console.log('Auto-restarting native helper...');
          startNativeHelper();
        }, 2500);
      }
    });
  } catch (err) {
    console.error('Failed to spawn native helper:', err);
  }
}

function stopNativeHelper() {
  if (helperRestartTimer) {
    clearTimeout(helperRestartTimer);
    helperRestartTimer = null;
  }
  if (helperProcess) {
    try {
      helperProcess.kill();
    } catch { }
    helperProcess = null;
  }
}

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets/tray.png')
    : path.join(__dirname, '../assets/tray.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('TopDeck for Windows');

  const updateContextMenu = () => {
    const isAutostart = app.getLoginItemSettings().openAtLogin;

    const contextMenu = Menu.buildFromTemplate([
      { label: 'TopDeck (Active)', enabled: false },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: isAutostart,
        click: () => {
          const nextState = !isAutostart;
          app.setLoginItemSettings({ openAtLogin: nextState });
          updateContextMenu();
        },
      },
      {
        label: 'Toggle Super Hide (Hover top edge)',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('toggle-super-hide');
          }
        },
      },
      {
        label: 'Restart Native Helper',
        click: () => {
          stopNativeHelper();
          startNativeHelper();
        },
      },
      {
        label: 'Reposition to Center',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            repositionWindow(mainWindow);
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit TopDeck',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray?.setContextMenu(contextMenu);
  };

  updateContextMenu();
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;
  const x = Math.round(bounds.x + (bounds.width - WINDOW_WIDTH) / 2);
  const y = bounds.y + TOP_OFFSET;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // Windows-specific settings
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Initial click-through
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  const isDev = process.argv.includes('--dev');
  const indexPath = path.resolve(__dirname, '../dist/index.html');

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.warn('Waiting for build assets at:', indexPath);
      const checkTimer = setInterval(() => {
        if (fs.existsSync(indexPath) && mainWindow && !mainWindow.isDestroyed()) {
          clearInterval(checkTimer);
          mainWindow.loadFile(indexPath);
        }
      }, 500);
    }
  }

  // Handle display changes
  screen.on('display-metrics-changed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      repositionWindow(mainWindow);
    }
  });

  let leaveGraceTimer: NodeJS.Timeout | null = null;

  // Smooth hit-testing loop to guarantee click-through outside the pill
  hitTestInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // If pill bounds are 0 (e.g. hidden), ignore all
    if (pillBoundsInScreen.width === 0 || pillBoundsInScreen.height === 0) {
      if (!isMouseInsidePill) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      }
      return;
    }

    const cursor = screen.getCursorScreenPoint();
    const winBounds = mainWindow.getBounds();

    const inside = (
      cursor.x >= winBounds.x + pillBoundsInScreen.x &&
      cursor.x <= winBounds.x + pillBoundsInScreen.x + pillBoundsInScreen.width &&
      cursor.y >= winBounds.y + pillBoundsInScreen.y &&
      cursor.y <= winBounds.y + pillBoundsInScreen.y + pillBoundsInScreen.height
    );

    if (inside) {
      if (leaveGraceTimer) {
        clearTimeout(leaveGraceTimer);
        leaveGraceTimer = null;
      }
      if (!isMouseInsidePill) {
        isMouseInsidePill = true;
        mainWindow.setIgnoreMouseEvents(false);
      }
    } else {
      if (isMouseInsidePill && !leaveGraceTimer) {
        leaveGraceTimer = setTimeout(() => {
          isMouseInsidePill = false;
          leaveGraceTimer = null;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setIgnoreMouseEvents(true, { forward: true });
          }
        }, 150);
      }
    }
  }, 40);

  mainWindow.on('closed', () => {
    if (hitTestInterval) clearInterval(hitTestInterval);
    if (leaveGraceTimer) clearTimeout(leaveGraceTimer);
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('update-pill-bounds', (_event, rect) => {
  if (rect && typeof rect.width === 'number') {
    pillBoundsInScreen = rect;
  }
});

ipcMain.on('close-app', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('media-command', async (_event, command: string) => {
  if (helperProcess && helperProcess.stdin && !helperProcess.stdin.destroyed) {
    try {
      helperProcess.stdin.write(`${command.trim()}\n`);
      return true;
    } catch {
      return false;
    }
  }
  return false;
});

ipcMain.handle('open-settings', async (_event, setting: string) => {
  const map: Record<string, string> = {
    wifi: 'ms-settings:network-wifi',
    bluetooth: 'ms-settings:bluetooth',
    battery: 'ms-settings:batterysaver',
  };
  const target = map[setting] || `ms-settings:${setting}`;
  try {
    await shell.openExternal(target);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('notify', async (_event, title: string, body: string) => {
  if (!Notification.isSupported()) return false;
  // Silent: the renderer plays its own chime so the sound is the same whether or not toasts are enabled
  new Notification({ title, body, silent: true }).show();
  return true;
});

ipcMain.handle('get-system-status', async () => {
  return {
    ok: true,
    platform: process.platform,
    helperRunning: !!helperProcess,
    autostart: app.getLoginItemSettings().openAtLogin,
  };
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      repositionWindow(mainWindow);
      mainWindow.show();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    startNativeHelper();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  stopNativeHelper();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
