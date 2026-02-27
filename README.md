# algoscope

[![CI](https://github.com/miruky/algoscope/actions/workflows/ci.yml/badge.svg)](https://github.com/miruky/algoscope/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Test](https://img.shields.io/badge/Test-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**ソートとグラフ探索のアルゴリズムを、SVGアニメーションで1ステップずつ観察できる可視化ツールです。**

## 概要

ソートタブでは6つのアルゴリズム(バブル・選択・挿入・マージ・クイック・ヒープ)が棒グラフを並べ替える様子を再生できます。比較中の要素、書き込まれた要素、確定した範囲が色分けされ、比較回数と書き込み回数が常に表示されるので、「ほぼ整列済みなら挿入ソートが速い」「逆順はバブルソートの最悪ケース」といった性質が数字と動きの両方で確かめられます。グラフ探索タブでは、壁と移動コスト5の「沼」を持つ迷路に対して幅優先探索・深さ優先探索・ダイクストラ法を再生し、訪問順・フロンティア・見つかった経路を観察できます。BFSが沼を突っ切り、ダイクストラ法が迂回する違いがそのまま見えます。

試す: https://miruky.github.io/algoscope/

### なぜ作ったのか

アルゴリズムの教科書は擬似コードと計算量で説明しますが、「クイックソートのピボットがどう動くか」「DFSがどれだけ遠回りするか」は動きを見るのが一番早い。一時停止と1ステップ実行で任意の瞬間を止めて観察できる、教材として使える速度調整つきの可視化が欲しくて作りました。

## 使い方

- タブでソート / グラフ探索を切り替えます
- ソート: アルゴリズム・データの性質(ランダム / ほぼ整列済み / 逆順 / 重複が多い)・要素数を選び、再生または1ステップで進めます
- グラフ探索: アルゴリズムと壁・沼の割合を選び、「新しい迷路」で盤面を作り直せます
- いずれも速度スライダで再生速度(フレームあたりのステップ数)を変えられます

## アーキテクチャ

![algoscopeのアーキテクチャ](docs/architecture.svg)

アルゴリズム本体は「実行」ではなく「操作の列(トレース)」を返します。ソートは compare / swap / set / done、探索は visit / frontier / path という小さな操作に分解され、UI側のPlayerがrequestAnimationFrameでトレースを順に適用してSVGを差分更新します。アルゴリズムの正しさはトレースのリプレイ結果に対するテストで担保し、描画とは完全に分離しています。

## 技術スタック

| カテゴリ   | 技術                 |
| :--------- | :------------------- |
| 言語       | TypeScript 5(strict) |
| ビルド     | Vite                 |
| テスト     | Vitest(27テスト)     |
| リンタ     | ESLint + Prettier    |
| CI / CD    | GitHub Actions       |
| 配信       | GitHub Pages         |
| 実行時依存 | なし                 |

## プロジェクト構成

- `src/lib/sorts.ts` — ソート6種のトレース生成・リプレイ・データ列生成
- `src/lib/graphsearch.ts` — 迷路グリッドとBFS / DFS / ダイクストラ法のトレース
- `src/app.ts` — タブ・コントロール・Player・SVG差分更新
- `docs/architecture.svg` — アーキテクチャ図

## はじめ方

### 前提条件

- Node.js 20 以上

### セットアップ

```bash
git clone https://github.com/miruky/algoscope.git
cd algoscope
npm install
npm run dev
```

### テストの実行

```bash
npm test
```

### Lintの実行

```bash
npm run lint
```

### デプロイ

`main` ブランチへのプッシュで GitHub Actions がビルドし、GitHub Pages へ配信します。

## 設計方針

- **アルゴリズムはトレースを返す** — 実行と描画を分け、並べ替えの正しさをリプレイのテストで固定する
- **どの瞬間でも止められる** — 再生・一時停止・1ステップを同じトレース上のカーソル移動として実装する
- **性質が見える入力を用意する** — ほぼ整列済み・逆順・重複の多い列や、コスト差のある沼で、計算量の違いが動きに現れるようにする

## 制約

扱うのは比較ソート6種とグリッド上の探索3種です。安定性の可視化、A\*などのヒューリスティック探索、任意グラフ(非グリッド)の入力には対応していません。要素数は80まで、迷路は28x16固定です。

## ライセンス

[MIT](LICENSE)
