# tech-talk

登壇スライド置き場。[ReMDX](https://github.com/nkzw-tech/remdx) で書いた各デッキを個別の静的サイトとしてビルドし、一覧ページからリンクしています。

公開先: <https://slides.naturalclar.dev>

## セットアップ

パッケージマネージャは pnpm です。

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
```

## デッキを追加する

`pnpm run new` がスラグ・タイトル・登壇日を聞いて `src/talks/<slug>/` に `slides.re.mdx` と `meta.json` を作ります。**フォルダ名と `meta.json` の `slug` は一致している必要があり**、ずれているとビルドが失敗します。

## 別の場所にあるスライドを一覧に載せる

このリポジトリでビルドしていないスライドも一覧に並べられます。`src/external-talks.json` に追記してください。

```json
[
  {
    "title": "スライドのタイトル",
    "url": "https://example.com/my-slide/",
    "thumbnail": "https://example.com/my-slide/card.png"
  }
]
```

`thumbnail` は任意です。これらはリンクを並べるだけで、ビルドもサムネイル生成も行いません。

## 構成

ビルドパイプラインとデッキの書き方の詳細は [CLAUDE.md](./CLAUDE.md) にまとまっています。
