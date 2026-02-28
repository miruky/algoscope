import { describe, expect, it } from 'vitest';
import { mulberry32, randomSeed } from './random';

describe('mulberry32', () => {
  it('同じseedからは同じ列を返す', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = Array.from({ length: 6 }, () => a());
    const seqB = Array.from({ length: 6 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('違うseedでは列が分かれる', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('0以上1未満を返す', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 200; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randomSeed', () => {
  it('32bit範囲の整数を返す', () => {
    for (let i = 0; i < 50; i += 1) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
