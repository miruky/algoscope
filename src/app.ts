// 画面の組み立て。アルゴリズム本体は src/lib にあり、ここではトレースの再生
// (rAFループ)とSVGの差分更新だけを行う。

import {
  SORT_ALGORITHMS,
  makeDataset,
  traceSort,
  type DatasetKind,
  type SortAlgorithmId,
  type SortTrace,
} from './lib/sorts';
import {
  SEARCH_ALGORITHMS,
  makeGrid,
  traceSearch,
  type Grid,
  type SearchAlgorithmId,
  type SearchTrace,
} from './lib/graphsearch';

const SVG_NS = 'http://www.w3.org/2000/svg';

const BRAND_MARK =
  '<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="34" width="9" height="22" rx="2" fill="currentColor"/><rect x="20" y="22" width="9" height="34" rx="2" fill="var(--accent)"/><rect x="32" y="42" width="9" height="14" rx="2" fill="currentColor"/><rect x="44" y="10" width="9" height="46" rx="2" fill="currentColor" fill-opacity="0.55"/></svg>';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** rAFでトレースを進める再生器。speedはフレームあたりのステップ数。 */
class Player {
  private handle = 0;
  playing = false;

  constructor(
    private advance: (count: number) => boolean,
    private onStateChange: () => void,
  ) {}

  speed = 2;

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.onStateChange();
    const tick = () => {
      if (!this.playing) return;
      if (!this.advance(this.speed)) {
        this.pause();
        return;
      }
      this.handle = requestAnimationFrame(tick);
    };
    this.handle = requestAnimationFrame(tick);
  }

  pause(): void {
    this.playing = false;
    cancelAnimationFrame(this.handle);
    this.onStateChange();
  }
}

interface SortView {
  refresh: () => void;
}

function buildSortView(section: HTMLElement): SortView {
  section.innerHTML = `
    <div class="controls">
      <label>アルゴリズム
        <select id="sort-algo">
          ${SORT_ALGORITHMS.map((a) => `<option value="${a.id}">${esc(a.label)} ${a.order}</option>`).join('')}
        </select>
      </label>
      <label>データ
        <select id="sort-kind">
          <option value="random">ランダム</option>
          <option value="nearly-sorted">ほぼ整列済み</option>
          <option value="reversed">逆順</option>
          <option value="few-unique">重複が多い</option>
        </select>
      </label>
      <label>要素数 <output id="sort-size-out">40</output>
        <input id="sort-size" type="range" min="10" max="80" value="40" />
      </label>
      <button type="button" id="sort-new" class="ghost">新しいデータ</button>
    </div>
    <div class="stage"><svg id="sort-svg" viewBox="0 0 720 240" role="img" aria-label="ソートの様子を表す棒グラフ"><title>ソートの様子</title></svg></div>
    <div class="player-row">
      <button type="button" id="sort-play" class="primary">再生</button>
      <button type="button" id="sort-step" class="ghost">1ステップ</button>
      <button type="button" id="sort-reset" class="ghost">リセット</button>
      <label class="speed">速度
        <input id="sort-speed" type="range" min="1" max="30" value="2" />
      </label>
      <p id="sort-stats" class="stats" role="status"></p>
    </div>`;

  const algoEl = section.querySelector('#sort-algo') as HTMLSelectElement;
  const kindEl = section.querySelector('#sort-kind') as HTMLSelectElement;
  const sizeEl = section.querySelector('#sort-size') as HTMLInputElement;
  const sizeOutEl = section.querySelector('#sort-size-out') as HTMLOutputElement;
  const svg = section.querySelector('#sort-svg') as SVGSVGElement;
  const playEl = section.querySelector('#sort-play') as HTMLButtonElement;
  const statsEl = section.querySelector('#sort-stats') as HTMLParagraphElement;

  let data = makeDataset('random', 40);
  let trace: SortTrace;
  let values: number[] = [];
  let cursor = 0;
  let bars: SVGRectElement[] = [];
  let done = new Set<number>();

  const W = 720;
  const H = 240;

  function rebuildBars(): void {
    svg.innerHTML = '<title>ソートの様子</title>';
    bars = values.map((v, i) => {
      const rect = document.createElementNS(SVG_NS, 'rect');
      const bw = W / values.length;
      rect.setAttribute('x', String(i * bw + 1));
      rect.setAttribute('width', String(Math.max(1, bw - 2)));
      rect.setAttribute('rx', '2');
      rect.setAttribute('class', 'bar');
      setBar(rect, v);
      svg.appendChild(rect);
      return rect;
    });
  }

  function setBar(rect: SVGRectElement, value: number): void {
    const max = values.length;
    const h = Math.max(3, (value / max) * (H - 8));
    rect.setAttribute('y', String(H - h));
    rect.setAttribute('height', String(h));
  }

  function paint(highlight: { compare?: [number, number]; touch?: number[] } = {}): void {
    bars.forEach((rect, i) => {
      setBar(rect, values[i] as number);
      let cls = 'bar';
      if (done.has(i)) cls += ' done';
      if (highlight.compare?.includes(i)) cls += ' compare';
      if (highlight.touch?.includes(i)) cls += ' touch';
      rect.setAttribute('class', cls);
    });
    statsEl.textContent = `ステップ ${cursor} / ${trace.steps.length} ・ 比較 ${trace.comparisons} ・ 書き込み ${trace.writes}`;
  }

  function advance(count: number): boolean {
    let highlight: { compare?: [number, number]; touch?: number[] } = {};
    for (let k = 0; k < count && cursor < trace.steps.length; k += 1) {
      const step = trace.steps[cursor] as SortTrace['steps'][number];
      if (step.type === 'compare') highlight = { compare: [step.i, step.j] };
      else if (step.type === 'swap') {
        const tmp = values[step.i] as number;
        values[step.i] = values[step.j] as number;
        values[step.j] = tmp;
        highlight = { touch: [step.i, step.j] };
      } else if (step.type === 'set') {
        values[step.i] = step.value;
        highlight = { touch: [step.i] };
      } else {
        done.add(step.i);
      }
      cursor += 1;
    }
    paint(highlight);
    return cursor < trace.steps.length;
  }

  const player = new Player(advance, () => {
    playEl.textContent = player.playing ? '一時停止' : '再生';
  });

  function reset(regenerate: boolean): void {
    player.pause();
    if (regenerate) data = makeDataset(kindEl.value as DatasetKind, Number(sizeEl.value));
    trace = traceSort(algoEl.value as SortAlgorithmId, data);
    values = [...trace.initial];
    cursor = 0;
    done = new Set();
    rebuildBars();
    paint();
  }

  playEl.addEventListener('click', () => (player.playing ? player.pause() : player.play()));
  (section.querySelector('#sort-step') as HTMLButtonElement).addEventListener('click', () => {
    player.pause();
    advance(1);
  });
  (section.querySelector('#sort-reset') as HTMLButtonElement).addEventListener('click', () =>
    reset(false),
  );
  (section.querySelector('#sort-new') as HTMLButtonElement).addEventListener('click', () =>
    reset(true),
  );
  algoEl.addEventListener('change', () => reset(false));
  kindEl.addEventListener('change', () => reset(true));
  sizeEl.addEventListener('input', () => {
    sizeOutEl.textContent = sizeEl.value;
    reset(true);
  });
  (section.querySelector('#sort-speed') as HTMLInputElement).addEventListener('input', (e) => {
    player.speed = Number((e.target as HTMLInputElement).value);
  });

  reset(false);
  return { refresh: () => paint() };
}

