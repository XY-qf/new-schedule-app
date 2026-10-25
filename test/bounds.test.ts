import { describe, it, expect } from 'vitest';
import { VIEW_SIZE, boundsForView } from '../src/main/window/bounds';

const fullHd = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };

describe('boundsForView', () => {
  it('日历与待办各有固定尺寸', () => {
    expect(VIEW_SIZE.calendar).toEqual({ width: 1000, height: 700 });
    expect(VIEW_SIZE.todo).toEqual({ width: 400, height: 822 });
  });

  it('不给上次位置时居中于工作区', () => {
    const r = boundsForView('calendar', fullHd);
    expect(r.width).toBe(1000);
    expect(r.x).toBe(460); // (1920-1000)/2
    expect(r.y).toBe(170); // (1040-700)/2
  });

  it('切换视图保持中心点不变', () => {
    const prev = { x: 460, y: 170, width: 1000, height: 700 };
    const r = boundsForView('todo', fullHd, prev);
    expect(r.width).toBe(400);
    expect(r.x + r.width / 2).toBeCloseTo(prev.x + prev.width / 2, 0);
    expect(r.y + r.height / 2).toBeCloseTo(prev.y + prev.height / 2, 0);
  });

  it('小屏幕上被夹回工作区内，不跑到屏幕外', () => {
    const small = { workArea: { x: 0, y: 0, width: 1280, height: 720 } };
    const r = boundsForView('calendar', small);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(1280);
    expect(r.y + r.height).toBeLessThanOrEqual(720);
  });

  it('副屏有偏移时按副屏工作区居中', () => {
    const second = { workArea: { x: 1920, y: 0, width: 1920, height: 1040 } };
    const r = boundsForView('todo', second);
    expect(r.x).toBe(1920 + (1920 - 400) / 2);
  });
});

describe('boundsForView · 多显示器与缩放边界', () => {
  it('左侧副屏（负坐标）也按该屏工作区居中', () => {
    const left = { workArea: { x: -1920, y: 0, width: 1920, height: 1040 } };
    const r = boundsForView('calendar', left);
    expect(r.x).toBe(-1920 + (1920 - 1000) / 2);
    expect(r.y).toBe(170);
  });

  it('工作区高度不足时收缩高度，不溢出任务栏', () => {
    // 待办视图高 822，1366x768 的工作区只有 728 高，必须收缩到 728。
    const small = { workArea: { x: 0, y: 0, width: 1366, height: 728 } };
    const r = boundsForView('todo', small);
    expect(r.height).toBe(728);
    expect(r.y).toBe(0);
  });

  it('反复切换不会越切越小（尺寸恒定）', () => {
    const area = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
    let prev = boundsForView('calendar', area);
    for (let i = 0; i < 10; i += 1) {
      prev = boundsForView('todo', area, prev);
      prev = boundsForView('calendar', area, prev);
    }
    expect(prev.width).toBe(1000);
    expect(prev.height).toBe(700);
  });
});
