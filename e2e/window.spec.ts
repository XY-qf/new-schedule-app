import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const appRoot = join(__dirname, '..');
const requireCjs = createRequire(__filename);
const electronPath = requireCjs('electron') as unknown as string;

/** 若宿主环境设了 ELECTRON_RUN_AS_NODE，Electron 会以纯 Node 启动、拿不到 app，必须剥掉。 */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toUpperCase() === 'ELECTRON_RUN_AS_NODE' || value === undefined) continue;
    env[key] = value;
  }
  return env;
}

test('启动即为日历尺寸，切到待办变窄', async () => {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();

  const size = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return w!.getContentBounds();
  });
  expect(size.width).toBe(1000);
  expect(size.height).toBe(700);

  await page.getByRole('tab', { name: '待办' }).click();

  await expect
    .poll(async () => {
      const b = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.getContentBounds(),
      );
      return `${b.width}x${b.height}`;
    })
    .toBe('400x822');

  await app.close();
});
