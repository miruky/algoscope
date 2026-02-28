// 画面の状態をURLハッシュと相互変換する。共有・ブックマーク・リロード復元のため。
// 壊れた値や範囲外は黙って既定へ戻し、URLが多少壊れても画面が落ちないようにする。

import { SORT_ALGORITHMS, type DatasetKind, type SortAlgorithmId } from './sorts';
import { SEARCH_ALGORITHMS, type SearchAlgorithmId } from './graphsearch';

export type TabId = 'sort' | 'search';

export interface AppState {
  tab: TabId;
  sortAlgo: SortAlgorithmId;
  sortKind: DatasetKind;
  sortSize: number;
  sortSeed: number;
  searchAlgo: SearchAlgorithmId;
  wall: number;
  swamp: number;
  searchSeed: number;
}

const DATASET_KINDS: DatasetKind[] = ['random', 'nearly-sorted', 'reversed', 'few-unique'];
const SORT_IDS = SORT_ALGORITHMS.map((a) => a.id);
const SEARCH_IDS = SEARCH_ALGORITHMS.map((a) => a.id);

export const DEFAULT_STATE: AppState = {
  tab: 'sort',
  sortAlgo: 'bubble',
  sortKind: 'random',
  sortSize: 40,
  sortSeed: 1,
  searchAlgo: 'bfs',
  wall: 25,
  swamp: 15,
  searchSeed: 1,
};

function oneOf<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return value !== null && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function clampInt(value: string | null, lo: number, hi: number, fallback: number): number {
  const n = Number(value);
  if (value === null || !Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export function encodeState(s: AppState): string {
  const p = new URLSearchParams();
  p.set('t', s.tab);
  p.set('sa', s.sortAlgo);
  p.set('sk', s.sortKind);
  p.set('ss', String(s.sortSize));
  p.set('sd', String(s.sortSeed));
  p.set('ga', s.searchAlgo);
  p.set('gw', String(s.wall));
  p.set('gv', String(s.swamp));
  p.set('gd', String(s.searchSeed));
  return p.toString();
}

export function decodeState(hash: string): AppState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  return {
    tab: oneOf<TabId>(p.get('t'), ['sort', 'search'], DEFAULT_STATE.tab),
    sortAlgo: oneOf(p.get('sa'), SORT_IDS, DEFAULT_STATE.sortAlgo),
    sortKind: oneOf(p.get('sk'), DATASET_KINDS, DEFAULT_STATE.sortKind),
    sortSize: clampInt(p.get('ss'), 10, 80, DEFAULT_STATE.sortSize),
    sortSeed: clampInt(p.get('sd'), 0, 0xffffffff, DEFAULT_STATE.sortSeed),
    searchAlgo: oneOf(p.get('ga'), SEARCH_IDS, DEFAULT_STATE.searchAlgo),
    wall: clampInt(p.get('gw'), 0, 40, DEFAULT_STATE.wall),
    swamp: clampInt(p.get('gv'), 0, 40, DEFAULT_STATE.swamp),
    searchSeed: clampInt(p.get('gd'), 0, 0xffffffff, DEFAULT_STATE.searchSeed),
  };
}
