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
import { boundsForView, type Rect, type ViewName } from '../window/bounds';

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

    // 记下当前视图的最大化状态，切过去之后要能还原（FR-5.2.6）。
    maximizedByView.set(currentView, win.isMaximized());

    // Windows 上对最大化窗口直接 setContentBounds 不可靠，先还原再设尺寸。
    if (win.isMaximized()) win.unmaximize();

    const display = screen.getDisplayMatching(win.getBounds());
    const target = boundsForView(payload.view, { workArea: display.workArea }, win.getContentBounds());
    win.setMinimumSize(380, 480);
    animateBounds(win, target);

    currentView = payload.view;
    return { bounds: target, maximized: false };
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
function animateBounds(win: BrowserWindow, target: Rect): void {
  const from = win.getContentBounds();
  const steps = 12;

  if (
    from.x === target.x &&
    from.y === target.y &&
    from.width === target.width &&
    from.height === target.height
  ) {
    return;
  }

  let step = 0;
  const timer = setInterval(() => {
    step += 1;
    const t = step / steps;
    const ease = 1 - (1 - t) ** 3;

    if (step >= steps || win.isDestroyed()) {
      clearInterval(timer);
      if (!win.isDestroyed()) win.setContentBounds(target);
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