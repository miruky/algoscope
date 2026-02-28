import { describe, expect, it } from 'vitest';
import { searchFrameAt, sortFrameAt } from './frames';
import { traceSort } from './sorts';
import { makeGrid, traceSearch } from './graphsearch';

describe('sortFrameAt', () => {
  it('step 0 は初期配列そのもので強調なし', () => {
    const trace = traceSort('bubble', [3, 1, 2]);
    const frame = sortFrameAt(trace, 0);
    expect(frame.values).toEqual([3, 1, 2]);
    expect(frame.comparisons).toBe(0);
    expect(frame.writes).toBe(0);
    expect(frame.compare).toBeUndefined();
    expect(frame.touch).toBeUndefined();
  });

  it('最終ステップは整列済みで全要素が確定する', () => {
    const trace = traceSort('quick', [5, 3, 8, 1, 9, 2]);
    const frame = sortFrameAt(trace, trace.steps.length);
    expect(frame.values).toEqual([1, 2, 3, 5, 8, 9]);
    expect(frame.done.size).toBe(6);
  });

  it('累計の比較・書き込みは最終ステップでトレース合計と一致する', () => {
    const trace = traceSort('insertion', [4, 2, 7, 1, 3]);
    const frame = sortFrameAt(trace, trace.steps.length);
    expect(frame.comparisons).toBe(trace.comparisons);
    expect(frame.writes).toBe(trace.writes);
  });

  it('累計は単調に増え、現在地までしか数えない', () => {
    const trace = traceSort('selection', [9, 4, 6, 1, 8, 3]);
    let prevComparisons = 0;
    let prevWrites = 0;
    for (let k = 0; k <= trace.steps.length; k += 1) {
      const frame = sortFrameAt(trace, k);
      expect(frame.comparisons).toBeGreaterThanOrEqual(prevComparisons);
      expect(frame.writes).toBeGreaterThanOrEqual(prevWrites);
      prevComparisons = frame.comparisons;
      prevWrites = frame.writes;
    }
  });

  it('巻き戻し(k-1)は前進(k)から1ステップだけ違う配列になる', () => {
    const trace = traceSort('heap', [2, 8, 5, 1, 9, 4, 7]);
    const mid = Math.floor(trace.steps.length / 2);
    const back = sortFrameAt(trace, mid - 1);
    const forward = sortFrameAt(trace, mid);
    const diff = forward.values.filter((v, i) => v !== back.values[i]).length;
    expect(diff).toBeLessThanOrEqual(2); // 交換は最大2要素
  });

  it('範囲外の step は端に丸める', () => {
    const trace = traceSort('bubble', [2, 1]);
    expect(sortFrameAt(trace, -10).values).toEqual([2, 1]);
    expect(sortFrameAt(trace, 9999).values).toEqual([1, 2]);
  });
});

describe('searchFrameAt', () => {
  it('step 0 は何も塗られていない', () => {
    const grid = makeGrid(8, 6, 0, 0, () => 0.99);
    const trace = traceSearch('bfs', grid);
    const frame = searchFrameAt(trace, 0);
    expect(frame.classes.size).toBe(0);
    expect(frame.visited).toBe(0);
  });

  it('最終フレームの訪問数はトレースのvisitedと一致する', () => {
    const grid = makeGrid(10, 8, 0.2, 0.1, mulberryLike(5));
    const trace = traceSearch('dijkstra', grid);
    const frame = searchFrameAt(trace, trace.steps.length);
    expect(frame.visited).toBe(trace.visited);
  });

  it('経路セルは最終フレームでpathクラスになる', () => {
    const grid = makeGrid(8, 6, 0.1, 0.1, mulberryLike(2));
    const trace = traceSearch('bfs', grid);
    if (!trace.found) return;
    const frame = searchFrameAt(trace, trace.steps.length);
    const pathCells = [...frame.classes.values()].filter((c) => c === 'path').length;
    expect(pathCells).toBe(trace.pathLength);
  });

  it('同じセルは後の状態で上書きされる(frontier→visited)', () => {
    const grid = makeGrid(6, 6, 0, 0, () => 0.99);
    const trace = traceSearch('bfs', grid);
    const frame = searchFrameAt(trace, trace.steps.length);
    // 開始セルは visit のみ
    expect(frame.classes.get(grid.start)).not.toBe('frontier');
  });
});

// テスト用の決定的な乱数(mulberry32相当)
function mulberryLike(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
