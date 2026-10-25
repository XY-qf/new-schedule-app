import type { IpcRenderer } from 'electron';
import { CHANNELS } from '../shared/ipc-contract';
import type { Category, OccurrenceView, Schedule } from '../shared/types';
import type { ScheduleInput } from '../main/repo/schedules';
import type { RecurrenceDraft } from '../shared/recurrence';

export type ViewName = 'calendar' | 'todo';

export interface Api {
  categories: {
    list: () => Promise<Category[]>;
    create: (input: { name: string; color: string }) => Promise<Category>;
    update: (patch: {
      id: string;
      name?: string;
      color?: string;
      remindEnabled?: boolean;
    }) => Promise<Category>;
    delete: (input: {
      id: string;
      strategy: 'move' | 'deleteItems';
      moveToId?: string;
    }) => Promise<void>;
  };
  schedules: {
    listRange: (input: { start: string; end: string }) => Promise<OccurrenceView[]>;
    get: (input: { id: string }) => Promise<Schedule>;
    create: (
      input: ScheduleInput & { recurrence?: RecurrenceDraft | null },
    ) => Promise<Schedule>;
    update: (input: {
      id: string;
      patch: Partial<ScheduleInput> & { isDone?: boolean };
      /** M2 用：只改这一次 / 改整个序列 */
      scope?: 'one' | 'series';
      occurrenceStart?: string;
    }) => Promise<Schedule>;
    delete: (input: {
      id: string;
      scope?: 'one' | 'series';
      occurrenceStart?: string;
    }) => Promise<void>;
  };
  window: {
    setView: (payload: { view: ViewName }) => Promise<{ maximized: boolean } | null>;
    minimize: () => Promise<void>;
    maximizeToggle: () => Promise<boolean | null>;
    isMaximized: () => Promise<boolean>;
    closeToTray: () => Promise<void>;
  };
}

/** 纯函数：注入 ipcRenderer 生成 api 对象，便于不启动 Electron 也能测。 */
export function buildApi(ipc: Pick<IpcRenderer, 'invoke'>): Api {
  return {
    categories: {
      list: () => ipc.invoke(CHANNELS.categoriesList),
      create: (input) => ipc.invoke(CHANNELS.categoriesCreate, input),
      update: (patch) => ipc.invoke(CHANNELS.categoriesUpdate, patch),
      delete: (input) => ipc.invoke(CHANNELS.categoriesDelete, input),
    },
    schedules: {
      listRange: (input) => ipc.invoke(CHANNELS.schedulesListRange, input),
      get: (input) => ipc.invoke(CHANNELS.schedulesGet, input),
      create: (input) => ipc.invoke(CHANNELS.schedulesCreate, input),
      update: (input) => ipc.invoke(CHANNELS.schedulesUpdate, input),
      delete: (input) => ipc.invoke(CHANNELS.schedulesDelete, input),
    },
    window: {
      setView: (payload) => ipc.invoke(CHANNELS.windowSetView, payload),
      minimize: () => ipc.invoke(CHANNELS.windowMinimize),
      maximizeToggle: () => ipc.invoke(CHANNELS.windowMaximizeToggle),
      isMaximized: () => ipc.invoke(CHANNELS.windowIsMaximized),
      closeToTray: () => ipc.invoke(CHANNELS.windowCloseToTray),
    },
  };
}