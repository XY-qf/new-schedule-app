import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { APP_NAME, APP_USER_MODEL_ID } from '../shared/app-info';
import { openDatabase } from './db/connection';
import { runMigrations } from './db/migrate';
import { ensureSeedCategories } from './repo/categories';
import { registerIpcHandlers } from './ipc/register';
import { confirmQuit, createTray, startNotifications, stopNotifications } from './tray';
import { boundsForView } from './window/bounds';
import type { Db } from './db/driver';

// 应用名决定 %APPDATA% 下的数据目录名；PRD 第 9 节要求是「AI待办软件」。
app.setName(APP_NAME);

let mainWindow: BrowserWindow | null = null;
let db: Db | null = null;

// 允许外部指定数据目录：端到端测试要跑在干净、可丢弃的目录里，
// 不能碰用户真实的 app.db。
const userDataOverride = process.env['AI_TODO_USER_DATA'];
if (userDataOverride) {
  app.setPath('userData', userDataOverride);
}

// 单实例：两个进程同时打开同一个 app.db 会得到互相看不见的两份状态。
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  void app.whenReady().then(() => {
    app.setAppUserModelId(APP_USER_MODEL_ID);
    db = initDatabase();
    registerIpcHandlers(db);
    createWindow();
    startNotifications(db);

    createTray({
      onOpen: () => {
        if (!mainWindow) {
          createWindow();
          return;
        }
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      },
      onCreateSchedule: () => {
        if (!mainWindow) createWindow();
        mainWindow?.show();
        mainWindow?.focus();
      },
      onQuit: () => {
        void (async () => {
          const ok = await confirmQuit(mainWindow);
          if (!ok) return;
          isQuitting = true;
          app.quit();
        })();
      },
    });
  });
}

/** 托盘「退出」走这条路径时，close 事件不再拦。 */
let isQuitting = false;

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
    minWidth: 380,
    minHeight: 480,
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

  // 关闭 = 缩到托盘（FR-12.1）；真退出走托盘菜单的「退出」。
  win.on('close', (event) => {
    // 端到端测试里 app.close() 必须真的退出，否则 Playwright 会等超时。
    if (isQuitting || process.env['AI_TODO_TEST_QUIT_ON_CLOSE'] === '1') return;
    event.preventDefault();
    win.hide();
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow = win;
}

app.on('window-all-closed', () => {
  // 托盘常驻：关掉窗口不等于退出进程，这里什么都不做。
});

// 数据库只在真正退出时关闭：关窗口 ≠ 退出进程，提前关会让仍注册着的 IPC handler 用到已关闭实例。
app.on('will-quit', () => {
  stopNotifications();
  db?.close();
  db = null;
});
