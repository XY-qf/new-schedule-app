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
  getSchedule,
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
  ipcMain.handle(CHANNELS.schedulesGet, (_e, payload: { id: string }) =>
    getSchedule(db, payload.id),
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

    // Windows 上对最大化窗口直接 setContentBounds 不可靠，先还原再设尺寸（FR-5.2.6）。
    if (win.isMaximized()) win.unmaximize();

    const display = screen.getDisplayMatching(win.getBounds());
    const next = boundsForView(payload.view, { workArea: display.workArea }, win.getContentBounds());
    win.setMinimumSize(Math.min(400, next.width), Math.min(400, next.height));
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

  // M1 没有托盘：关闭 = 真正退出（否则窗口藏起来后用户再也没有入口找回）。
  // M4 落地托盘后，这里改成 hide()，并配合「退出后收不到提醒」的确认。
  ipcMain.handle(CHANNELS.windowCloseToTray, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}