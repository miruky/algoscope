import { describe, expect, it } from 'vitest';
import { SEARCH_INFO, SORT_INFO } from './algoinfo';
import { SORT_ALGORITHMS } from './sorts';
import { SEARCH_ALGORITHMS } from './graphsearch';

describe('algoinfo', () => {
  it('すべてのソートに解説と計算量がある', () => {
    for (const a of SORT_ALGORITHMS) {
      const info = SORT_INFO[a.id];
      expect(info, a.id).toBeDefined();
      expect(info.desc.length).toBeGreaterThan(20);
      expect(info.average).toMatch(/^O\(/);
      expect(info.worst).toMatch(/^O\(/);
      expect(info.space).toMatch(/^O\(/);
    }
  });

  it('一覧の平均計算量と解説の平均計算量が一致する', () => {
    for (const a of SORT_ALGORITHMS) {
      expect(SORT_INFO[a.id].average, a.id).toBe(a.order);
    }
  });

  it('すべての探索に解説と最短性の記載がある', () => {
    for (const a of SEARCH_ALGORITHMS) {
      const info = SEARCH_INFO[a.id];
      expect(info, a.id).toBeDefined();
      expect(info.desc.length).toBeGreaterThan(20);
      expect(info.optimal.length).toBeGreaterThan(0);
      expect(info.time).toMatch(/^O\(/);
    }
  });
});
