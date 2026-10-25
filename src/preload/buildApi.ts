import type { IpcRenderer } from 'electron';

export type ViewName = 'calendar' | 'todo';

export interface Api {
  window: {
    setView: (payload: { view: ViewName }) => Promise<unknown>;
  };
}

/** 纯函数：注入 ipcRenderer 生成 api 对象，便于不启动 Electron 也能测。 */
export function buildApi(ipc: Pick<IpcRenderer, 'invoke'>): Api {
  return {
    window: {
      setView: (payload) => ipc.invoke('window:setView', payload),
    },
  };
}