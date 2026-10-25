import type { Api } from '../../preload/buildApi';

declare global {
  interface Window {
    api?: Api;
  }
}

export {};