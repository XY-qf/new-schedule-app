import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Notification,
  Tray,
  dialog,
} from 'electron';
import { APP_NAME } from '../shared/app-info';
import type { Db } from './db/driver';
import { summarizeMissed, startScheduler } from './notify/scheduler';

/**
 * 16×16 的托盘图标（暖白底 + 强调色圆角方块），内联成 base64，
 * 免得打包时还要单独处理资源路径。
 */
const TRAY_ICON =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAXklEQVR4nGNgoBAwogvY5Uz7j0/DoSlZKHoYidWIyyAmBgoBEzm2I+thQZfY0x2NV6NL6VJMF1ACWAjZQLIBe3B4AZfBTCRZRwsvMFHqAiYQgZ48iQFUS4kUZyaKAQBGqhzetUoTIwAAAABJRU5ErkJggg==';

let tray: Tray | null = null;
let stopScheduler: (() => void) | null = null;

export interface TrayOptions {
  onOpen: () => void;
  onCreateSchedule: () => void;
  onQuit: () => void;
}

export function createTray(options: TrayOptions): Tray {
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON}`);
  icon.setTemplateImage(false);

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  const menu = Menu.buildFromTemplate([
    { label: '打开主窗口', click: options.onOpen },
    { label: '新建日程', click: options.onCreateSchedule },
    { type: 'separator' },
    { label: '退出', click: options.onQuit },
  ]);
  tray.setContextMenu(menu);

  // 左键单击直接唤起窗口，比右键点菜单快
  tray.on('click', options.onOpen);

  return tray;
}

/** 真退出前的确认（FR-12.3）：退出后就收不到提醒了。 */
export async function confirmQuit(win: BrowserWindow | null): Promise<boolean> {
  const result = await dialog.showMessageBox(win ?? undefined!, {
    type: 'question',
    buttons: ['退出', '取消'],
    defaultId: 1,
    cancelId: 1,
    title: APP_NAME,
    message: '退出后将收不到提醒',
    detail: '确定要退出吗？',
  });
  return result.response === 0;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

/** 启动提醒轮询：到点弹系统通知；启动时把错过的合并成一条。 */
export function startNotifications(db: Db): void {
  stopScheduler = startScheduler(db, {
    onDue: (item) => {
      if (!Notification.isSupported()) return;
      new Notification({
        title: APP_NAME,
        body: item.title,
      }).show();
    },
    onMissed: (items) => {
      if (!Notification.isSupported()) return;
      new Notification({
        title: APP_NAME,
        body: summarizeMissed(items),
      }).show();
    },
  });
}

export function stopNotifications(): void {
  stopScheduler?.();
  stopScheduler = null;
}

/** 开机自启（FR-11.4）。 */
export function setLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled });
}

export function isLaunchAtLogin(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
