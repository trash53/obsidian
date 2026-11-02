# LIMBS TABLE（VSinger「nurojunk」非公式ファンサイト）仕様書 v2

> 改定履歴
> - v1: 初版（サイト名 nurojunk）
> - v2: サイト名を LIMBS TABLE に変更。免責モーダル・ディスコグラフィ・Cron通知を廃止。日付モデルを `events` に汎用化。セットリストを3テーブル化。CMSを自作管理画面に決定。

---

## 1. プロジェクト概要

* **サイト名:** LIMBS TABLE（VSinger「nurojunk」の非公式ファンサイト）
* **目的:** ファン活動（推し活）の支援。ライブチケット・グッズ・外部イベント・誕生日・配信予定など、日付が関わる情報の一元確認とマイリスト管理、および歌配信のセットリスト検索を提供する。
* **運用方針:**
  * 公式権利者に配慮した**完全非営利**運営（広告・アフィリエイト・投げ銭は一切設置しない）。
  * 運営者1名での低コスト・低メンテ運用。無料枠内で動作させる。
  * 更新が止まっても安全に残せる構成にする（8章）。
* **ドメイン:** Cloudflare 提供のデフォルトドメイン（`*.workers.dev`）
* **タイムゾーン:** すべて **JST（日本標準時）固定**。画面上にも「JST」と明記する。

---

## 2. 機能要件

### 2.1 スケジュール一覧（メイン機能）

* **対象:** 日付が関連する情報すべて。種別（`kind`）の例:
  `ticket`（ライブチケット）/ `goods`（グッズ受注）/ `voice`（ボイス・コンテンツ）/ `external_event`（外部イベント）/ `birthday`（誕生日）/ `stream`（配信予定）
* **表示形式:**
  * リスト/タイムライン表示（締切までの「あと〇日」カウントダウン付き）
  * 月間カレンダー表示（ライブラリ利用。選定は11章）
  * 種別タグでの絞り込み
* **状態表示:** `scheduled`（予定）/ `changed`（変更あり）/ `cancelled`（中止）/ `done`（終了）をバッジ表示。
* **日付が未確定のものの表示:**
  * `date_precision = 'tbd'` → 「日程未定」
  * `date_precision = 'date'` → 日付のみ表示（時刻なし）
  * `starts_at` が NULL（受付開始が未告知・配信中に突然始まる等）→ 開始日を表示せず、締切のみ表示
* **出典表示:** 各項目に出典リンク（主にXのポスト）と最終確認日を表示。
* **終了済みの扱い:** トップには出さず、過去ログとして閲覧可能。
* **最終更新日:** サイト上に表示する（更新停止を利用者が判断できるようにする）。

### 2.2 マイリスト（ローカル状態管理）

* 各項目にチェックボックスを設置し、「マイリスト」表示に切り替えて絞り込める。
* ログイン不要。状態はブラウザの `localStorage` に保存（6章）。
* マイリスト付近に次の注意書きを表示する:
  > この端末のブラウザにのみ保存されます。端末間では同期されず、キャッシュやサイトデータを削除すると消えます。

### 2.3 歌配信セットリスト検索

* 「どの配信の何分頃にどの曲が歌われたか」「曲ごとの過去歌唱回数」を検索・閲覧できる。
* 曲名・原曲アーティスト名で検索（`LIKE` 検索。FTS5 は使用しない）。
* 各歌唱から配信の該当タイムスタンプへのリンク（`?t=秒`）を生成する。
* 掲載は曲名・アーティスト名・配信情報のみ。**歌詞は掲載しない。**

### 2.4 X（旧Twitter）での周知（手動運用）

* 自動投稿・運営者への自動通知は行わない（API制限・コスト回避、運用の簡素化のため）。
* 管理画面に「**投稿文コピー**」ボタンを設置し、テンプレートから文面を生成して運営者が手動で投稿する。
  * 例: `【締切】{title} {ends_at:MM/DD HH:mm}(JST) {official_url}`
* 投稿対象は `is_priority = 1` の項目（チケット入金期限など見逃すと困るもの）を基本とする。
* 方針: サイトを見てほしい一方、X経由の概要把握ニーズもあるため、Xは重要項目のリマインドに限定し、詳細はサイトへ誘導する。

---

## 3. UI/UX・権利保護

### 3.1 非公式表記・免責

* **免責モーダルは設置しない。**
* カレンダー（一覧）の直上に、非公式ファンコンテンツである旨の**短文**を常時表示する。
* フッターに**詳細な免責文**を記載する（非公式であること、公式・運営とは無関係であること、情報の正確性は保証しないこと、権利者から要請があれば速やかに対応すること、連絡先）。
* ヘッダーにも「非公式ファンサイト」と明記する。

### 3.2 ガイドライン準拠の考え方

