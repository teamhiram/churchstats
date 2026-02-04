#!/bin/bash
# リポジトリを初期化してからプッシュするスクリプト
# 使い方: YOUR_REPO_URL を GitHub の URL に書き換えてから実行
# 例: https://github.com/your-org/churchstats.git

set -e
cd "$(dirname "$0")"

REMOTE_URL="${1:-YOUR_REPO_URL}"

if [[ "$REMOTE_URL" == "YOUR_REPO_URL" ]]; then
  echo "エラー: リモート URL を指定してください。"
  echo "例: ./reinit-push.sh https://github.com/your-org/churchstats.git"
  exit 1
fi

echo "リモート: $REMOTE_URL"
echo "現在の .git を削除して初期化します。履歴は消えます。"
read -p "続行しますか? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[yY]$ ]]; then
  echo "中止しました。"
  exit 0
fi

rm -rf .git
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin "$REMOTE_URL"
echo "プッシュします (--force で上書き)。"
git push -u origin main --force

echo "完了しました。"
