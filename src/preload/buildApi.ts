import type { IpcRenderer } from 'electron';
import { CHANNELS } from '../shared/ipc-contract';
import type { Category, OccurrenceView, Schedule } from '../shared/types';
import type { Period } from '../shared/periods';
import type { TodoItem } from '../shared/todo';
import type { Task } from '../main/repo/tasks';
import type { Countdown } from '../main/repo/countdowns';
import type { Reminder } from '../main/repo/reminders';
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
    setDone: (input: { id: string; occurrenceStart?: string; isDone: boolean }) => Promise<Schedule>;
    clearCategory: (input: { categoryId: string }) => Promise<number>;
  };
  periods: {
    list: () => Promise<Period[]>;
    replace: (input: { periods: Period[] }) => Promise<Period[]>;
  };
  countdowns: {
    list: (input: { today: string }) => Promise<Countdown[]>;
    create: (input: { title: string; targetDate: string; repeatYearly?: boolean }) => Promise<Countdown>;
    update: (input: { id: string; patch: Partial<Countdown> }) => Promise<Countdown>;
    remove: (input: { id: string }) => Promise<void>;
  };
  reminders: {
    get: (input: { scheduleId: string }) => Promise<Reminder | null>;
    set: (input: {
      scheduleId: string;
      offsetMinutes?: number | null;
      dayOffset?: number | null;
      atTime?: string | null;
    }) => Promise<Reminder | null>;
  };
  backup: {
    export: () => Promise<string | null>;
    import: () => Promise<string | null>;
    dataDir: () => Promise<string>;
    openFolder: () => Promise<void>;
  };
  system: {
    isLaunchAtLogin: () => Promise<boolean>;
    setLaunchAtLogin: (input: { enabled: boolean }) => Promise<boolean>;
    version: () => Promise<string>;
  };
  mini: {
    open: () => Promise<void>;
    close: () => Promise<void>;
  };
  settings: {
    get: (input: { key: string }) => Promise<string | null>;
    set: (input: { key: string; value: string }) => Promise<void>;
  };
  todo: {
    list: (input: { today: string; categoryId?: string | null; includeDone?: boolean }) => Promise<TodoItem[]>;
  };
  tasks: {
    create: (input: { title: string; categoryId?: string | null; note?: string | null }) => Promise<Task>;
    update: (input: {
      id: string;
      patch: { title?: string; categoryId?: string | null; note?: string | null };
    }) => Promise<Task>;
    setDone: (input: { id: string; isDone: boolean }) => Promise<Task>;
    remove: (input: { id: string }) => Promise<void>;
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
      setDone: (input) => ipc.invoke(CHANNELS.schedulesSetDone, input),
      clearCategory: (input) => ipc.invoke(CHANNELS.schedulesClearCategory, input),
    },
    periods: {
      list: () => ipc.invoke(CHANNELS.periodsList),
      replace: (input) => ipc.invoke(CHANNELS.periodsReplace, input),
    },
    countdowns: {
      list: (input) => ipc.invoke(CHANNELS.countdownsList, input),
      create: (input) => ipc.invoke(CHANNELS.countdownsCreate, input),
      update: (input) => ipc.invoke(CHANNELS.countdownsUpdate, input),
      remove: (input) => ipc.invoke(CHANNELS.countdownsDelete, input),
    },
    reminders: {
      get: (input) => ipc.invoke(CHANNELS.remindersGet, input),
      set: (input) => ipc.invoke(CHANNELS.remindersSet, input),
    },
    backup: {
      export: () => ipc.invoke(CHANNELS.backupExport),
      import: () => ipc.invoke(CHANNELS.backupImport),
      dataDir: () => ipc.invoke(CHANNELS.backupDataDir),
      openFolder: () => ipc.invoke(CHANNELS.backupOpenFolder),
    },
    system: {
      isLaunchAtLogin: () => ipc.invoke(CHANNELS.systemLaunchAtLoginGet),
      setLaunchAtLogin: (input) => ipc.invoke(CHANNELS.systemLaunchAtLoginSet, input),
      version: () => ipc.invoke(CHANNELS.systemVersion),
    },
    mini: {
      open: () => ipc.invoke(CHANNELS.miniOpen),
      close: () => ipc.invoke(CHANNELS.miniClose),
    },
    settings: {
      get: (input) => ipc.invoke(CHANNELS.settingsGet, input),
      set: (input) => ipc.invoke(CHANNELS.settingsSet, input),
    },
    todo: {
      list: (input) => ipc.invoke(CHANNELS.todoList, input),
    },
    tasks: {
      create: (input) => ipc.invoke(CHANNELS.tasksCreate, input),
      update: (input) => ipc.invoke(CHANNELS.tasksUpdate, input),
      setDone: (input) => ipc.invoke(CHANNELS.tasksSetDone, input),
      remove: (input) => ipc.invoke(CHANNELS.tasksDelete, input),
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