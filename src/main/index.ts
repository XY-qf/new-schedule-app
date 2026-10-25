import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import { APP_USER_MODEL_ID } from '../shared/app-info';
import { boundsForView, type ViewName } from './window/bounds';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const display = screen.getPrimaryDisplay();
  const bounds = boundsForView('calendar', { workArea: display.workArea });

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on('ready-to-show', () => {
    win.show();
  });
  win.on('closed', () => {
    mainWindow = null;
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow = win;
}

ipcMain.handle('window:setView', (_event, payload: { view: ViewName }) => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!win) return null;

  const display = screen.getDisplayMatching(win.getBounds());
  const next = boundsForView(payload.view, { workArea: display.workArea }, win.getContentBounds());
  win.setContentBounds(next);
  return next;
});

void app.whenReady().then(() => {
  app.setAppUserModelId(APP_USER_MODEL_ID);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});