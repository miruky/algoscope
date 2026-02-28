// トレースの任意ステップにおける画面状態(フレーム)を初期状態から再構成する。
// 前方再生だけでなくスクラブ(任意位置への移動)と1ステップ巻き戻しを同じ仕組みで
// 扱えるようにするため、描画側は「カーソルを動かしてフレームを取り直す」だけにする。

import type { SortStep, SortTrace } from './sorts';
import type { SearchStep, SearchTrace } from './graphsearch';

export interface SortFrame {
  values: number[];
  done: Set<number>;
  /** ここまでに発生した比較・書き込みの累計(全体ではなく現在地まで) */
  comparisons: number;
  writes: number;
  /** 直前に適用したステップが指す強調。比較中の2要素 */
  compare?: [number, number];
  /** 直前に適用したステップが触れた要素(交換・書き込み) */
  touch?: number[];
}

/** ソートトレースを step 番目まで適用したフレームを返す。step は 0..steps.length に丸める。 */
export function sortFrameAt(trace: SortTrace, step: number): SortFrame {
  const k = clamp(step, trace.steps.length);
  const values = [...trace.initial];
  const done = new Set<number>();
  let comparisons = 0;
  let writes = 0;
  let compare: [number, number] | undefined;
  let touch: number[] | undefined;
  for (let idx = 0; idx < k; idx += 1) {
    const s = trace.steps[idx] as SortStep;
    compare = undefined;
    touch = undefined;
    if (s.type === 'compare') {
      comparisons += 1;
      compare = [s.i, s.j];
    } else if (s.type === 'swap') {
      writes += 2;
      const tmp = values[s.i] as number;
      values[s.i] = values[s.j] as number;
      values[s.j] = tmp;
      touch = [s.i, s.j];
    } else if (s.type === 'set') {
      writes += 1;
      values[s.i] = s.value;
      touch = [s.i];
    } else {
      done.add(s.i);
    }
  }
  return { values, done, comparisons, writes, compare, touch };
}

export type CellClass = 'visited' | 'frontier' | 'path';

export interface SearchFrame {
  /** セル番号 → 現在の状態。frontier→visited→path と上書きされ最後の状態が残る */
  classes: Map<number, CellClass>;
  /** ここまでに訪問(visit)したセル数 */
  visited: number;
  /** 直前に適用したステップが触れたセル(着目の脈動に使う) */
  active?: number;
}

/** 探索トレースを step 番目まで適用したフレームを返す。step は 0..steps.length に丸める。 */
export function searchFrameAt(trace: SearchTrace, step: number): SearchFrame {
  const k = clamp(step, trace.steps.length);
  const classes = new Map<number, CellClass>();
  let visited = 0;
  let active: number | undefined;
  for (let idx = 0; idx < k; idx += 1) {
    const s = trace.steps[idx] as SearchStep;
    if (s.type === 'visit') visited += 1;
    classes.set(s.cell, s.type === 'visit' ? 'visited' : s.type);
    active = s.cell;
  }
  return { classes, visited, active };
}

function clamp(step: number, length: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(Math.round(step), length));
}
