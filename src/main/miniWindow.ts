import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

/** 迷你弹窗尺寸（FR-9.8）。 */
export const MINI_SIZE = { width: 380, height: 110 };
const MARGIN = 16;

let mini: BrowserWindow | null = null;

function boundsFor(): { x: number; y: number; width: number; height: number } {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - MINI_SIZE.width - MARGIN),
    // 比工作区底部再抬一点，避开系统托盘
    y: Math.round(workArea.y + workArea.height - MINI_SIZE.height - MARGIN - 40),
    width: MINI_SIZE.width,
    height: MINI_SIZE.height,
  };
}

export interface MiniPayload {
  title: string;
  time: string;
}

/**
 * 弹出迷你提醒窗。已经有一个就复用，避免连响几条时叠一堆窗口。
 * 这是独立窗口，主窗口隐藏到托盘时它照样能出现（FR-9.2）。
 */
export function showMini(payload: MiniPayload): BrowserWindow {
  const bounds = boundsFor();

  if (mini && !mini.isDestroyed()) {
    mini.setBounds(bounds);
    void mini.loadURL(rendererUrl(payload));
    mini.showInactive();
    return mini;
  }

  mini = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mini.setAlwaysOnTop(true, 'floating');
  // 不抢焦点：用户可能正在别的窗口里打字
  mini.once('ready-to-show', () => mini?.showInactive());
  mini.on('closed', () => {
    mini = null;
  });

  void mini.loadURL(rendererUrl(payload));
  return mini;
}

function rendererUrl(payload: MiniPayload): string {
  const query = new URLSearchParams({ title: payload.title, time: payload.time }).toString();
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) return `${devUrl}/mini.html?${query}`;
  return `file://${join(__dirname, '../renderer/mini.html').replace(/\\/g, '/')}?${query}`;
}

export function closeMini(): void {
  if (mini && !mini.isDestroyed()) mini.close();
  mini = null;
}

export function getMini(): BrowserWindow | null {
  return mini && !mini.isDestroyed() ? mini : null;
}
