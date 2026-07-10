#!/usr/bin/env bash
# ============================================================
# 一鍵：把目前改動 commit（訊息自動帶當天日期）並推到 GitHub。
# 用法：
#   bash git-push.sh "做了什麼"     → commit 訊息 = 「2026-07-11：做了什麼」
#   bash git-push.sh                 → 用預設訊息「2026-07-11：更新」
# 註：*.xlsx（真實資料）、dist/、*.zip、個人設定 已由 .gitignore 排除，不會被推。
# ============================================================
set -e
cd "$(dirname "$0")"

DATE=$(date +%Y-%m-%d)
MSG="${1:-更新}"

git add -A
if git diff --cached --quiet; then
  echo "沒有新變更，略過 commit。"
else
  git commit -m "${DATE}：${MSG}"
  echo "已 commit：${DATE}：${MSG}"
fi

# 首次推會自動建立 upstream；之後直接推 main
git push -u origin main
echo "✅ 已推送到 origin/main（${DATE}）"
