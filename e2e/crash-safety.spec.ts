import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';

const requireCjs = createRequire(__filename);
const electronPath = requireCjs('electron') as unknown as string;
const appRoot = join(__dirname, '..');
const USER_DATA = join(appRoot, '.tmp', 'ai-todo-crash');

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue;
    env[k] = v;
  }
  env.AI_TODO_USER_DATA = USER_DATA;
  env.AI_TODO_TEST_QUIT_ON_CLOSE = '1';
  return env;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

test('强杀进程后重启，已写入的数据仍在', async () => {
  rmSync(USER_DATA, { recursive: true, force: true });
  mkdirSync(USER_DATA, { recursive: true });

  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const day = fmt(monday);

  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot, '--no-sandbox'],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();
  await page.waitForTimeout(600);

  await page.evaluate(
    async ({ d }) => {
      const api = (window as unknown as { api: any }).api;
      const cats = await api.categories.list();
      await api.schedules.create({
        title: '强杀前写入的日程',
        categoryId: cats[0].id,
        timeType: 'range',
        isAllDay: false,
        startAt: `${d}T09:00:00`,
        endAt: `${d}T10:00:00`,
      });
    },
    { d: day },
  );
  await page.waitForTimeout(400);

  // 跳过 will-quit / db.close()：app.exit() 立即终止，不跑清理逻辑，
  // 等价于进程被外部强杀后数据库没有走正常关闭。
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});

  // 强杀后单实例锁可能短暂残留，重启要带重试（真实用户重开也是这个路径）。
  let app2: Awaited<ReturnType<typeof electron.launch>> | null = null;
  for (let attempt = 0; attempt < 8 && !app2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      app2 = await electron.launch({
        executablePath: electronPath,
        args: [appRoot, '--no-sandbox'],
        env: cleanEnv(),
      });
    } catch {
      app2 = null;
    }
  }
  if (!app2) throw new Error('强杀后 8 秒内无法重新启动应用');

  const page2 = await app2.firstWindow();
  await page2.waitForTimeout(900);

  await expect(page2.getByText('强杀前写入的日程')).toBeVisible();
  await app2.close();
});
