# Chiba Cinema Finder (千葉7劇場 上映スケジュール比較ツール)

PCを起動することなく、スマートフォンやタブレット（Android / iOS）のホーム画面からいつでも簡単・高速に映画スケジュールを比較・確認できるサーバーレスWebアプリ（PWA対応）です。

毎日午前 6:00 (JST) に GitHub Actions が自動でクローラーを実行し、最新の映画データを取得して GitHub Pages に反映させます。

---

## 🚀 導入手順 (GitHubへのセットアップ)

ご自身のGitHubアカウントにこのソースコードをアップロードし、自動更新とWeb公開を設定する手順です。

### 1. GitHubで新しいリポジトリを作成する
1. [GitHub](https://github.com/) にログインします。
2. 右上の「＋」ボタンから **New repository** を選択します。
3. リポジトリ名（例: `cinema-finder`）を入力します。
4. 公開範囲は **Public (公開)** または **Private (非公開)** のどちらでも構いません（※GitHub Pagesの無料公開はPublicリポジトリのみ対応しています）。
5. 「Create repository」ボタンをクリックします。

### 2. ローカルからコードをプッシュする
PCでコマンドプロンプトやPowerShellを開き、本フォルダ（`cinema`）に移動して以下のコマンドを実行します。

```bash
# Git初期化とコミット
git init
git add .
git commit -m "Initial commit for PWA + GitHub Actions"
git branch -M main

# リポジトリの紐付け (URLはご自身のものに書き換えてください)
git remote add origin https://github.com/あなたのユーザー名/cinema-finder.git

# プッシュを実行
git push -u origin main
```

---

## ⚙️ GitHub上での初期設定 (重要)

コードをプッシュした後、GitHubの画面上で以下の **2つの設定** を行う必要があります。

### 設定①：GitHub Actions の書き込み権限の許可
クローラーが自動でデータを更新して保存できるようにするために必要です。

1. GitHubのリポジトリページ上部にある **Settings** タブをクリックします。
2. 左メニューから **Actions** ＞ **General** を選択します。
3. ページ下部にある **Workflow permissions** セクションを見つけます。
4. **「Read and write permissions」** にチェックを入れ、**Save** ボタンを押します。

### 設定②：GitHub Pages の有効化 (Webアプリの公開)
スマホからアクセスできるように、Webページを公開します。

1. 引き続き **Settings** タブを開きます。
2. 左メニューから **Pages** を選択します。
3. **Build and deployment** セクションの **Source** が `Deploy from a branch` になっていることを確認します。
4. **Branch** で `main` ブランチを選択し、フォルダを `/ (root)` にして **Save** をクリックします。
5. 1分ほど待ってリロードすると、ページ上部に公開されたURL（例: `https://あなたのユーザー名.github.io/cinema-finder/`）が表示されます。

---

## 📱 スマートフォン・タブレットでのアプリ化 (PWA)

公開されたURLにスマートフォンやタブレットのブラウザでアクセスします。

### 🤖 Android (Chrome等)
1. 公開URLにアクセスします。
2. 画面下部に表示される「ホーム画面に Chiba Cinema Finder を追加」というポップアップをタップします（またはブラウザのメニューから「アプリをインストール」や「ホーム画面に追加」をタップします）。
3. ホーム画面に専用のシネマアイコンが追加され、以降はタップするだけで全画面アプリとして起動できます。

### 🍎 iOS (Safari)
1. Safariで公開URLにアクセスします。
2. 画面下部の「共有」アイコン（四角から矢印が飛び出ているマーク）をタップします。
3. メニューから「ホーム画面に追加」をタップします。

---

## 🔄 スケジュールを手動で即時更新したい場合

自動更新（毎日午前6時）を待たずに、今すぐ最新データに更新したい場合は、GitHub上から手動で実行できます。

1. GitHubのリポジトリページで **Actions** タブをクリックします。
2. 左側の Workflows 一覧から **Crawl Cinema Schedule** を選択します。
3. 右上にある **Run workflow** ボタンをクリックし、緑色のボタンを押します。
4. 数十秒で実行が完了し、データが最新にアップデートされてWebページに自動反映されます。
