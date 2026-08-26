# tech-talk

登壇スライド置き場。[ReMDX](https://github.com/nkzw-tech/remdx) で書いた各デッキを個別の静的サイトとしてビルドし、一覧ページからリンクしています。

公開先: <https://slides.naturalclar.dev>

## セットアップ

パッケージマネージャは pnpm、Node は 22.18 以上が必要です（ビルドスクリプトの TypeScript を node が直接実行するため）。

```bash
pnpm install
pnpm exec playwright install chromium   # サムネイル生成に使うブラウザ
```

## コマンド

```bash
pnpm start <slug>   # 1 つのデッキを開発サーバでプレビュー（slug 省略で一覧表示）
pnpm run new        # 新しいデッキの雛形を作る
pnpm run build      # サイト全体を dist/ にビルド
pnpm run lint
pnpm run typecheck  # ビルドは型を見ないので、型チェックはこちら
pnpm run test       # scripts/og-image.ts のみ。外部サーバに依存する唯一の箇所
pnpm run format     # prettier。確認だけなら pnpm run format:check
```

**push する前に通しておくのはこの 5 つです。** CI はこの順で回します:

```
pnpm run lint → pnpm run typecheck → pnpm run test → pnpm run format:check → pnpm run build
```

`format:check` は落ちやすいので注意してください。prettier は引数を複数行に折り返す形に書き換えるので、手で書いた 1 行がそのまま通るとは限りません。`pnpm run format` で直せます。

## デッキを追加する

`pnpm run new` がスラグ・タイトル・登壇日を聞いて `src/talks/<slug>/` に `slides.re.mdx` と `meta.json` を作ります。**フォルダ名と `meta.json` の `slug` は一致している必要があり**、ずれているとビルドが失敗します。

## 別の場所にあるスライドを一覧に載せる

このリポジトリでビルドしていないスライドも一覧に並べられます。`src/external-talks.json` に追記してください。

```json
[
  {
    "title": "スライドのタイトル",
    "url": "https://example.com/my-slide/",
    "publishedAt": "2019-08-30"
  }
]
```

`publishedAt` は登壇日です。一覧はこのリポジトリのデッキと外部スライドをまとめて**新しい順**に並べるので、入れておくと正しい位置に入ります（省略すると末尾）。デッキ側は `meta.json` の同名フィールドを使います。

**サムネイルはリンク先の `og:image` を自動で取得します。**画像が実際に読めるかどうかまで確認し、`og:image` が古いホストを指している場合は同じパスを現在のホストで探し直します。それでも駄目なとき（タイムアウト、404、`og:image` が無い等）はプレースホルダになるだけで、ビルドは失敗しません。

自動取得の結果を上書きしたいときだけ `thumbnail` に画像 URL を書いてください。

```json
{
  "title": "スライドのタイトル",
  "url": "https://example.com/my-slide/",
  "thumbnail": "https://example.com/my-slide/card.png"
}
```

## 構成

ビルドパイプラインとデッキの書き方の詳細は [CLAUDE.md](./CLAUDE.md) にまとまっています。

## ライセンス

[MIT](./LICENSE)。ビルドスクリプトとスライド本文の両方が対象です。
