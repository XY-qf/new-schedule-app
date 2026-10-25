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
  updateSchedule,
  type ScheduleInput,
} from '../repo/schedules';
import { listOccurrenceViews } from '../service/calendar';
import { boundsForView, type ViewName } from '../window/bounds';

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
  ipcMain.handle(CHANNELS.schedulesCreate, (_e, input: ScheduleInput) =>
    createSchedule(db, input),
  );
  ipcMain.handle(
    CHANNELS.schedulesUpdate,
    (_e, payload: { id: string; patch: Partial<ScheduleInput> }) =>
      updateSchedule(db, payload.id, payload.patch),
  );
  ipcMain.handle(CHANNELS.schedulesDelete, (_e, payload: { id: string }) => {
    deleteSchedule(db, payload.id);
  });

  ipcMain.handle(CHANNELS.windowSetView, (event, payload: { view: ViewName }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    const display = screen.getDisplayMatching(win.getBounds());
    const next = boundsForView(payload.view, { workArea: display.workArea }, win.getContentBounds());
    win.setContentBounds(next);
    return next;
  });

  ipcMain.handle(CHANNELS.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle(CHANNELS.windowMaximizeToggle, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });

  // FR-12.1：关闭按钮 = 缩到托盘，不是退出。托盘本体在 M4，这里先隐藏窗口。
  ipcMain.handle(CHANNELS.windowCloseToTray, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide();
  });
}