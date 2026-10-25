import { describe, expect, it } from 'vitest';
import { layoutColumns } from '../src/renderer/src/calendar/layoutColumns';

const PX = 0.8; // 48px / 60min

describe('layoutColumns', () => {
  it('不重叠时各自满宽', () => {
    const out = layoutColumns(
      [
        { id: 'a', startMin: 480, endMin: 575 },
        { id: 'b', startMin: 600, endMin: 695 },
      ],
      PX,
      18,
    );
    expect(out.every((e) => e.widthRatio === 1 && e.leftRatio === 0)).toBe(true);
  });

  it('两个重叠各占一半', () => {
    const out = layoutColumns(
      [
        { id: 'a', startMin: 480, endMin: 600 },
        { id: 'b', startMin: 540, endMin: 660 },
      ],
      PX,
      18,
    );
    expect(out.find((e) => e.id === 'a')!.widthRatio).toBeCloseTo(0.5);
    expect(out.find((e) => e.id === 'b')!.leftRatio).toBeCloseTo(0.5);
  });

  it('三个两两重叠各占三分之一', () => {
    const out = layoutColumns(
      [
        { id: 'a', startMin: 480, endMin: 600 },
        { id: 'b', startMin: 540, endMin: 660 },
        { id: 'c', startMin: 570, endMin: 690 },
      ],
      PX,
      18,
    );
    for (const e of out) expect(e.widthRatio).toBeCloseTo(1 / 3);
  });

  it('重叠链里不相交的可以复用列', () => {
    const out = layoutColumns(
      [
        { id: 'a', startMin: 540, endMin: 600 },
        { id: 'b', startMin: 570, endMin: 630 },
        { id: 'c', startMin: 615, endMin: 660 },
      ],
      PX,
      18,
    );
    expect(out.find((e) => e.id === 'c')!.widthRatio).toBeCloseTo(0.5);
    expect(out.find((e) => e.id === 'c')!.leftRatio).toBeCloseTo(0);
  });

  it('极短事件被拉到最小高度，top 仍然准确', () => {
    const out = layoutColumns([{ id: 'a', startMin: 480, endMin: 481 }], PX, 18);
    expect(out[0]!.heightPx).toBe(18);
    expect(out[0]!.topPx).toBeCloseTo(384);
  });
});