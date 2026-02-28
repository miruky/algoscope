import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, decodeState, encodeState, type AppState } from './state';

describe('encodeState / decodeState', () => {
  it('往復で状態が保たれる', () => {
    const s: AppState = {
      tab: 'search',
      sortAlgo: 'quick',
      sortKind: 'reversed',
      sortSize: 60,
      sortSeed: 999,
      searchAlgo: 'dijkstra',
      wall: 30,
      swamp: 5,
      searchSeed: 12345,
    };
    expect(decodeState(encodeState(s))).toEqual(s);
  });

  it('先頭の#があっても読める', () => {
    const s = { ...DEFAULT_STATE, sortSize: 50 };
    expect(decodeState(`#${encodeState(s)}`).sortSize).toBe(50);
  });

  it('空ハッシュは既定に戻る', () => {
    expect(decodeState('')).toEqual(DEFAULT_STATE);
  });

  it('不正な値や範囲外は既定や端へ丸める', () => {
    const s = decodeState('t=bogus&sa=nope&sk=weird&ss=999&gw=-5&gv=abc');
    expect(s.tab).toBe(DEFAULT_STATE.tab);
    expect(s.sortAlgo).toBe(DEFAULT_STATE.sortAlgo);
    expect(s.sortKind).toBe(DEFAULT_STATE.sortKind);
    expect(s.sortSize).toBe(80); // 上限へクランプ
    expect(s.wall).toBe(0); // 下限へクランプ
    expect(s.swamp).toBe(DEFAULT_STATE.swamp); // 数値でないので既定
  });
});