* ファンサイトであることの明記、非営利、公序良俗に反しない運用を条件に、固有名詞（VSinger名）の使用は問題ないと運営者が判断している。
* ガイドラインの解釈余地があるため、権利者から要請があった場合は速やかに修正・削除する。

### 3.3 画像・埋め込み

* 公式画像（ロゴ・イラスト・ジャケット等）は使用しない。
* 使用する画像は**フリー素材**と、**公式メンバーカラー**を用いた配色のみ。
* **YouTube 埋め込みは行わない**（リンクのみ）。
* X ポストの埋め込みは初期は行わず**リンクのみ**。将来追加する場合はプライバシーポリシーに外部サービス読み込みを追記する。
* OGP 用ロゴは本サイト独自に制作する（公式ビジュアルを連想させすぎないよう留意）。

---

## 4. 技術構成・アーキテクチャ

| レイヤー | 採用技術 |
| :--- | :--- |
| フロントエンド | Astro（SSR, `@astrojs/cloudflare`）＋ React / TypeScript（インタラクティブ部分） |
| ホスティング | Cloudflare Workers（Static Assets） |
| データベース | Cloudflare D1（SQLite） |
| 管理画面 | Worker 内に自作。Cloudflare Access で保護 |
| カレンダー | ライブラリ利用（11章） |

* **レンダリング:** SSR。D1 は Worker 経由で読み取り、レスポンスに `Cache-Control` / Cloudflare キャッシュを適用して D1 読み取りを抑える。
* **キャッシュ:** データ更新時は該当ページのキャッシュを無効化（またはTTL短め）にする。
* **D1 読み取り量の見積もり:** 無料枠は日間約500万行読み取り（※最新値は公式ドキュメントで要確認）。インデックス未使用の全表スキャンでも「1,000行 × 5,000アクセス = 500万行」で上限に届く水準。実際は「終了前のみ取得」＋インデックス＋キャッシュで大きく余裕がある。
* **ボット対策:** クローラーのアクセスも通常リクエスト同様に D1 読み取りを消費しうる。キャッシュ適用と `robots.txt` の Disallow で抑制する（9章）。

---

## 5. データ構造（Cloudflare D1）

日時はすべて ISO 8601 の TEXT で、JST（`+09:00`）を含めて保存する。

### 5.1 `events`（スケジュール全般）

```sql
CREATE TABLE events (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  kind           TEXT NOT NULL,                      -- 種別。値の追加はスキーマ変更不要
  starts_at      TEXT,                               -- 開始日時。未告知ならNULL
  ends_at        TEXT,                               -- 締切/終了日時。未定ならNULL
  date_precision TEXT NOT NULL DEFAULT 'datetime',   -- 'datetime' | 'date' | 'tbd'
  status         TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled' | 'changed' | 'cancelled' | 'done'
  is_priority    INTEGER NOT NULL DEFAULT 0,         -- Xでの周知対象
  official_url   TEXT,                               -- 申込先・公式ストア等
  note           TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_events_ends_at ON events(ends_at);
CREATE INDEX idx_events_starts_at ON events(starts_at);
CREATE INDEX idx_events_kind ON events(kind);
```

設計方針:
* **開始日が事前告知・事後判明のどちらでも壊れない:** `starts_at` は NULL 許可。判明時に更新する。
* **変更に強い:** 時刻変更は `starts_at` / `ends_at` を更新し `status='changed'`、`updated_at` を更新。中止は `cancelled`。必要になれば変更履歴テーブルを追加できる。
* **種別追加はデータのみ:** `kind` の新値はコード側の表示ラベル定義に追記するだけ。
* **カラム追加:** 必要時は `ALTER TABLE ... ADD COLUMN` で可能。
* **誕生日など毎年のもの:** 年ごとに行を作る（繰り返しルールは実装しない）。
* **カウントダウン基準:** JST の日付差で計算。当日締切は「今日まで」と表示。

### 5.2 `event_sources`（出典・複数可）

```sql
CREATE TABLE event_sources (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id),
  url        TEXT NOT NULL,        -- 告知ポストURL等
  label      TEXT,
  checked_at TEXT                  -- 最終確認日時
);
CREATE INDEX idx_sources_event ON event_sources(event_id);
```

### 5.3 セットリスト（3テーブル）

```sql
CREATE TABLE songs (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  original_artist TEXT
);

CREATE TABLE streams (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  stream_url  TEXT NOT NULL,
  streamed_on TEXT NOT NULL        -- YYYY-MM-DD (JST)
);

CREATE TABLE setlist_entries (
  id            TEXT PRIMARY KEY,
  stream_id     TEXT NOT NULL REFERENCES streams(id),
  song_id       TEXT NOT NULL REFERENCES songs(id),
  start_seconds INTEGER,           -- 歌唱開始位置（秒）。?t= リンク生成・並び替え用
  position      INTEGER NOT NULL   -- 配信内の歌唱順
);
CREATE INDEX idx_entries_song ON setlist_entries(song_id);
CREATE INDEX idx_entries_stream ON setlist_entries(stream_id);
CREATE INDEX idx_songs_title ON songs(title);
```

