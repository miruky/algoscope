import { describe, it, expect } from 'vitest';
import { SORT_ALGORITHMS, makeDataset, replay, traceSort, type SortAlgorithmId } from './sorts';

// テストを決定的にするための単純な線形合同法
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ALGORITHM_IDS = SORT_ALGORITHMS.map((a) => a.id);

describe('traceSort', () => {
  it.each(ALGORITHM_IDS)('%s はリプレイ結果が昇順になる', (id: SortAlgorithmId) => {
    const data = makeDataset('random', 40, seeded(7));
    const trace = traceSort(id, data);
    const final = replay(trace, trace.steps.length);
    expect(final).toEqual([...data].sort((a, b) => a - b));
  });

  it.each(ALGORITHM_IDS)('%s は元配列を破壊しない', (id: SortAlgorithmId) => {
    const data = makeDataset('reversed', 20);
    const copy = [...data];
    traceSort(id, data);
    expect(data).toEqual(copy);
  });

  it('比較・書き込み回数を数える', () => {
    const trace = traceSort('bubble', [3, 2, 1]);
    expect(trace.comparisons).toBeGreaterThan(0);
    expect(trace.writes).toBeGreaterThan(0);
  });

  it('整列済み入力ではバブルソートが早期終了する', () => {
    const sorted = traceSort('bubble', [1, 2, 3, 4, 5, 6, 7, 8]);
    const reversed = traceSort('bubble', [8, 7, 6, 5, 4, 3, 2, 1]);
    expect(sorted.comparisons).toBeLessThan(reversed.comparisons);
  });

  it('重複の多い入力(few-unique)も正しく整列する', () => {
    const data = makeDataset('few-unique', 30, seeded(3));
    const trace = traceSort('quick', data);
    expect(replay(trace, trace.steps.length)).toEqual([...data].sort((a, b) => a - b));
  });

  it('途中までのリプレイは操作の前半だけを反映する', () => {
    const trace = traceSort('selection', [3, 1, 2]);
    expect(replay(trace, 0)).toEqual([3, 1, 2]);
    const mid = replay(trace, Math.floor(trace.steps.length / 2));
    expect(mid).toHaveLength(3);
  });
});

describe('makeDataset', () => {
  it('random は1..nの順列', () => {
    const data = makeDataset('random', 25, seeded(1));
    expect([...data].sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it('reversed は降順', () => {
    expect(makeDataset('reversed', 5)).toEqual([5, 4, 3, 2, 1]);
  });

  it('nearly-sorted はほぼ昇順(転倒数が少ない)', () => {
    const data = makeDataset('nearly-sorted', 50, seeded(9));
    let inversions = 0;
    for (let i = 0; i < data.length - 1; i += 1) {
      if ((data[i] as number) > (data[i + 1] as number)) inversions += 1;
    }
    expect(inversions).toBeGreaterThan(0);
    expect(inversions).toBeLessThanOrEqual(10);
  });
});
