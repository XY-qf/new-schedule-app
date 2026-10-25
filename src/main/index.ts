import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { APP_USER_MODEL_ID } from '../shared/app-info';
import { openDatabase } from './db/connection';
import { runMigrations } from './db/migrate';
import { ensureSeedCategories } from './repo/categories';
import { registerIpcHandlers } from './ipc/register';
import { boundsForView } from './window/bounds';
import type { Db } from './db/driver';

let mainWindow: BrowserWindow | null = null;
let db: Db | null = null;

function initDatabase(): Db {
  const file = join(app.getPath('userData'), 'data', 'app.db');
  const database = openDatabase(file);
  runMigrations(database);
  ensureSeedCategories(database);
  return database;
}

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

void app.whenReady().then(() => {
  app.setAppUserModelId(APP_USER_MODEL_ID);
  db = initDatabase();
  registerIpcHandlers(db);
  createWindow();
});

app.on('window-all-closed', () => {
  db?.close();
  db = null;
  app.quit();
});