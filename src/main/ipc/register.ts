import { BrowserWindow, ipcMain, screen } from 'electron';
import { CHANNELS } from '../../shared/ipc-contract';
import type { Db } from '../db/driver';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../repo/categories';
import {
  createSchedule,
  deleteSchedule,
  deleteSchedulesByCategory,
  getSchedule,
  setScheduleDone,
  updateSchedule,
  type ScheduleInput,
} from '../repo/schedules';
import { listOccurrenceViews } from '../service/calendar';
import { upsertException } from '../repo/exceptions';
import { listPeriods, replacePeriods, type Period } from '../repo/periods';
import { closeMini } from '../miniWindow';
import { backupBeforeRestore, exportBackup } from '../backup';
import { isLaunchAtLogin, setLaunchAtLogin } from '../tray';
import { app, dialog, shell } from 'electron';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createTask, deleteTask, setTaskDone, updateTask } from '../repo/tasks';
import { listTodoItems } from '../service/todo';
import { createCountdown, deleteCountdown, listCountdowns, updateCountdown } from '../repo/countdowns';
import { getSetting, setSetting } from '../repo/settings';
import { deleteReminder, listReminders, upsertReminder } from '../repo/reminders';
import { boundsForView, type Rect, type ViewName } from '../window/bounds';

function dbFile(): string {
  return join(app.getPath('userData'), 'data', 'app.db');
}

