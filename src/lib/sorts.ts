// ソートアルゴリズム。実行そのものではなく「操作の列(トレース)」を生成し、
// 可視化側はトレースを1ステップずつ適用して描画する。

export type SortStep =
  | { type: 'compare'; i: number; j: number }
  | { type: 'swap'; i: number; j: number }
  | { type: 'set'; i: number; value: number }
  | { type: 'done'; i: number };

export interface SortTrace {
  algorithm: string;
  initial: number[];
  steps: SortStep[];
  comparisons: number;
  writes: number;
}

export type SortAlgorithmId = 'bubble' | 'selection' | 'insertion' | 'merge' | 'quick' | 'heap';

export const SORT_ALGORITHMS: { id: SortAlgorithmId; label: string; order: string }[] = [
  { id: 'bubble', label: 'バブルソート', order: 'O(n^2)' },
  { id: 'selection', label: '選択ソート', order: 'O(n^2)' },
  { id: 'insertion', label: '挿入ソート', order: 'O(n^2)' },
  { id: 'merge', label: 'マージソート', order: 'O(n log n)' },
  { id: 'quick', label: 'クイックソート', order: 'O(n log n)' },
  { id: 'heap', label: 'ヒープソート', order: 'O(n log n)' },
];

class Recorder {
  steps: SortStep[] = [];
  comparisons = 0;
  writes = 0;

  constructor(public values: number[]) {}

  compare(i: number, j: number): number {
    this.comparisons += 1;
    this.steps.push({ type: 'compare', i, j });
    return (this.values[i] as number) - (this.values[j] as number);
  }

  swap(i: number, j: number): void {
    if (i === j) return;
    this.writes += 2;
    this.steps.push({ type: 'swap', i, j });
    const tmp = this.values[i] as number;
    this.values[i] = this.values[j] as number;
    this.values[j] = tmp;
  }

  set(i: number, value: number): void {
    this.writes += 1;
    this.steps.push({ type: 'set', i, value });
    this.values[i] = value;
  }

  done(i: number): void {
    this.steps.push({ type: 'done', i });
  }
}

function bubble(r: Recorder): void {
  const n = r.values.length;
  for (let end = n - 1; end > 0; end -= 1) {
    let swapped = false;
    for (let i = 0; i < end; i += 1) {
      if (r.compare(i, i + 1) > 0) {
        r.swap(i, i + 1);
        swapped = true;
      }
    }
    r.done(end);
    if (!swapped) break;
  }
  r.done(0);
}

function selection(r: Recorder): void {
  const n = r.values.length;
  for (let i = 0; i < n - 1; i += 1) {
    let min = i;
    for (let j = i + 1; j < n; j += 1) {
      if (r.compare(j, min) < 0) min = j;
    }
    r.swap(i, min);
    r.done(i);
  }
  r.done(n - 1);
}

function insertion(r: Recorder): void {
  const n = r.values.length;
  for (let i = 1; i < n; i += 1) {
    const value = r.values[i] as number;
    let j = i - 1;
    while (j >= 0) {
      r.comparisons += 1;
      r.steps.push({ type: 'compare', i: j, j: j + 1 });
      if ((r.values[j] as number) <= value) break;
      r.set(j + 1, r.values[j] as number);
      j -= 1;
    }
    r.set(j + 1, value);
  }
  for (let i = 0; i < n; i += 1) r.done(i);
}

function merge(r: Recorder): void {
  const aux = [...r.values];
  const sort = (lo: number, hi: number): void => {
    if (hi - lo <= 1) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid);
    sort(mid, hi);
    for (let k = lo; k < hi; k += 1) aux[k] = r.values[k] as number;
    let i = lo;
    let j = mid;
    for (let k = lo; k < hi; k += 1) {
      let take: number;
      if (i >= mid) {
        take = aux[j++] as number;
      } else if (j >= hi) {
        take = aux[i++] as number;
      } else {
        r.comparisons += 1;
        r.steps.push({ type: 'compare', i, j });
        take =
          (aux[i] as number) <= (aux[j] as number) ? (aux[i++] as number) : (aux[j++] as number);
      }
      r.set(k, take);
    }
  };
  sort(0, r.values.length);
  for (let i = 0; i < r.values.length; i += 1) r.done(i);
}

