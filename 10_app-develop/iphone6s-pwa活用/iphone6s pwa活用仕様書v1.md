# スマートホーム・ダッシュボード システム仕様書

本仕様書は、iPhone 6s（横画面）に最適化したダークモード＆ガラスモフィズム仕様のスマートホーム・ダッシュボード（PWA）のシステム設計および実装仕様をまとめたものです。

---

## 1. システム概要

* **目的**: 自宅の予定確認（Obsidian連携）および家電操作（SwitchBot連携）をワンタップで実現する専用UIダッシュボード。
* **想定端末**: iPhone 6s（画面解像度:1334px × 750px 横画面固定）。
* **利用形態**: ユーザー本人のみが利用するプライベートなPWA（Progressive Web App）。

---

## 2. アーキテクチャ & 技術スタック

```
[ Obsidian (PC/Mobile) ] 
       │ (Push/Sync)
       ▼
[ GitHub Private Repo ]
       │ (API Request w/ PAT)
       ▼
[ Cloudflare Workers / Pages ] ─── (API Request w/ Secret) ───► [ SwitchBot Open API ]
       │ (HTML/CSS/JS + PWA)
       ▼
[ iPhone 6s Safari / PWA ]
```

| レイヤー | 使用技術 / サービス | 選定理由・役割 |
| :--- | :--- | :--- |
| **フロントエンド** | HTML5, Tailwind CSS, Lucide Icons, Vanilla JS | 外部フォント依存を排したOS標準フォントによる高速描画、ガラスモフィズムデザイン。 |
| **ホスティング / API中継** | Cloudflare Pages + Workers | 静的PWA配信、SwitchBot APIおよびGitHub APIの中継（APIキーの保護）。 |
| **データソース（予定）** | Obsidian + GitHub (Private Repo) | 手元のMarkdownファイルを唯一のデータソースとして同期・抽出。 |
| **スマートホーム制御** | SwitchBot Open API | 照明およびエアコンのトグル・プリセット操作。 |
| **アクセス制御** | Cloudflare Access (Zero Trust) | メール認証またはシークレットキーによるアクセス制限（非公開化）。 |

---

## 3. UI / UX デザイン仕様

### 3.1 ビジュアルデザイン
* **カラーテーマ**: 黒背景（`#08080a`）を基調としたダークモード。
* **デザインスタイル**: ガラスモフィズム（`backdrop-filter: blur()`, 半透明境界線, 発光オーブ背景）。
* **フォントスタック**: OS標準システムフォント（`-apple-system`, `BlinkMacSystemFont`, `"SF Pro Display"`, `"Helvetica Neue"`, `Arial` 等）。

### 3.2 画面レイアウト1334px × 750px）
1. **ヘッダー領域**:
   * タイトル ("Home Dashboard") / ステータスバッジ ("SwitchBot Hub")
   * リアルタイム時計（月日・曜日・時分）
2. **メインコンテンツ（2カラム構成）**:
   * **左カラム（7列）**: 「今日・明日の予定」カード（スクロール可能）。
   * **右カラム（5列）**: SwitchBot操作パネル（上下2段分割）。
     * 上段: **照明コントロール**（全灯 / 50%調光 / OFF）
     * 下段: **エアコンコントロール**（冷房26℃ / 暖房22℃ / OFF）
3. **フッター領域**:
   * 接続ステータスおよびアクション結果を表示するトースト通知バー。

---

## 4. バックエンド ＆ 外部連携仕様

### 4.1 Obsidian / GitHub 予定抽出連携
* **対象**: Privateリポジトリに格納されたObsidianのMarkdownファイル。
* **認証**: Cloudflare Workersの環境変数（`GITHUB_TOKEN`）にPersonal Access Token（PAT）を設定。
* **処理フロー**:
  1. WorkersがGitHub REST API (`GET /repos/{owner}/{repo}/contents/{path}`) を実行。
  2. 取得したBase64データをデコードし、Markdownテキスト（日付見出しやタスクリスト）を正規表現等でパース。
  3. `TODAY` および `TOMORROW` の要素をJSONデータに整形してフロントエンドへ返却。

### 4.2 SwitchBot API 連携
* **対象機器**:
  * 照明 (Living Light): 3通り（全灯, 50%調光, OFF）
  * エアコン (Living AC): 3通り（冷房 26℃, 冷房 22℃, OFF）(冬は暖房に切り替える)
* **認証・セキュリティ**:
  * HMAC-SHA256 署名（`sign`）およびトークン処理はすべて Cloudflare Workers 上で実行。
  * フロントエンドからはWorkersのエンドポイント（例: `/api/switchbot`）のみを叩き、認証情報（Client Secret / Token）をブラウザ側に一切露出させない。

---

## 5. セキュリティ ＆ アクセス制限仕様

* **リポジトリ非公開性**: GitHubリポジトリは完全非公開（Private）で運用。
* **Cloudflare アクセス制御**:
  * **推奨構成**: Cloudflare Access (Free Plan) を適用し、指定したメールアドレスからのワンタイムコード（PIN）認証でのみ閲覧を許可。
  * **簡易構成**: URLパラメータまたはヘッダーへのトークンチェック処理を Cloudflare Workers に組み込み。

---

## 6. 今後の開発・デプロイ手順

1. **リポジトリ準備**: ObsidianのVaultをGitHub Privateリポジトリに同期。
2. **Cloudflare設定**: 
   * Workers / Pages プロジェクトを作成。
   * 環境変数（`GITHUB_TOKEN`, `SWITCHBOT_TOKEN`, `SWITCHBOT_SECRET` 等）を設定。
3. **フロント実装**: `dashboard.html` を `index.html` としてデプロイし、PWA用の `manifest.json` と Service Worker を配置。
4. **アクセス制限設定**: Cloudflare Zero Trust より該当ドメインへのアクセス制限ルールを追加。