* 歌唱回数は `setlist_entries` を `song_id` で集計。表記ゆれは曲マスタで一元管理して防ぐ。

### 5.4 表示ラベルのマッピング（コード側定義）

| kind | 表示ラベル |
| :--- | :--- |
| ticket | チケット |
| goods | グッズ |
| voice | ボイス・コンテンツ |
| external_event | 外部イベント |
| birthday | 誕生日 |
| stream | 配信予定 |

---

## 6. localStorage 設計

| 項目 | 内容 |
| :--- | :--- |
| キー名 | `limbstable_mylist_v1` |
| 値 | JSON文字列 `{"ids": ["evt_001", "evt_005"]}` |
| バージョン | `v1` をキーに含め、将来の形式変更時に移行・区別できるようにする |
| 掃除 | 一覧読み込み時に、DBに存在しないIDや終了後一定期間経過したIDを除去 |
| エラー対策 | 読み書きは `try/catch`（プライベートモード等で例外が出るため） |
| ちらつき対策 | マイリスト関連の React コンポーネントは `client:only="react"` とする（SSR 時に localStorage を読めないため） |
| 個人情報 | 保存しない（ID配列のみ） |

---

## 7. 管理（CMS）

* **方式:** Worker 内の自作簡易管理画面から D1 を直接編集する。WordPress 等の外部CMSは、サーバー・保守の負担と放置時の脆弱性リスクから**不採用**。
* **認証:** Cloudflare Access（無料枠、運営者のみ許可）。管理画面のパスはすべて Access で保護する。
* **機能:**
  * `events` / `event_sources` の登録・編集・ステータス変更
  * `songs` / `streams` / `setlist_entries` の登録・編集
  * Xでの投稿文コピー（2.4）
* **入力ミス対策:** 日時は JST で入力し、保存時に ISO 8601（`+09:00`）へ変換する。

---

## 8. 運用・非機能要件

* **バックアップ:** `wrangler d1 export` を月1回程度手動実行し、ローカルに二重保存する（FTS5 を使わないためエクスポート可能）。万一全損しても許容する（ファンサイトのため）。
* **更新不能時の方針:** 放置されても安全であること。
  * 管理画面は Access で保護
  * 終了済みは過去ログ扱いで、トップに古い情報が出ない
  * 「最終更新日」を常時表示
* **性能:** 数百〜数千行規模のため、インデックス＋キャッシュで十分。
* **無料枠監視:** D1 読み取り行数・Workers リクエスト数を定期的にダッシュボードで確認する。

---

## 9. 公開準備

* **robots.txt:** 動的な検索結果URL（セットリスト検索のクエリ付きURL等）と管理画面パスを Disallow。静的に近い一覧ページは許可。
* **OGP:** サイト独自ロゴを制作。`og:title` / `og:description` / `og:image` を設定。
* **ドメイン:** Cloudflare デフォルトドメイン。
* **プライバシーポリシー**（フッターからリンク）に記載する事項:
  * localStorage の利用目的（マイリスト保存のみ。個人情報は収集しない）
  * Cloudflare によるアクセスログ取得
  * アクセス解析の有無（導入しない場合はその旨を明記）
  * 外部リンク先（X・YouTube・公式ストア等）の扱い。将来 Embed を導入する場合はその外部サービスについて
  * 問い合わせ先

---

## 10. 開発ステップ

1. **フェーズ1（基盤）:** Astro + Cloudflare Workers の初期化、レイアウト、ヘッダー/フッター、非公式表記・免責文。
2. **フェーズ2（DB・一覧）:** D1 スキーマ作成、一覧・カレンダー表示、種別フィルタ、マイリスト、キャッシュ設定。
3. **フェーズ3（管理画面）:** Worker 内の管理画面、Cloudflare Access 設定、投稿文コピー機能。
4. **フェーズ4（セットリスト）:** 3テーブルの登録・検索UI・歌唱回数表示。
5. **フェーズ5（公開準備）:** robots.txt、OGP・ロゴ、プライバシーポリシー、最終更新日表示、バックアップ手順の確認。

---

## 11. 未決事項

* **カレンダーライブラリの選定**（候補: FullCalendar / react-big-calendar / 自前の月間グリッド）。導入前に最新のメンテ状況とバンドルサイズを確認する。
* **Xポスト埋め込み**の導入時期（導入時はプライバシーポリシー更新が必要）。
* **投稿文テンプレート**の最終文面（種別ごとに分けるか）。
* **キャッシュTTL**と、データ更新時のキャッシュ無効化方法。
* Cloudflare **D1 / Workers 無料枠の最新値**の確認。
