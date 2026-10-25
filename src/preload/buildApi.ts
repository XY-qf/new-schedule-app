import type { IpcRenderer } from 'electron';
import { CHANNELS } from '../shared/ipc-contract';
import type { Category, Schedule } from '../shared/types';
import type { ScheduleInput } from '../main/repo/schedules';

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
    listRange: (input: { start: string; end: string }) => Promise<unknown[]>;
    create: (input: ScheduleInput) => Promise<Schedule>;
    update: (input: { id: string; patch: Partial<ScheduleInput> }) => Promise<Schedule>;
    delete: (input: { id: string }) => Promise<void>;
  };
  window: {
    setView: (payload: { view: ViewName }) => Promise<unknown>;
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
      create: (input) => ipc.invoke(CHANNELS.schedulesCreate, input),
      update: (input) => ipc.invoke(CHANNELS.schedulesUpdate, input),
      delete: (input) => ipc.invoke(CHANNELS.schedulesDelete, input),
    },
    window: {
      setView: (payload) => ipc.invoke(CHANNELS.windowSetView, payload),
    },
  };
}