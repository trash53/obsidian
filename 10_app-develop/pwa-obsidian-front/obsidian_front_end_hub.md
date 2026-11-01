# Obsidian Front-End Hub システム仕様書

## 1. 概要
本システムは、スマホ等からObsidian（GitHubリポジトリ管理）へ予定やメモ、Webサイトの情報を安全かつ快適に書き込むための軽量フロントエンド（PWA）システムである。  


---

## 2. システム構成・技術スタック

* **フロントエンド**: PWA (HTML / CSS / JavaScript)
  * ホスティング: Cloudflare Worker
  * UX設計: 親指ファースト（ボトムヘビー）、ダークモード、Bento Grid風カードUI
* **バックエンド**: Cloudflare Workers
  * API中継、認証情報秘匿、GitHub APIとの通信処理
* **データストレージ**: GitHub リポジトリ (Markdown形式)
  * 日次ログ: 30_calender/daily note
  * 予定: 30_calendar/events
* **外部連携**: 
  * スマホブラウザ (Chrome等) からの Web Share Target API 連携

---

## 3. コア機能仕様

### 3.1. セーフティPull & Push（コンフリクト防止機能）
* **動作フロー**:
  1. 日付指定時または書き込み開始時に、Worker経由で該当日のMarkdownファイルをGitHubから取得。
  2. 取得時にファイルの `sha` 値と現在の本文内容をPWA側で保持。
  3. 送信時は、保持していた `sha` を指定してGitHub API（`PUT /repos/{owner}/{repo}/contents/{path}`）を叩く。
* **目的**: 
  * PC側のObsidian等でファイルが作成・更新されていた場合、古い状態での上書き（コンフリクト・データ消失）を防ぐ。

### 3.2. カレンダー（予定）登録機能
* **機能**: 日時・時間を指定した予定やタスクの追加。
* **出力形式**:
  * 予定を入れようとする当日と翌日のカレンダーを表示。
  * eventsフォルダ内に YYYY-MM-DD[events title].mdを作成。
  * 既にあれば追記。

### 3.3. デイリーノート（ログ）作成・追記機能
* **機能**: 出先での思考、メモ、雑多なログの即時追記。
* **出力形式**:
  * デイリーノート内の `## Log` セクション配下に追記。
  * 追記フォーマット: `- 要検討

### 3.4. Web Share Target 連携（Webクリップ機能）
* **機能**: スマホのChrome等の「共有」メニューから本PWAを選択して情報を流し込む。
* **受け取るデータ**:
  * ページタイトル (`title`)
  * URL (`url`)
  * 選択テキスト (`text`) ※存在する場合
* **出力形式**:
  * デイリーノート内の `## Web Clips` セクション配下に追記。
  * 追記フォーマット:
    ```markdown
    - [{ページタイトル}]({URL})
      - {選択テキスト（または補足メモ）}
    ```

---

## 4. UI/UX 仕様

* **レイアウト構成 (Bento Grid)**:
  * **カードA (Date Selector & Mode)**: 日付選択、ターゲットファイル状態（取得済み `sha` の表示/インジケータ）
  * **カードB (Quick Input)**: 予定/ログの切り替えトグル、テキスト入力欄、送信ボタン
  * **カードC (Share Target Auto-Fill)**: 共有から飛んできたURL/タイトルの自動プレビュー・確認欄
* **デザイン・テーマ**:
  * 深みのあるダークグレー背景＋わずかなグラデーション/すりガラス調
  * 画面下部に主要アクションボタンを配置する親指ファースト設計

---

## 5. API・データフロー仕様

### 5.1. Worker エンドポイント設計

1. **`GET /api/note?date=YYYY-MM-DD`**
   * GitHubから該当日のファイル内容と `sha` を取得して返す。存在しない場合は新規用レスポンスを返す。
2. **`POST /api/note`**
   * ペイロード: `{ date, type ('calendar'|'log'|'share'), content, sha }`
   * Worker側で指定されたセクションにテキストを結合し、GitHub APIへCommit & Pushを実行する。

---