export function registerIpcHandlers(db: Db): void {
  ipcMain.handle(CHANNELS.categoriesList, () => listCategories(db));
  ipcMain.handle(CHANNELS.categoriesCreate, (_e, input: { name: string; color: string }) =>
    createCategory(db, input),
  );
  ipcMain.handle(
    CHANNELS.categoriesUpdate,
    (_e, patch: { id: string; name?: string; color?: string; remindEnabled?: boolean }) =>
      updateCategory(db, patch),
  );
  ipcMain.handle(
    CHANNELS.categoriesDelete,
    (_e, input: { id: string; strategy: 'move' | 'deleteItems'; moveToId?: string }) => {
      deleteCategory(db, input);
    },
  );

  ipcMain.handle(
    CHANNELS.schedulesListRange,
    (_e, range: { start: string; end: string }) =>
      listOccurrenceViews(db, range.start, range.end),
  );
  ipcMain.handle(CHANNELS.schedulesGet, (_e, payload: { id: string }) =>
    getSchedule(db, payload.id),
  );
  ipcMain.handle(CHANNELS.schedulesCreate, (_e, input: ScheduleInput) =>
    createSchedule(db, input),
  );
  ipcMain.handle(
    CHANNELS.schedulesUpdate,
    (
      _e,
      payload: {
        id: string;
        patch: Partial<ScheduleInput>;
        scope?: 'one' | 'series';
        occurrenceStart?: string;
      },
    ) => {
      // 「只改这一次」不碰日程行，写成例外；「改整个序列」才动原行。
      if (payload.scope === 'one' && payload.occurrenceStart) {
        upsertException(db, {
          scheduleId: payload.id,
          occurrenceStart: payload.occurrenceStart,
          override: {
            ...(payload.patch.title !== undefined ? { title: payload.patch.title } : {}),
            ...(payload.patch.startAt !== undefined ? { startAt: payload.patch.startAt } : {}),
            ...(payload.patch.endAt !== undefined ? { endAt: payload.patch.endAt } : {}),
          },
        });
        return getSchedule(db, payload.id);
      }
      return updateSchedule(db, payload.id, payload.patch);
    },
  );
  ipcMain.handle(
    CHANNELS.schedulesDelete,
    (_e, payload: { id: string; scope?: 'one' | 'series'; occurrenceStart?: string }) => {
      if (payload.scope === 'one' && payload.occurrenceStart) {
        upsertException(db, {
          scheduleId: payload.id,
          occurrenceStart: payload.occurrenceStart,
          isDeleted: true,
        });
        return;
      }
      deleteSchedule(db, payload.id);
    },
  );

  ipcMain.handle(CHANNELS.schedulesClearCategory, (_e, payload: { categoryId: string }) =>
    deleteSchedulesByCategory(db, payload.categoryId),
  );

  ipcMain.handle(CHANNELS.periodsList, () => listPeriods(db));
  ipcMain.handle(CHANNELS.periodsReplace, (_e, payload: { periods: Period[] }) => {
    replacePeriods(db, payload.periods);
    return listPeriods(db);
  });

  ipcMain.handle(
    CHANNELS.todoList,
    (
      _e,
      payload: { today: string; categoryId?: string | null; includeDone?: boolean },
    ) => listTodoItems(db, payload),
  );
  ipcMain.handle(
    CHANNELS.tasksCreate,
    (_e, input: { title: string; categoryId?: string | null; note?: string | null }) =>
      createTask(db, input),
  );
  ipcMain.handle(
    CHANNELS.tasksUpdate,
    (_e, payload: { id: string; patch: { title?: string; categoryId?: string | null; note?: string | null } }) =>
      updateTask(db, payload.id, payload.patch),
  );
  ipcMain.handle(
    CHANNELS.tasksSetDone,
    (_e, payload: { id: string; isDone: boolean }) => setTaskDone(db, payload.id, payload.isDone),
  );
  ipcMain.handle(CHANNELS.tasksDelete, (_e, payload: { id: string }) => {
    deleteTask(db, payload.id);
  });

  ipcMain.handle(
    CHANNELS.schedulesSetDone,
    (
      _e,
      payload: { id: string; occurrenceStart?: string; isDone: boolean },
    ) => setScheduleDone(db, payload.id, payload.isDone, payload.occurrenceStart),
  );

  ipcMain.handle(CHANNELS.countdownsList, (_e, payload: { today: string }) =>
    listCountdowns(db, payload.today),
  );
  ipcMain.handle(
    CHANNELS.countdownsCreate,
    (
      _e,
      input: { title: string; targetDate: string; repeatYearly?: boolean; note?: string | null },
    ) => createCountdown(db, input),
  );
  ipcMain.handle(
    CHANNELS.countdownsUpdate,
    (_e, payload: { id: string; patch: Parameters<typeof updateCountdown>[2] }) =>
      updateCountdown(db, payload.id, payload.patch),
  );
  ipcMain.handle(CHANNELS.countdownsDelete, (_e, payload: { id: string }) => {
    deleteCountdown(db, payload.id);
  });
  ipcMain.handle(CHANNELS.remindersGet, (_e, payload: { scheduleId: string }) => {
    const all = listReminders(db, payload.scheduleId);
    return all[0] ?? null;
  });
  ipcMain.handle(
    CHANNELS.remindersSet,
    (
      _e,
      payload: {
        scheduleId: string;
        offsetMinutes?: number | null;
        dayOffset?: number | null;
        atTime?: string | null;
      },
    ) => {
      // 传 null 表示「不提醒」，把这条日程的提醒删掉
      if (payload.offsetMinutes == null && payload.dayOffset == null) {
        deleteReminder(db, payload.scheduleId);
        return null;
      }
      return upsertReminder(db, payload);
    },
  );

  ipcMain.handle(CHANNELS.backupDataDir, () => dirname(dbFile()));
  ipcMain.handle(CHANNELS.backupOpenFolder, () => {
    void shell.openPath(dirname(dbFile()));
  });
  ipcMain.handle(CHANNELS.backupExport, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = await dialog.showOpenDialog(win ?? undefined!, {
      title: '选择备份保存位置',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (picked.canceled || picked.filePaths.length === 0) return null;
    return exportBackup(db, dbFile(), picked.filePaths[0]!);
  });
  ipcMain.handle(CHANNELS.backupImport, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = await dialog.showOpenDialog(win ?? undefined!, {
      title: '选择要恢复的备份文件',
      properties: ['openFile'],
      filters: [{ name: '数据库备份', extensions: ['db'] }],
    });
    if (picked.canceled || picked.filePaths.length === 0) return null;

    // 恢复前先把当前库留一份，误操作还能退回
    const safety = backupBeforeRestore(db, dbFile());
    db.close();
    copyFileSync(picked.filePaths[0]!, dbFile());
    return `已恢复。当前数据已备份到 ${safety}，请重启应用。`;
  });
  ipcMain.handle(CHANNELS.systemLaunchAtLoginGet, () => isLaunchAtLogin());
  ipcMain.handle(CHANNELS.systemLaunchAtLoginSet, (_e, payload: { enabled: boolean }) => {
    setLaunchAtLogin(payload.enabled);
    return isLaunchAtLogin();
  });
  ipcMain.handle(CHANNELS.systemVersion, () => app.getVersion());

  ipcMain.handle(CHANNELS.miniClose, () => {
    closeMini();
  });
  ipcMain.handle(CHANNELS.miniOpen, (event) => {
    closeMini();
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.id !== event.sender.id);
    const main = win ?? BrowserWindow.getAllWindows()[0];
    if (main) {
      if (main.isMinimized()) main.restore();
      main.show();
      main.focus();
    }
  });

  ipcMain.handle(CHANNELS.settingsGet, (_e, payload: { key: string }) => getSetting(db, payload.key));
  ipcMain.handle(CHANNELS.settingsSet, (_e, payload: { key: string; value: string }) => {
    setSetting(db, payload.key, payload.value);
  });

  ipcMain.handle(CHANNELS.windowSetView, (event, payload: { view: ViewName }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    // 记下当前视图的最大化状态，切过去之后要能还原（FR-5.2.6）。
    maximizedByView.set(currentView, win.isMaximized());

    // Windows 上对最大化窗口直接 setContentBounds 不可靠，先还原再设尺寸。
    if (win.isMaximized()) win.unmaximize();

    const display = screen.getDisplayMatching(win.getBounds());
    const target = boundsForView(payload.view, { workArea: display.workArea }, win.getContentBounds());
    win.setMinimumSize(380, 480);

    // FR-5.2.6：目标视图自己也被最大化过时，切回来要恢复最大化。
    const restoreMax = isMaximizedFor(payload.view);
    if (restoreMax) {
      animateBounds(win, target, () => win.maximize());
    } else {
      animateBounds(win, target);
    }

    currentView = payload.view;
    return { bounds: target, maximized: restoreMax };
  });

  ipcMain.handle(CHANNELS.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle(CHANNELS.windowMaximizeToggle, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    if (win.isMaximized()) {
      win.unmaximize();
      maximizedByView.set(currentView, false);
    } else {
      win.maximize();
      maximizedByView.set(currentView, true);
    }
    return win.isMaximized();
  });

  ipcMain.handle(CHANNELS.windowIsMaximized, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });

  // M1 没有托盘：关闭 = 真正退出（否则窗口藏起来后用户再也没有入口找回）。
  // M4 落地托盘后，这里改成 hide()，并配合「退出后收不到提醒」的确认。
  ipcMain.handle(CHANNELS.windowCloseToTray, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

/** 视图 → 是否最大化。切回来的时候按这个恢复。 */
const maximizedByView = new Map<ViewName, boolean>();
let currentView: ViewName = 'calendar';

function isMaximizedFor(view: ViewName): boolean {
  return maximizedByView.get(view) ?? false;
}

export { isMaximizedFor };

/** 约 180ms 的窗口尺寸补间，避免切换视图时硬跳变（FR-5.2.1）。 */
function animateBounds(win: BrowserWindow, target: Rect, onDone?: () => void): void {
  const from = win.getContentBounds();
  const steps = 12;

  if (
    from.x === target.x &&
    from.y === target.y &&
    from.width === target.width &&
    from.height === target.height
  ) {
    onDone?.();
    return;
  }

  let step = 0;
  const timer = setInterval(() => {
    step += 1;
    const t = step / steps;
    const ease = 1 - (1 - t) ** 3;

    if (step >= steps || win.isDestroyed()) {
      clearInterval(timer);
      if (!win.isDestroyed()) {
        win.setContentBounds(target);
        onDone?.();
      }
      return;
    }

    win.setContentBounds({
      x: Math.round(from.x + (target.x - from.x) * ease),
      y: Math.round(from.y + (target.y - from.y) * ease),
      width: Math.round(from.width + (target.width - from.width) * ease),
      height: Math.round(from.height + (target.height - from.height) * ease),
    });
  }, 15);
}