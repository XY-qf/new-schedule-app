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
  // 托盘常驻后「关闭 = 隐藏」；测试里必须能真退出，否则下一条用例会被单实例锁挡住。
  env.AI_TODO_TEST_QUIT_ON_CLOSE = '1';
  return env;
}

/**
 * 150% 缩放下 Electron 会把窗口尺寸取整，实测 1000 → 1002、700 → 702。
 * 所以断言尺寸用容差，而不是精确相等。
 */
const TOLERANCE = 4;

test('启动即为日历尺寸，切到待办变窄', async () => {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();

  const size = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.getContentBounds(),
  );
  expect(Math.abs(size.width - 1000)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(size.height - 700)).toBeLessThanOrEqual(TOLERANCE);

  await page.getByRole('tab', { name: '待办' }).click();

  await expect
    .poll(async () => {
      const b = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.getContentBounds(),
      );
      return `${Math.abs(b.width - 400) <= TOLERANCE && Math.abs(b.height - 822) <= TOLERANCE}`;
    })
    .toBe('true');

  await app.close();
});

test('最大化后切到待办，窗口仍是窄形态（FR-5.2.6）', async () => {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: '最大化' }).click();
  await expect
    .poll(async () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized()))
    .toBe(true);
  await expect(page.getByRole('button', { name: '还原' })).toBeVisible();

  await page.getByRole('tab', { name: '待办' }).click();

  await expect
    .poll(async () => {
      const b = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.getContentBounds(),
      );
      return `${Math.abs(b.width - 400) <= TOLERANCE}`;
    })
    .toBe('true');

  const stillMaximized = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.isMaximized(),
  );
  expect(stillMaximized).toBe(false);

  // 切回日历：它自己之前被最大化过，应当恢复最大化（FR-5.2.6）
  await page.getByRole('tab', { name: '日历' }).click();
  await expect
    .poll(async () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isMaximized()))
    .toBe(true);

  await app.close();
});

