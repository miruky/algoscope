// 画面の組み立て。アルゴリズム本体は src/lib にあり、ここではトレースの再生・
// スクラブ(任意位置への移動)とSVGの差分更新、URLとテーマの同期だけを行う。

import {
  SORT_ALGORITHMS,
  makeDataset,
  traceSort,
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
import { searchFrameAt, sortFrameAt } from './lib/frames';
import { SEARCH_INFO, SORT_INFO } from './lib/algoinfo';
import { mulberry32, randomSeed } from './lib/random';
import { DEFAULT_STATE, decodeState, encodeState, type AppState } from './lib/state';
import {
  THEME_STORAGE_KEY,
  choiceLabel,
  nextChoice,
  parseChoice,
  resolveTheme,
  type ThemeChoice,
} from './lib/theme';

const SVG_NS = 'http://www.w3.org/2000/svg';

const BRAND_MARK =
  '<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="34" width="9" height="22" rx="2" fill="currentColor"/><rect x="20" y="22" width="9" height="34" rx="2" fill="var(--accent)"/><rect x="32" y="42" width="9" height="14" rx="2" fill="currentColor"/><rect x="44" y="10" width="9" height="46" rx="2" fill="currentColor" fill-opacity="0.55"/></svg>';

const THEME_ICON =
  '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor"/></svg>';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function group(n: number): string {
  return n.toLocaleString('en-US');
}

/** キーボード操作のために各ビューが公開する操作。 */
interface ViewController {
  playPause: () => void;
  step: () => void;
  stepBack: () => void;
  regenerate: () => void;
}

/** rAFでトレースを進める再生器。speedはフレームあたりのステップ数。 */
class Player {
  private handle = 0;
  playing = false;
  speed = 2;

  constructor(
    private advance: (count: number) => boolean,
    private onStateChange: () => void,
  ) {}

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.onStateChange();
    const tick = (): void => {
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
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.handle);
    this.onStateChange();
  }
}

/** 再生・戻る・進む・最初へ・速度・スクラブの行のマークアップ。 */
function transport(idPrefix: string): string {
  return `
    <div class="timeline">
      <input id="${idPrefix}-scrub" class="scrub" type="range" min="0" max="0" value="0" step="1"
        aria-label="再生位置" />
    </div>
    <div class="player-row">
      <button type="button" id="${idPrefix}-play" class="primary">再生</button>
      <div class="step-group" role="group" aria-label="ステップ操作">
        <button type="button" id="${idPrefix}-back" class="ghost step-btn" aria-label="1ステップ戻る">‹</button>
        <button type="button" id="${idPrefix}-step" class="ghost step-btn" aria-label="1ステップ進む">›</button>
      </div>
      <button type="button" id="${idPrefix}-reset" class="ghost">最初へ</button>
      <label class="speed">速度
        <input id="${idPrefix}-speed" type="range" min="1" max="30" value="2" aria-label="再生速度" />
      </label>
    </div>`;
}

