import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { APP_USER_MODEL_ID } from '../shared/app-info';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
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

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  app.setAppUserModelId(APP_USER_MODEL_ID);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});