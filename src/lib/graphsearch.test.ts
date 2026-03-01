import { describe, it, expect } from 'vitest';
import { makeGrid, traceSearch, SWAMP_COST, type Grid } from './graphsearch';

// 決定的な迷路を作るためのmulberry32相当の乱数
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gridOf(rows: string[]): Grid {
  // 記号: S=start G=goal #=壁 ~=沼 .=空
  const cols = rows[0]?.length ?? 0;
  const walls = new Set<number>();
  const swamps = new Set<number>();
  let start = 0;
  let goal = 0;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const cell = y * cols + x;
      if (ch === '#') walls.add(cell);
      if (ch === '~') swamps.add(cell);
      if (ch === 'S') start = cell;
      if (ch === 'G') goal = cell;
    });
  });
  return { cols, rows: rows.length, walls, swamps, start, goal };
}

describe('traceSearch', () => {
  it('BFSは重みなしの最短経路を見つける', () => {
    const grid = gridOf(['S..', '.#.', '..G']);
    const result = traceSearch('bfs', grid);
    expect(result.found).toBe(true);
    expect(result.pathLength).toBe(5); // S含む5マス(4手)
  });

  it('DFSも経路は見つけるが最短とは限らない', () => {
    const grid = gridOf(['S..', '...', '..G']);
    const bfs = traceSearch('bfs', grid);
    const dfs = traceSearch('dfs', grid);
    expect(dfs.found).toBe(true);
    expect(dfs.pathLength).toBeGreaterThanOrEqual(bfs.pathLength);
  });

  it('ダイクストラ法は沼を避けてコスト最小の経路を選ぶ', () => {
    const grid = gridOf(['S~G', '...']);
    const result = traceSearch('dijkstra', grid);
    expect(result.found).toBe(true);
    // 直進(コスト5+1=6)より回り道(1*4=4)が安い
    expect(result.cost).toBe(4);
    expect(result.pathLength).toBe(5);
  });

  it('BFSは沼を考慮しない(手数だけ見る)', () => {
    const grid = gridOf(['S~G', '...']);
    const result = traceSearch('bfs', grid);
    expect(result.pathLength).toBe(3);
    expect(result.cost).toBe(SWAMP_COST + 1);
  });

  it('到達不能なら found=false', () => {
    const grid = gridOf(['S#G']);
    for (const algorithm of ['bfs', 'dfs', 'dijkstra', 'astar'] as const) {
      const result = traceSearch(algorithm, grid);
      expect(result.found).toBe(false);
      expect(result.cost).toBe(Infinity);
    }
  });

  it('A*はダイクストラ法と同じ最小コストの経路に到達する', () => {
    const grid = gridOf(['S~G', '...']);
    const astar = traceSearch('astar', grid);
    const dijkstra = traceSearch('dijkstra', grid);
    expect(astar.found).toBe(true);
    expect(astar.cost).toBe(dijkstra.cost);
    expect(astar.cost).toBe(4); // 沼の直進(6)より回り道(4)
  });

  it('A*はゴール方向を優先し、ダイクストラ法より訪問が増えない', () => {
    const grid = makeGrid(20, 14, 0.1, 0.1, seededRandom(11));
    const astar = traceSearch('astar', grid);
    const dijkstra = traceSearch('dijkstra', grid);
    if (!astar.found || !dijkstra.found) return;
    expect(astar.cost).toBe(dijkstra.cost);
    expect(astar.visited).toBeLessThanOrEqual(dijkstra.visited);
  });

  it('トレースはvisit・frontier・pathの整合が取れている', () => {
    const grid = gridOf(['S..', '..G']);
    const result = traceSearch('bfs', grid);
    const visits = result.steps.filter((s) => s.type === 'visit').length;
    const paths = result.steps.filter((s) => s.type === 'path').length;
    expect(visits).toBe(result.visited);
    expect(paths).toBe(result.pathLength);
    expect(result.steps[0]).toEqual({ type: 'visit', cell: grid.start });
  });
});

describe('makeGrid', () => {
  it('startとgoalは壁にならない', () => {
    let calls = 0;
    const alwaysWall = () => {
      calls += 1;
      return 0;
    };
    const grid = makeGrid(8, 6, 0.9, 0, alwaysWall);
    expect(grid.walls.has(grid.start)).toBe(false);
    expect(grid.walls.has(grid.goal)).toBe(false);
    expect(calls).toBeGreaterThan(0);
  });

  it('壁と沼は重ならない', () => {
    const grid = makeGrid(10, 10, 0.2, 0.2);
    for (const swamp of grid.swamps) {
      expect(grid.walls.has(swamp)).toBe(false);
    }
  });
});