function buildSortView(section: HTMLElement, state: AppState, pushUrl: () => void): ViewController {
  section.innerHTML = `
    <div class="controls">
      <label>アルゴリズム
        <select id="sort-algo">
          ${SORT_ALGORITHMS.map((a) => `<option value="${a.id}">${esc(a.label)}</option>`).join('')}
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
    <div class="algo-info" id="sort-info"></div>
    <div class="stage"><svg id="sort-svg" viewBox="0 0 720 240" role="img" aria-label="ソートの様子を表す棒グラフ"><title>ソートの様子</title></svg></div>
    <dl class="metrics">
      <div class="metric"><dt>ステップ</dt><dd id="sort-m-step">0 / 0</dd></div>
      <div class="metric"><dt>比較</dt><dd id="sort-m-cmp">0</dd></div>
      <div class="metric"><dt>書き込み</dt><dd id="sort-m-wr">0</dd></div>
      <div class="metric metric--note"><dt>計算量</dt><dd id="sort-m-o">O(n^2)</dd></div>
    </dl>
    ${transport('sort')}
    <p id="sort-sr" class="sr-only" role="status" aria-live="polite"></p>`;

  const algoEl = section.querySelector('#sort-algo') as HTMLSelectElement;
  const kindEl = section.querySelector('#sort-kind') as HTMLSelectElement;
  const sizeEl = section.querySelector('#sort-size') as HTMLInputElement;
  const sizeOutEl = section.querySelector('#sort-size-out') as HTMLOutputElement;
  const svg = section.querySelector('#sort-svg') as SVGSVGElement;
  const playEl = section.querySelector('#sort-play') as HTMLButtonElement;
  const scrubEl = section.querySelector('#sort-scrub') as HTMLInputElement;
  const stepOut = section.querySelector('#sort-m-step') as HTMLElement;
  const cmpOut = section.querySelector('#sort-m-cmp') as HTMLElement;
  const wrOut = section.querySelector('#sort-m-wr') as HTMLElement;
  const orderOut = section.querySelector('#sort-m-o') as HTMLElement;
  const infoEl = section.querySelector('#sort-info') as HTMLElement;
  const srEl = section.querySelector('#sort-sr') as HTMLElement;

  algoEl.value = state.sortAlgo;
  kindEl.value = state.sortKind;
  sizeEl.value = String(state.sortSize);
  sizeOutEl.textContent = String(state.sortSize);

  let data: number[] = [];
  let trace: SortTrace = traceSort(state.sortAlgo, [1, 2]);
  let cursor = 0;
  let bars: SVGRectElement[] = [];
  let maxValue = 1;

  const W = 720;
  const H = 240;

  function rebuildBars(values: number[]): void {
    maxValue = Math.max(1, ...values);
    svg.innerHTML = '<title>ソートの様子</title>';
    const bw = W / values.length;
    bars = values.map((v, i) => {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(i * bw + 1));
      rect.setAttribute('width', String(Math.max(1, bw - 2)));
      rect.setAttribute('rx', '2');
      rect.setAttribute('class', 'bar');
      rect.style.setProperty('--i', String(i)); // 入場アニメのスタッガ用
      setBar(rect, v);
      svg.appendChild(rect);
      return rect;
    });
  }

  function setBar(rect: SVGRectElement, value: number): void {
    const h = Math.max(3, (value / maxValue) * (H - 8));
    rect.setAttribute('y', String(H - h));
    rect.setAttribute('height', String(h));
  }

  function render(): void {
    const frame = sortFrameAt(trace, cursor);
    bars.forEach((rect, i) => {
      setBar(rect, frame.values[i] as number);
      let cls = 'bar';
      if (frame.done.has(i)) cls += ' done';
      if (frame.compare?.includes(i)) cls += ' compare';
      if (frame.touch?.includes(i)) cls += ' touch';
      rect.setAttribute('class', cls);
    });
    stepOut.textContent = `${cursor} / ${trace.steps.length}`;
    cmpOut.textContent = group(frame.comparisons);
    wrOut.textContent = group(frame.writes);
    scrubEl.value = String(cursor);
  }

  function advance(count: number): boolean {
    cursor = Math.min(cursor + count, trace.steps.length);
    render();
    if (cursor >= trace.steps.length) srEl.textContent = '整列が完了しました';
    return cursor < trace.steps.length;
  }

  const player = new Player(advance, () => {
    playEl.textContent = player.playing ? '一時停止' : '再生';
  });

  function seek(to: number): void {
    player.pause();
    cursor = Math.max(0, Math.min(to, trace.steps.length));
    render();
  }

  function reset(regenerate: boolean): void {
    player.pause();
    if (regenerate || data.length === 0) {
      data = makeDataset(state.sortKind, state.sortSize, mulberry32(state.sortSeed));
    }
    trace = traceSort(state.sortAlgo, data);
    cursor = 0;
    scrubEl.max = String(trace.steps.length);
    const info = SORT_INFO[state.sortAlgo];
    orderOut.textContent = info.average;
    infoEl.innerHTML = `<p class="algo-desc">${esc(info.desc)}</p><p class="algo-facts"><span>最悪 ${esc(info.worst)}</span><span>空間 ${esc(info.space)}</span><span>${info.stable ? '安定' : '不安定'}</span></p>`;
    srEl.textContent = '';
    rebuildBars(trace.initial);
    render();
  }

  playEl.addEventListener('click', () => (player.playing ? player.pause() : player.play()));
  (section.querySelector('#sort-step') as HTMLButtonElement).addEventListener('click', () => {
    player.pause();
    advance(1);
  });
  (section.querySelector('#sort-back') as HTMLButtonElement).addEventListener('click', () =>
    seek(cursor - 1),
  );
  (section.querySelector('#sort-reset') as HTMLButtonElement).addEventListener('click', () =>
    seek(0),
  );
  scrubEl.addEventListener('input', () => seek(Number(scrubEl.value)));
  (section.querySelector('#sort-new') as HTMLButtonElement).addEventListener('click', () => {
    state.sortSeed = randomSeed();
    pushUrl();
    reset(true);
  });
  algoEl.addEventListener('change', () => {
    state.sortAlgo = algoEl.value as SortAlgorithmId;
    pushUrl();
    reset(false);
  });
  kindEl.addEventListener('change', () => {
    state.sortKind = kindEl.value as AppState['sortKind'];
    pushUrl();
    reset(true);
  });
  sizeEl.addEventListener('input', () => {
    sizeOutEl.textContent = sizeEl.value;
    state.sortSize = Number(sizeEl.value);
    pushUrl();
    reset(true);
  });
  (section.querySelector('#sort-speed') as HTMLInputElement).addEventListener('input', (e) => {
    player.speed = Number((e.target as HTMLInputElement).value);
  });

  reset(true);
  return {
    playPause: () => (player.playing ? player.pause() : player.play()),
    step: () => {
      player.pause();
      advance(1);
    },
    stepBack: () => seek(cursor - 1),
    regenerate: () => {
      state.sortSeed = randomSeed();
      pushUrl();
      reset(true);
    },
  };
}