function quick(r: Recorder): void {
  const sort = (lo: number, hi: number): void => {
    if (lo >= hi) {
      if (lo === hi) r.done(lo);
      return;
    }
    const pivot = r.values[hi] as number;
    let p = lo;
    for (let i = lo; i < hi; i += 1) {
      r.comparisons += 1;
      r.steps.push({ type: 'compare', i, j: hi });
      if ((r.values[i] as number) < pivot) {
        r.swap(i, p);
        p += 1;
      }
    }
    r.swap(p, hi);
    r.done(p);
    sort(lo, p - 1);
    sort(p + 1, hi);
  };
  sort(0, r.values.length - 1);
}

function heap(r: Recorder): void {
  const n = r.values.length;
  const siftDown = (start: number, end: number): void => {
    let root = start;
    for (;;) {
      const child = root * 2 + 1;
      if (child > end) return;
      let target = child;
      if (child + 1 <= end && r.compare(child, child + 1) < 0) target = child + 1;
      if (r.compare(root, target) >= 0) return;
      r.swap(root, target);
      root = target;
    }
  };
  for (let start = (n >> 1) - 1; start >= 0; start -= 1) siftDown(start, n - 1);
  for (let end = n - 1; end > 0; end -= 1) {
    r.swap(0, end);
    r.done(end);
    siftDown(0, end - 1);
  }
  r.done(0);
}

const IMPLS: Record<SortAlgorithmId, (r: Recorder) => void> = {
  bubble,
  selection,
  insertion,
  merge,
  quick,
  heap,
};

/** 配列のコピーに対してアルゴリズムを実行し、操作トレースを返す。 */
export function traceSort(algorithm: SortAlgorithmId, values: number[]): SortTrace {
  const recorder = new Recorder([...values]);
  IMPLS[algorithm](recorder);
  return {
    algorithm,
    initial: [...values],
    steps: recorder.steps,
    comparisons: recorder.comparisons,
    writes: recorder.writes,
  };
}

/** トレースを配列に適用する(可視化のリプレイ用)。stepCountまで進めた配列を返す。 */
export function replay(trace: SortTrace, stepCount: number): number[] {
  const values = [...trace.initial];
  for (const step of trace.steps.slice(0, stepCount)) {
    if (step.type === 'swap') {
      const tmp = values[step.i] as number;
      values[step.i] = values[step.j] as number;
      values[step.j] = tmp;
    } else if (step.type === 'set') {
      values[step.i] = step.value;
    }
  }
  return values;
}

export type DatasetKind = 'random' | 'nearly-sorted' | 'reversed' | 'few-unique';

/** 可視化用のデータ列を作る。決定的にしたい場合はseed付き乱数を渡す。 */
export function makeDataset(
  kind: DatasetKind,
  size: number,
  random: () => number = Math.random,
): number[] {
  const base = Array.from({ length: size }, (_, i) => i + 1);
  if (kind === 'reversed') return base.reverse();
  if (kind === 'few-unique') {
    return Array.from({ length: size }, () => (Math.floor(random() * 5) + 1) * Math.ceil(size / 5));
  }
  // Fisher-Yates
  for (let i = base.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = base[i] as number;
    base[i] = base[j] as number;
    base[j] = tmp;
  }
  if (kind === 'nearly-sorted') {
    base.sort((a, b) => a - b);
    const swaps = Math.max(1, Math.floor(size / 10));
    for (let k = 0; k < swaps; k += 1) {
      const i = Math.floor(random() * (size - 1));
      const tmp = base[i] as number;
      base[i] = base[i + 1] as number;
      base[i + 1] = tmp;
    }
  }
  return base;
}
