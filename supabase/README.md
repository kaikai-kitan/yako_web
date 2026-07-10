# Supabase（データベース・認証まわり）

このディレクトリは Supabase に関する **SQL とメールテンプレート** をまとめたものです。
アプリのビルド/デプロイには使われません（Supabase ダッシュボードで手動適用する参照用ファイルです）。

```
supabase/
├── schema.sql              … データベースの基盤スキーマ（初期構築の参照）
├── migrations/             … 差分マイグレーション（v1 → v17 の順に適用）
└── email-templates/        … 認証メールの日本語テンプレート
```

## 適用方法
Supabase ダッシュボード → **SQL Editor** に各ファイルの内容を貼り付けて実行します。
新しい環境を作る場合は `schema.sql` → `migrations/` を **v1 から順番に**適用してください。
（各マイグレーションは `IF NOT EXISTS` などで冪等になるよう配慮されているものが多く、再実行しても安全です。）

## マイグレーション一覧（適用順）

| 順 | ファイル | 内容 |
|----|----------|------|
| 1  | `supabase_migration_v1.sql`  | 屋台の位置情報など初期の機能追加 |
| 2  | `supabase_migration_v2.sql`  | 追加スキーマ |
| 3  | `supabase_migration_v3.sql`  | 追加スキーマ |
| 3b | `supabase_migration_v3_2.sql`| v3 の補足（v3 の直後・v4 の前に適用） |
| 4  | `supabase_migration_v4.sql`  | shop_products に tags カラム |
| 5  | `supabase_migration_v5.sql`  | vendor_stores（公式ストア開設情報） |
| 6  | `supabase_migration_v6.sql`  | contact_inquiries（お問い合わせ管理） |
| 7  | `supabase_migration_v7.sql`  | 追加スキーマ |
| 8  | `supabase_migration_v8.sql`  | 追加スキーマ |
| 9  | `supabase_migration_v9.sql`  | shop_products に photo_urls 配列 |
| 10 | `supabase_migration_v10.sql` | 出店者の申請フロー + 屋台レビュー |
| 11 | `supabase_migration_v11.sql` | user_profiles に信用スコア/停止フラグ |
| 12 | `supabase_migration_v12.sql` | ノーショー対策（remind_mail_sent） |
| 13 | `supabase_migration_v13.sql` | Auth & Capture（与信）フロー対応 |
| 14 | `supabase_migration_v14.sql` | GPS 位置検証対応 |
| 15 | `supabase_migration_v15.sql` | 夜行人ネットワーク（人脈グラフ） |
| 16 | `supabase_migration_v16.sql` | 信用スコアの獲得（返却ボーナス + 営業レビュー） |
| 17 | `supabase_migration_v17.sql` | 夜行人プロフィールの名前変更を1回に制限 |

> 次に追加する場合は `supabase_migration_v18.sql` としてこのフォルダに置き、上の表に1行追記してください。

## メールテンプレート
`email-templates/confirm-signup.ja.html` … 新規登録の確認メール（日本語）。
Supabase ダッシュボード → **Authentication → Emails → Confirm signup** の本文に貼り付けて使います。
