// 各アルゴリズムの短い解説と計算量。画面で「いま何を見ているか」を補うためのデータ。
// 文章は誇張せず、性質と向き不向きを実務的に書く。

import type { SortAlgorithmId } from './sorts';
import type { SearchAlgorithmId } from './graphsearch';

export interface SortInfo {
  /** 平均計算量(一覧の見出しと揃える) */
  average: string;
  /** 最悪計算量 */
  worst: string;
  /** 追加メモリ */
  space: string;
  /** 安定ソートか */
  stable: boolean;
  desc: string;
}

export const SORT_INFO: Record<SortAlgorithmId, SortInfo> = {
  bubble: {
    average: 'O(n^2)',
    worst: 'O(n^2)',
    space: 'O(1)',
    stable: true,
    desc: '隣り合う要素を比較し、大きい方を後ろへ送る操作を端まで繰り返す。実装は単純だが交換が多い。一巡して交換が起きなければ整列済みとみなして打ち切る。',
  },
  selection: {
    average: 'O(n^2)',
    worst: 'O(n^2)',
    space: 'O(1)',
    stable: false,
    desc: '未確定範囲から最小値を選び、先頭へ置く。比較は常にn(n-1)/2回だが、交換はn-1回に抑えられるため書き込みコストが高い場面で有利。',
  },
  insertion: {
    average: 'O(n^2)',
    worst: 'O(n^2)',
    space: 'O(1)',
    stable: true,
    desc: '手札を並べるように、各要素を整列済み部分の正しい位置へ差し込む。ほぼ整列済みの入力では比較も移動も少なく、実際にとても速い。',
  },
  merge: {
    average: 'O(n log n)',
    worst: 'O(n log n)',
    space: 'O(n)',
    stable: true,
    desc: '半分ずつに分けて整列し、二つの整列列を併合する。最悪でもO(n log n)を保証し安定だが、併合のための作業用配列を要する。',
  },
  quick: {
    average: 'O(n log n)',
    worst: 'O(n^2)',
    space: 'O(log n)',
    stable: false,
    desc: 'ピボットを境に小さい群と大きい群へ分割し、各群を再帰的に整列する。平均は高速だが、偏った分割が続くと最悪O(n^2)に落ちる。',
  },
  heap: {
    average: 'O(n log n)',
    worst: 'O(n log n)',
    space: 'O(1)',
    stable: false,
    desc: '配列を二分ヒープに組み、根の最大値を末尾へ取り出しては再整形する。追加メモリなしで最悪O(n log n)を保証する。',
  },
};

export interface SearchInfo {
  /** 時間計算量(本実装に即した表記) */
  time: string;
  /** 最短性の保証 */
  optimal: string;
  desc: string;
}

export const SEARCH_INFO: Record<SearchAlgorithmId, SearchInfo> = {
  bfs: {
    time: 'O(V+E)',
    optimal: '手数の最短',
    desc: 'キューを使い、近いマスから順に外側へ広げる。辺の重みを見ないため、沼があっても手数(マス数)が最小の経路を見つける。',
  },
  dfs: {
    time: 'O(V+E)',
    optimal: '保証なし',
    desc: 'スタックを使い、行けるところまで進んでから戻る。経路は見つかるが遠回りになりやすく、最短である保証はない。',
  },
  dijkstra: {
    time: 'O(V^2)',
    optimal: 'コストの最短',
    desc: '確定済みのうち累計コストが最小のマスから広げる。沼の重みを考慮し、総コストが最小の経路を保証する。',
  },
  astar: {
    time: 'O(V^2)',
    optimal: 'コストの最短',
    desc: '実コストgとゴールまでの推定hの和f=g+hで評価し、ゴール方向を優先して広げる。推定が許容的なら最短コストを保ちつつ訪問数を減らせる。',
  },
};
