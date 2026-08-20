https://kaikai-kitan.github.io/yako_web/

# 微小夜行電灯 ホームページ

## 環境構築

1. VSCode をインストール
2. Open in Container で devcontainer 環境で起動
3. devcontainer のターミナルを開いて `npm install`
4. `npm run dev`

## ビルド

`npm run build`

## Lint & Test

### Lint

`npm run list`

### Test

`npm run test`

## チーム掲示板の自動処理

`TEAM_BOARD.md` の「📥 指示キュー」で、タスクテンプレートを複製して内容を記入し、`status: READY` にして保存します。

### 前提条件

- 同じターミナルで `codex --version` が成功し、Codex CLIへログイン済みであること
- このリポジトリをCodexの信頼済みプロジェクトとして開いていること
- `.codex/agents/` のプロジェクト設定を利用できること

`TEAM_BOARD.md` はローカルの信頼済みコマンド入力として扱われます。他者が変更できるブランチや外部由来の差分を取り込んだ直後は、常時監視を使わず、内容を確認してから `npm run team:run` を実行してください。

最初に、実行対象が正しく検出されるか確認してください。このコマンドはCodexを起動せず、ファイルも変更しません。

```bash
npm run team:check
```

検出したタスクを一度処理する場合:

```bash
npm run team:run
```

掲示板を継続監視し、保存後に自動処理する場合:

```bash
npm run team:watch
```

監視はターミナルを閉じると終了します。停止するには `Ctrl+C` を押してください。保存から検出まで最大で約1秒かかります。自動処理はCodex CLIの保存済み認証を使用し、ワークスペース内だけを編集します。コミット、push、デプロイは行いません。

この自動処理の田中・鈴木はCodexのカスタムエージェントです。外部のClaudeセッションを直接起動する構成ではありません。
