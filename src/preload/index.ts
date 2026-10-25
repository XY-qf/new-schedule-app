import { contextBridge, ipcRenderer } from 'electron';
import { buildApi } from './buildApi';

contextBridge.exposeInMainWorld('api', buildApi(ipcRenderer));