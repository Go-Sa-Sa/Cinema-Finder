# Chiba Cinema Finder (千葉7劇場 上映スケジュール比較ツール)

## 1. プロジェクト概要
千葉県内主要7劇場の映画上映スケジュールを定期スクレイピングし、スマートフォンやPCのブラウザ（PWA対応）で軽快に比較・閲覧できる完全サーバーレスWebアプリケーション。

- **ホスティング**: GitHub Pages (静的ホスティング)
- **自動更新**: GitHub Actions（毎日午前 6:00 JST 実行）
- **フロントエンド**: Vanilla HTML5 / CSS3 / JavaScript (ES6+), PWA (Service Worker)
- **クローラー**: Python 3.10+, Requests, BeautifulSoup4

---

## 2. アーキテクチャとデータフロー

```
[外部映画情報サイト (eiga.com)]
        │
        ▼ (requests / BeautifulSoup4)
[crawler.py] (GitHub Actions 定期実行)
        │
        ├─► movies_data.json   (上映スケジュール・映画一覧・上映予定)
        └─► movie_details.json (ポスター画像・あらすじ・監督・キャスト等のキャッシュ)
        │
        ▼ (git commit & push)
[GitHub Pages (PWA)]
        │
        ▼ (fetch: クライアント側で直接読み込み)
[index.html / app.js] (ユーザーのスマホ・PCブラウザ)
```

---

## 3. ファイル・ディレクトリ構成

| パス | 役割・責務 |
| :--- | :--- |
| `index.html` | アプリケーションのメインHTML (PWA対応, ES Module読み込み) |
| `index.css` | スタイルシート（ダークテーマ基調、レスポンシブ） |
| `app.js` | メインエントリーポイント（初期化・イベントリスナー設定） |
| `src/state.js` | アプリケーションのグローバル状態管理 |
| `src/api.js` | JSONデータフェッチおよび手動更新処理 |
| `src/dates.js` | 日付チップの生成と選択インタラクション |
| `src/gallery.js` | 映画ギャラリー（カード一覧）および公開予定詳細描画 |
| `src/dropdown.js` | 映画検索入力・カスタムドロップダウン制御 |
| `src/schedule.js` | 7劇場のタイムテーブル・上映形式バッジ描画 |
| `src/simulation.js` | 未確定スケジュールのシミュレーション計算・時間計算ロジック |
| `src/sw-register.js`| サービスワーカー登録と更新検知リロード |
| `service-worker.js` | PWA用サービスワーカー（オフラインキャッシュおよび更新検知） |
| `manifest.json` | PWAマニフェスト（アプリアイコン・表示設定） |
| `server.py` | ローカル実行用軽量サーバー（静的配信 + ブラウザからのクローラーAPI対応） |
| `crawler.py` | 対象劇場のスケジュールおよび作品詳細をスクレイピングするPythonスクリプト |
| `movies_data.json` | スクレイピング結果データ（各劇場のスケジュールデータ） |
| `movie_details.json` | 映画詳細キャッシュ（ポスターURL、あらすじ、キャスト等） |
| `requirements.txt` | クローラー実行に必要なPython依存ライブラリ |
| `tests/` | 単体テスト（回帰テスト）ディレクトリ |
| `.github/workflows/crawl.yml` | GitHub Actions 自動巡回・テスト・コミットワークフロー |
| `legacy/` | 旧バージョンで使用していたバックエンドサーバー（`server.py`）等の退避場所 |

---

## 4. データスキーマ定義

### `movies_data.json`
```json
{
  "last_updated": "2026-05-27 21:42:01",
  "theaters": {
    "USシネマちはら台": {
      "name": "USシネマちはら台",
      "url": "https://uscinemas.jp/category/chiharadai/",
      "movies": [
        {
          "title": "作品名",
          "eigacom_url": "https://eiga.com/movie/...",
          "official_url": "https://...",
          "schedules": [
            {
              "format": "2D/吹替",
              "dates": {
                "2026-05-28": [
                  { "start": "09:30", "end": "11:45" }
                ]
              }
            }
          ]
        }
      ]
    }
  },
  "upcoming": [
    {
      "title": "公開予定作品名",
      "release_date": "2026-06-05"
    }
  ]
}
```

### `movie_details.json`
映画タイトルをキーとする詳細情報のディクショナリ：
```json
{
  "作品名": {
    "official_url": "https://...",
    "eigacom_url": "https://eiga.com/movie/...",
    "poster_url": "https://...",
    "release_date": "2026-05-01",
    "release_date_formatted": "05月01日(金) 公開",
    "director": "監督名",
    "cast": ["出演者1", "出演者2", "出演者3"],
    "description": "あらすじテキスト...",
    "copyright": "(C)2026 ..."
  }
}
```

---

## 5. 開発・実行ガイド

### ローカルでのWebアプリ確認
静的ホスティングであるため、標準的なローカルHTTPサーバーで起動可能：
```bash
# Pythonで簡易起動
python -m http.server 8000
# ブラウザで http://localhost:8000 にアクセス
```
※ `run.bat` (Windows) または `run.command` (Mac) をダブルクリックすることでも起動可能。

### クローラーの手動実行
```bash
pip install -r requirements.txt
python crawler.py
```
※ `update_schedules.bat` (Windows) または `update_schedules.command` (Mac) をダブルクリックすることでも実行可能。
実行後、`movies_data.json` と `movie_details.json` が更新されます。

### 単体テストの実行
```bash
python -m unittest discover tests
```

---

## 6. AIアシスタントへの開発ルール・注意事項
1. **静的ホスティング原則**: 本アプリは GitHub Pages の完全静的環境で動作します。バックエンドAPIや動的サーバーサイド処理を前提としたコードは書かないこと。
2. **生成JSONの直接編集禁止**: `movies_data.json` および `movie_details.json` はクローラーによって自動生成されるファイルです。手動で直接書き換えず、構造変更は `crawler.py` を通じて行うこと。
3. **差分とトークン効率**: `app.js` や `index.css` はサイズが大きいため、コード修正時は必ず編集対象の関数やセレクタに限定して最小限の差分で更新すること。
