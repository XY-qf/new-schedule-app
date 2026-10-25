import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        // 两个渲染入口：主窗口 index.html、迷你提醒弹窗 mini.html
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          mini: resolve(__dirname, 'src/renderer/mini.html'),
        },
      },
    },
  },
});
