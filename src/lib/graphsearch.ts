// グリッド上のグラフ探索。BFS・DFS・ダイクストラ法を同じトレース形式で記録する。
// セルは index = y * cols + x で表す。壁は通れず、重みは「沼」セルで5になる。

export interface Grid {
  cols: number;
  rows: number;
  walls: Set<number>;
  swamps: Set<number>;
  start: number;
  goal: number;
}

export type SearchStep =
  | { type: 'frontier'; cell: number }
  | { type: 'visit'; cell: number }
  | { type: 'path'; cell: number };

export interface SearchTrace {
  algorithm: string;
  steps: SearchStep[];
  found: boolean;
  pathLength: number;
  /** 経路の総コスト(重みつき)。見つからなければ Infinity */
  cost: number;
  visited: number;
}

export type SearchAlgorithmId = 'bfs' | 'dfs' | 'dijkstra';

export const SEARCH_ALGORITHMS: { id: SearchAlgorithmId; label: string; note: string }[] = [
  { id: 'bfs', label: '幅優先探索', note: '重みなしの最短経路' },
  { id: 'dfs', label: '深さ優先探索', note: '最短とは限らない' },
  { id: 'dijkstra', label: 'ダイクストラ法', note: '重みつきの最短経路' },
];

export const SWAMP_COST = 5;

function neighbors(grid: Grid, cell: number): number[] {
  const x = cell % grid.cols;
  const y = Math.floor(cell / grid.cols);
  const out: number[] = [];
  if (y > 0) out.push(cell - grid.cols);
  if (x < grid.cols - 1) out.push(cell + 1);
  if (y < grid.rows - 1) out.push(cell + grid.cols);
  if (x > 0) out.push(cell - 1);
  return out.filter((n) => !grid.walls.has(n));
}

function cellCost(grid: Grid, cell: number): number {
  return grid.swamps.has(cell) ? SWAMP_COST : 1;
}

function buildPath(
  cameFrom: Map<number, number>,
  grid: Grid,
  steps: SearchStep[],
): { length: number; cost: number } {
  const path: number[] = [];
  let current = grid.goal;
  while (current !== grid.start) {
    path.push(current);
    const prev = cameFrom.get(current);
    if (prev === undefined) return { length: 0, cost: Infinity };
    current = prev;
  }
  path.push(grid.start);
  path.reverse();
  let cost = 0;
  for (const cell of path) {
    steps.push({ type: 'path', cell });
    if (cell !== grid.start) cost += cellCost(grid, cell);
  }
  return { length: path.length, cost };
}

function searchWithQueue(grid: Grid, algorithm: 'bfs' | 'dfs'): SearchTrace {
  const steps: SearchStep[] = [];
  const cameFrom = new Map<number, number>();
  const seen = new Set<number>([grid.start]);
  const queue: number[] = [grid.start];
  let visited = 0;
  let found = false;

  while (queue.length > 0) {
    const current = algorithm === 'bfs' ? (queue.shift() as number) : (queue.pop() as number);
    steps.push({ type: 'visit', cell: current });
    visited += 1;
    if (current === grid.goal) {
      found = true;
      break;
    }
    for (const next of neighbors(grid, current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      cameFrom.set(next, current);
      steps.push({ type: 'frontier', cell: next });
      queue.push(next);
    }
  }

  const path = found ? buildPath(cameFrom, grid, steps) : { length: 0, cost: Infinity };
  return {
    algorithm,
    steps,
    found,
    pathLength: path.length,
    cost: path.cost,
    visited,
  };
}

function dijkstra(grid: Grid): SearchTrace {
  const steps: SearchStep[] = [];
  const cameFrom = new Map<number, number>();
  const dist = new Map<number, number>([[grid.start, 0]]);
  const done = new Set<number>();
  let visited = 0;
  let found = false;

  for (;;) {
    let current = -1;
    let best = Infinity;
    for (const [cell, d] of dist) {
      if (!done.has(cell) && d < best) {
        best = d;
        current = cell;
      }
    }
    if (current === -1) break;
    done.add(current);
    steps.push({ type: 'visit', cell: current });
    visited += 1;
    if (current === grid.goal) {
      found = true;
      break;
    }
    for (const next of neighbors(grid, current)) {
      if (done.has(next)) continue;
      const candidate = best + cellCost(grid, next);
      if (candidate < (dist.get(next) ?? Infinity)) {
        dist.set(next, candidate);
        cameFrom.set(next, current);
        steps.push({ type: 'frontier', cell: next });
      }
    }
  }

  const path = found ? buildPath(cameFrom, grid, steps) : { length: 0, cost: Infinity };
  return {
    algorithm: 'dijkstra',
    steps,
    found,
    pathLength: path.length,
    cost: path.cost,
    visited,
  };
}

/** グリッドに対して探索を実行し、訪問順のトレースを返す。 */
export function traceSearch(algorithm: SearchAlgorithmId, grid: Grid): SearchTrace {
  if (grid.walls.has(grid.start) || grid.walls.has(grid.goal)) {
    return { algorithm, steps: [], found: false, pathLength: 0, cost: Infinity, visited: 0 };
  }
  return algorithm === 'dijkstra' ? dijkstra(grid) : searchWithQueue(grid, algorithm);
}

/** ランダムな壁と沼を持つグリッドを作る。startとgoalは必ず空ける。 */
export function makeGrid(
  cols: number,
  rows: number,
  wallRatio: number,
  swampRatio: number,
  random: () => number = Math.random,
): Grid {
  const start = Math.floor(rows / 2) * cols;
  const goal = Math.floor(rows / 2) * cols + (cols - 1);
  const walls = new Set<number>();
  const swamps = new Set<number>();
  for (let cell = 0; cell < cols * rows; cell += 1) {
    if (cell === start || cell === goal) continue;
    const roll = random();
    if (roll < wallRatio) walls.add(cell);
    else if (roll < wallRatio + swampRatio) swamps.add(cell);
  }
  return { cols, rows, walls, swamps, start, goal };
}
