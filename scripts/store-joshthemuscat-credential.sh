#!/usr/bin/env bash
# このリポジトリ用に GitHub アカウント joshthemuscat の認証情報を保存する。
# 使い方:
#   1. トークンを scripts/.token-joshthemuscat の1行目に貼り付けて保存する（このファイルは .gitignore 済みで push されない）
#   2. ./scripts/store-joshthemuscat-credential.sh を実行する
# トークン: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) で発行（repo スコープ）

set -e
cd "$(git rev-parse --show-toplevel)"

TOKEN_FILE="scripts/.token-joshthemuscat"
if [[ -f "$TOKEN_FILE" ]]; then
  token=$(head -n1 "$TOKEN_FILE" | tr -d '\r\n ')
  if [[ -n "$token" ]]; then
    echo "トークンを $TOKEN_FILE から読み込みます。"
  fi
fi
if [[ -z "$token" ]]; then
  echo -n "GitHub Personal Access Token (入力は表示されません): "
  read -rs token
  echo ""
fi

if [[ -z "$token" ]]; then
  echo "トークンが空です。$TOKEN_FILE の1行目にトークンを貼り付けるか、実行時に入力してください。終了します。"
  exit 1
fi

printf "protocol=https\nhost=github.com\npath=teamhiram/churchstats.git\nusername=joshthemuscat\npassword=%s\n" "$token" | git credential approve
echo "認証情報を保存しました。このリポジトリで git push すると joshthemuscat で送信されます。"
