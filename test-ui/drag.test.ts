import { describe, expect, it } from 'vitest';
import {
  clockToMinutes,
  isDragStarted,
  minutesToClock,
  pxToMinutes,
  resolveDrag,
  snapMinutes,
} from '../src/renderer/src/calendar/drag';

describe('拖拽防误触（T25）', () => {
  const base = {
    originX: 100,
    originY: 100,
    originTime: 1000,
    x: 100,
    y: 100,
    time: 1000,
  };

  it('只移动不按够时间：不算拖拽', () => {
    expect(isDragStarted({ ...base, x: 120, time: 1100 })).toBe(false);
  });

  it('按够时间但没移动：不算拖拽', () => {
    expect(isDragStarted({ ...base, time: 1500 })).toBe(false);
  });

  it('移动 3px 且按够时间：仍不算（阈值是 4px）', () => {
    expect(isDragStarted({ ...base, x: 103, time: 1500 })).toBe(false);
  });

  it('移动 5px 且按住 200ms：算拖拽', () => {
    expect(isDragStarted({ ...base, x: 105, time: 1200 })).toBe(true);
  });

  it('斜向移动按欧氏距离算', () => {
    expect(isDragStarted({ ...base, x: 103, y: 103, time: 1500 })).toBe(true);
  });
});

describe('时间吸附与夹取', () => {
  it('吸附到 5 分钟', () => {
    expect(snapMinutes(62)).toBe(60);
    expect(snapMinutes(63)).toBe(65);
    expect(snapMinutes(0)).toBe(0);
  });

  it('拖动后保持时长不变', () => {
    const result = resolveDrag(8 * 60, 95, 60);
    expect(result).toEqual({ startMin: 9 * 60, endMin: 9 * 60 + 95 });
  });

  it('不允许拖到 0 点之前', () => {
    expect(resolveDrag(30, 60, -120).startMin).toBe(0);
  });

  it('不允许拖过一天结束', () => {
    const result = resolveDrag(23 * 60, 60, 240);
    expect(result.endMin).toBe(24 * 60);
    expect(result.startMin).toBe(23 * 60);
  });

  it('极短日程拖完至少保留 15 分钟', () => {
    const result = resolveDrag(600, 5, 0);
    expect(result.endMin - result.startMin).toBe(15);
  });

  it('像素换算成分钟', () => {
    expect(pxToMinutes(48, 48)).toBe(60);
    expect(pxToMinutes(24, 48)).toBe(30);
  });

  it('时刻与分钟的互转', () => {
    expect(clockToMinutes('08:30')).toBe(510);
    expect(minutesToClock(510)).toBe('08:30');
    expect(minutesToClock(23 * 60 + 59)).toBe('23:59');
  });
});