function buildSearchView(section: HTMLElement): void {
  section.innerHTML = `
    <div class="controls">
      <label>アルゴリズム
        <select id="g-algo">
          ${SEARCH_ALGORITHMS.map((a) => `<option value="${a.id}">${esc(a.label)}(${esc(a.note)})</option>`).join('')}
        </select>
      </label>
      <label>壁の割合 <output id="g-wall-out">25%</output>
        <input id="g-wall" type="range" min="0" max="40" value="25" />
      </label>
      <label>沼の割合 <output id="g-swamp-out">15%</output>
        <input id="g-swamp" type="range" min="0" max="40" value="15" />
      </label>
      <button type="button" id="g-new" class="ghost">新しい迷路</button>
    </div>
    <div class="stage"><svg id="g-svg" role="img" aria-label="グラフ探索の様子を表す迷路"><title>グラフ探索の様子</title></svg></div>
    <p class="legend">濃い四角が壁、緑がかったマスは移動コスト5の沼。Sから出発しGを探す。薄い色が訪問済み、輪郭つきがフロンティア、濃い線色が見つかった経路。</p>
    <div class="player-row">
      <button type="button" id="g-play" class="primary">再生</button>
      <button type="button" id="g-step" class="ghost">1ステップ</button>
      <button type="button" id="g-reset" class="ghost">リセット</button>
      <label class="speed">速度
        <input id="g-speed" type="range" min="1" max="30" value="3" />
      </label>
      <p id="g-stats" class="stats" role="status"></p>
    </div>`;

  const algoEl = section.querySelector('#g-algo') as HTMLSelectElement;
  const wallEl = section.querySelector('#g-wall') as HTMLInputElement;
  const swampEl = section.querySelector('#g-swamp') as HTMLInputElement;
  const svg = section.querySelector('#g-svg') as SVGSVGElement;
  const playEl = section.querySelector('#g-play') as HTMLButtonElement;
  const statsEl = section.querySelector('#g-stats') as HTMLParagraphElement;

  const COLS = 28;
  const ROWS = 16;
  const CELL = 26;

  let grid: Grid = makeGrid(COLS, ROWS, 0.25, 0.15);
  let trace: SearchTrace;
  let cursor = 0;
  let cells: SVGRectElement[] = [];

  function rebuildGrid(): void {
    svg.setAttribute('viewBox', `0 0 ${COLS * CELL} ${ROWS * CELL}`);
    svg.innerHTML = '<title>グラフ探索の様子</title>';
    cells = [];
    for (let cell = 0; cell < COLS * ROWS; cell += 1) {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String((cell % COLS) * CELL + 1));
      rect.setAttribute('y', String(Math.floor(cell / COLS) * CELL + 1));
      rect.setAttribute('width', String(CELL - 2));
      rect.setAttribute('height', String(CELL - 2));
      rect.setAttribute('rx', '4');
      rect.setAttribute(
        'class',
        grid.walls.has(cell) ? 'cell wall' : grid.swamps.has(cell) ? 'cell swamp' : 'cell',
      );
      svg.appendChild(rect);
      cells.push(rect);
    }
    for (const [cell, label] of [
      [grid.start, 'S'],
      [grid.goal, 'G'],
    ] as const) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', String((cell % COLS) * CELL + CELL / 2));
      text.setAttribute('y', String(Math.floor(cell / COLS) * CELL + CELL / 2 + 5));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'cell-label');
      text.textContent = label;
      svg.appendChild(text);
    }
  }

  function markCell(cell: number, cls: string): void {
    const rect = cells[cell];
    if (!rect) return;
    const base = grid.swamps.has(cell) ? 'cell swamp' : 'cell';
    rect.setAttribute('class', `${base} ${cls}`);
  }

  function stats(): void {
    const suffix = !trace.found
      ? '経路なし'
      : cursor >= trace.steps.length
        ? `経路 ${trace.pathLength}マス ・ コスト ${trace.cost}`
        : '';
    statsEl.textContent = `ステップ ${cursor} / ${trace.steps.length} ・ 訪問 ${trace.visited} ${suffix}`;
  }

  function advance(count: number): boolean {
    for (let k = 0; k < count && cursor < trace.steps.length; k += 1) {
      const step = trace.steps[cursor] as SearchTrace['steps'][number];
      if (step.type === 'visit') markCell(step.cell, 'visited');
      else if (step.type === 'frontier') markCell(step.cell, 'frontier');
      else markCell(step.cell, 'path');
      cursor += 1;
    }
    stats();
    return cursor < trace.steps.length;
  }

  const player = new Player(advance, () => {
    playEl.textContent = player.playing ? '一時停止' : '再生';
  });

  function reset(regenerate: boolean): void {
    player.pause();
    if (regenerate) {
      grid = makeGrid(COLS, ROWS, Number(wallEl.value) / 100, Number(swampEl.value) / 100);
    }
    trace = traceSearch(algoEl.value as SearchAlgorithmId, grid);
    cursor = 0;
    rebuildGrid();
    stats();
  }

  playEl.addEventListener('click', () => (player.playing ? player.pause() : player.play()));
  (section.querySelector('#g-step') as HTMLButtonElement).addEventListener('click', () => {
    player.pause();
    advance(1);
  });
  (section.querySelector('#g-reset') as HTMLButtonElement).addEventListener('click', () =>
    reset(false),
  );
  (section.querySelector('#g-new') as HTMLButtonElement).addEventListener('click', () =>
    reset(true),
  );
  algoEl.addEventListener('change', () => reset(false));
  for (const [el, out, unit] of [
    [wallEl, '#g-wall-out', '%'],
    [swampEl, '#g-swamp-out', '%'],
  ] as const) {
    el.addEventListener('input', () => {
      (section.querySelector(out) as HTMLOutputElement).textContent = `${el.value}${unit}`;
      reset(true);
    });
  }
  (section.querySelector('#g-speed') as HTMLInputElement).addEventListener('input', (e) => {
    player.speed = Number((e.target as HTMLInputElement).value);
  });

  reset(false);
}

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
  <header class="site-header">
    <p class="kicker">Algorithm Visualizer</p>
    <div class="brand">${BRAND_MARK}<span class="brand-name">algoscope</span></div>
    <p class="tagline">ソートとグラフ探索の動きを、SVGアニメーションで1ステップずつ観察する</p>
  </header>
  <nav class="tabs" role="tablist" aria-label="可視化の種類">
    <button type="button" id="tab-sort" role="tab" aria-selected="true" aria-controls="view-sort">ソート</button>
    <button type="button" id="tab-search" role="tab" aria-selected="false" aria-controls="view-search">グラフ探索</button>
  </nav>
  <main>
    <section class="pane" id="view-sort" role="tabpanel" aria-labelledby="tab-sort"></section>
    <section class="pane" id="view-search" role="tabpanel" aria-labelledby="tab-search" hidden></section>
  </main>
  <footer class="site-footer">
    <p>すべてブラウザ内で動き、データが外部へ送信されることはない。</p>
  </footer>`;

  const sortSection = root.querySelector('#view-sort') as HTMLElement;
  const searchSection = root.querySelector('#view-search') as HTMLElement;
  buildSortView(sortSection);
  buildSearchView(searchSection);

  const tabs = [
    { tab: root.querySelector('#tab-sort') as HTMLButtonElement, view: sortSection },
    { tab: root.querySelector('#tab-search') as HTMLButtonElement, view: searchSection },
  ];
  for (const { tab, view } of tabs) {
    tab.addEventListener('click', () => {
      for (const other of tabs) {
        const active = other.tab === tab;
        other.tab.setAttribute('aria-selected', String(active));
        other.view.hidden = !active;
      }
      view.hidden = false;
    });
  }
}