function buildSearchView(
  section: HTMLElement,
  state: AppState,
  pushUrl: () => void,
): ViewController {
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
    <div class="algo-info" id="g-info"></div>
    <div class="stage"><svg id="g-svg" role="img" aria-label="グラフ探索の様子を表す迷路"><title>グラフ探索の様子</title></svg></div>
    <p class="legend">濃い四角が壁、緑がかったマスは移動コスト5の沼。Sから出発しGを探す。薄い色が訪問済み、輪郭つきがフロンティア、濃い線色が見つかった経路。</p>
    <dl class="metrics">
      <div class="metric"><dt>ステップ</dt><dd id="g-m-step">0 / 0</dd></div>
      <div class="metric"><dt>訪問</dt><dd id="g-m-visited">0</dd></div>
      <div class="metric"><dt>経路</dt><dd id="g-m-path">—</dd></div>
      <div class="metric"><dt>コスト</dt><dd id="g-m-cost">—</dd></div>
    </dl>
    ${transport('g')}
    <p id="g-sr" class="sr-only" role="status" aria-live="polite"></p>`;

  const algoEl = section.querySelector('#g-algo') as HTMLSelectElement;
  const wallEl = section.querySelector('#g-wall') as HTMLInputElement;
  const swampEl = section.querySelector('#g-swamp') as HTMLInputElement;
  const wallOutEl = section.querySelector('#g-wall-out') as HTMLOutputElement;
  const swampOutEl = section.querySelector('#g-swamp-out') as HTMLOutputElement;
  const svg = section.querySelector('#g-svg') as SVGSVGElement;
  const playEl = section.querySelector('#g-play') as HTMLButtonElement;
  const scrubEl = section.querySelector('#g-scrub') as HTMLInputElement;
  const stepOut = section.querySelector('#g-m-step') as HTMLElement;
  const visitedOut = section.querySelector('#g-m-visited') as HTMLElement;
  const pathOut = section.querySelector('#g-m-path') as HTMLElement;
  const costOut = section.querySelector('#g-m-cost') as HTMLElement;
  const infoEl = section.querySelector('#g-info') as HTMLElement;
  const srEl = section.querySelector('#g-sr') as HTMLElement;

  algoEl.value = state.searchAlgo;
  wallEl.value = String(state.wall);
  swampEl.value = String(state.swamp);
  wallOutEl.textContent = `${state.wall}%`;
  swampOutEl.textContent = `${state.swamp}%`;

  const COLS = 28;
  const ROWS = 16;
  const CELL = 26;

  let grid: Grid = makeGrid(COLS, ROWS, 0.25, 0.15);
  let trace: SearchTrace = traceSearch(state.searchAlgo, grid);
  let cursor = 0;
  let cells: SVGRectElement[] = [];

  function baseClass(cell: number): string {
    if (grid.walls.has(cell)) return 'cell wall';
    if (grid.swamps.has(cell)) return 'cell swamp';
    return 'cell';
  }

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
      rect.setAttribute('class', baseClass(cell));
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

  function render(): void {
    const frame = searchFrameAt(trace, cursor);
    cells.forEach((rect, cell) => {
      const extra = frame.classes.get(cell);
      rect.setAttribute('class', extra ? `${baseClass(cell)} ${extra}` : baseClass(cell));
    });
    stepOut.textContent = `${cursor} / ${trace.steps.length}`;
    visitedOut.textContent = group(frame.visited);
    const ended = cursor >= trace.steps.length;
    if (ended && trace.found) {
      pathOut.textContent = `${trace.pathLength}マス`;
      costOut.textContent = group(trace.cost);
    } else if (ended && !trace.found) {
      pathOut.textContent = 'なし';
      costOut.textContent = '∞';
    } else {
      pathOut.textContent = '—';
      costOut.textContent = '—';
    }
    scrubEl.value = String(cursor);
  }

  function advance(count: number): boolean {
    cursor = Math.min(cursor + count, trace.steps.length);
    render();
    if (cursor >= trace.steps.length) {
      srEl.textContent = trace.found
        ? `経路が見つかりました。${trace.pathLength}マス、コスト${trace.cost}`
        : '経路は見つかりませんでした';
    }
    return cursor < trace.steps.length;
  }

  const player = new Player(advance, () => {
    playEl.textContent = player.playing ? '一時停止' : '再生';
  });

  function seek(to: number): void {
    player.pause();
    cursor = Math.max(0, Math.min(to, trace.steps.length));
    render();
  }

  function reset(regenerate: boolean): void {
    player.pause();
    if (regenerate) {
      grid = makeGrid(
        COLS,
        ROWS,
        state.wall / 100,
        state.swamp / 100,
        mulberry32(state.searchSeed),
      );
    }
    trace = traceSearch(state.searchAlgo, grid);
    cursor = 0;
    scrubEl.max = String(trace.steps.length);
    const info = SEARCH_INFO[state.searchAlgo];
    infoEl.innerHTML = `<p class="algo-desc">${esc(info.desc)}</p><p class="algo-facts"><span>時間 ${esc(info.time)}</span><span>${esc(info.optimal)}</span></p>`;
    srEl.textContent = '';
    rebuildGrid();
    render();
  }

  playEl.addEventListener('click', () => (player.playing ? player.pause() : player.play()));
  (section.querySelector('#g-step') as HTMLButtonElement).addEventListener('click', () => {
    player.pause();
    advance(1);
  });
  (section.querySelector('#g-back') as HTMLButtonElement).addEventListener('click', () =>
    seek(cursor - 1),
  );
  (section.querySelector('#g-reset') as HTMLButtonElement).addEventListener('click', () => seek(0));
  scrubEl.addEventListener('input', () => seek(Number(scrubEl.value)));
  (section.querySelector('#g-new') as HTMLButtonElement).addEventListener('click', () => {
    state.searchSeed = randomSeed();
    pushUrl();
    reset(true);
  });
  algoEl.addEventListener('change', () => {
    state.searchAlgo = algoEl.value as SearchAlgorithmId;
    pushUrl();
    reset(false);
  });
  for (const [el, out, key] of [
    [wallEl, wallOutEl, 'wall'],
    [swampEl, swampOutEl, 'swamp'],
  ] as const) {
    el.addEventListener('input', () => {
      out.textContent = `${el.value}%`;
      state[key] = Number(el.value);
      pushUrl();
      reset(true);
    });
  }
  (section.querySelector('#g-speed') as HTMLInputElement).addEventListener('input', (e) => {
    player.speed = Number((e.target as HTMLInputElement).value);
  });

  reset(true);
  return {
    playPause: () => (player.playing ? player.pause() : player.play()),
    step: () => {
      player.pause();
      advance(1);
    },
    stepBack: () => seek(cursor - 1),
    regenerate: () => {
      state.searchSeed = randomSeed();
      pushUrl();
      reset(true);
    },
  };
}

/** テーマ(自動 / ライト / ダーク)の切替。選択は localStorage に残し、自動時はOSに追従。 */
function setupTheme(root: HTMLElement): void {
  const btn = root.querySelector('#theme-toggle') as HTMLButtonElement | null;
  const labelEl = root.querySelector('#theme-label') as HTMLElement | null;
  if (!btn || !labelEl) return;
  const media = matchMedia('(prefers-color-scheme: dark)');
  let choice: ThemeChoice = parseChoice(safeRead());

  const apply = (): void => {
    document.documentElement.dataset.theme = resolveTheme(choice, media.matches);
    labelEl.textContent = choiceLabel(choice);
    btn.dataset.choice = choice;
    btn.setAttribute('aria-label', `テーマ: ${choiceLabel(choice)}。クリックで切り替え`);
  };

  btn.addEventListener('click', () => {
    choice = nextChoice(choice);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      /* ストレージ不可でもUIは動かす */
    }
    apply();
  });
  media.addEventListener('change', () => {
    if (choice === 'system') apply();
  });
  apply();
}

function safeRead(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function mountApp(root: HTMLElement): void {
  // ハッシュがあれば復元、なければ新しいseedで毎回ちがう初期画面にする
  const state: AppState = location.hash
    ? decodeState(location.hash)
    : { ...DEFAULT_STATE, sortSeed: randomSeed(), searchSeed: randomSeed() };

  const pushUrl = (): void => {
    history.replaceState(null, '', `#${encodeState(state)}`);
  };

  root.innerHTML = `
  <header class="site-header">
    <div class="masthead">
      <div class="masthead-text">
        <p class="kicker">Algorithm Visualizer</p>
        <div class="brand">${BRAND_MARK}<span class="brand-name">algoscope</span></div>
      </div>
      <button type="button" id="theme-toggle" class="theme-toggle">
        ${THEME_ICON}<span id="theme-label" class="theme-label">自動</span>
      </button>
    </div>
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
    <p>すべてブラウザ内で動き、データが外部へ送信されることはない。スペースで再生・停止、<kbd>←</kbd><kbd>→</kbd>で前後に1ステップ、<kbd>N</kbd>で作り直し。</p>
  </footer>`;

  setupTheme(root);

  const sortSection = root.querySelector('#view-sort') as HTMLElement;
  const searchSection = root.querySelector('#view-search') as HTMLElement;
  const controllers: Record<AppState['tab'], ViewController> = {
    sort: buildSortView(sortSection, state, pushUrl),
    search: buildSearchView(searchSection, state, pushUrl),
  };

  const tabs = [
    {
      id: 'sort' as const,
      tab: root.querySelector('#tab-sort') as HTMLButtonElement,
      view: sortSection,
    },
    {
      id: 'search' as const,
      tab: root.querySelector('#tab-search') as HTMLButtonElement,
      view: searchSection,
    },
  ];

  function selectTab(id: AppState['tab']): void {
    for (const t of tabs) {
      const active = t.id === id;
      t.tab.setAttribute('aria-selected', String(active));
      t.tab.tabIndex = active ? 0 : -1; // ロービングtabindex
      t.view.hidden = !active;
    }
    state.tab = id;
  }

  for (const t of tabs) {
    t.tab.addEventListener('click', () => {
      selectTab(t.id);
      pushUrl();
    });
  }

  // tablistの作法: 左右で移動、Home/Endで端へ。移動先を選択しフォーカスする。
  const tablistEl = root.querySelector('.tabs') as HTMLElement;
  tablistEl.addEventListener('keydown', (e) => {
    const current = tabs.findIndex((t) => t.id === state.tab);
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const target = tabs[next];
    if (!target) return;
    selectTab(target.id);
    target.tab.focus();
    pushUrl();
  });

  // 復元したタブを反映(URL同期はユーザー操作まで控える)
  selectTab(state.tab);

  // キーボード操作。フォーム部品やボタン自身が処理する場面では邪魔しない。
  // ボタンを除くのは、フォーカス中のボタンへのスペース/Enterと二重に発火させないため。
  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const controller = controllers[state.tab];
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      controller.playPause();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      controller.step();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      controller.stepBack();
    } else if (e.key === 'n' || e.key === 'N') {
      controller.regenerate();
    }
  });
}
