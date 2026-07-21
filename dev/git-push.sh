#!/usr/bin/env bash
# ============================================================
# 一鍵：把目前改動 commit（訊息自動帶當天日期）並推到 GitHub。
# 用法：
#   bash dev/git-push.sh "做了什麼"  → commit 訊息 = 「2026-07-11：做了什麼」
#   bash dev/git-push.sh             → 用預設訊息「2026-07-11：更新」
# 註：*.xlsx（真實資料）、dist/、*.zip、個人設定 已由 .gitignore 排除，不會被推。
#
# 本腳本只暫存「已追蹤檔案」的變更（git add -u），不會自動加入新檔案。
# 這是刻意的：本 repo 為公開 GitHub，用 git add -A 一把梭很容易把
# 尚未被 .gitignore 涵蓋的新檔案（報告、真實資料、權杖）推上去。
# 有新檔案要進版控，請自己先 git add <檔名> 再跑本腳本。
# ============================================================
set -e
cd "$(dirname "$0")/.."

DATE=$(date +%Y-%m-%d)
MSG="${1:-更新}"

git add -u

# 有未追蹤的新檔案就提醒，但不自動加入
UNTRACKED=$(git ls-files --others --exclude-standard)
if [ -n "$UNTRACKED" ]; then
  echo "⚠ 以下新檔案『不會』被推上去（如需納入，請先 git add）："
  echo "$UNTRACKED" | sed 's/^/    /'
  echo
fi

if git diff --cached --quiet; then
  echo "沒有新變更，略過 commit。"
else
  git commit -m "${DATE}：${MSG}"
  echo "已 commit：${DATE}：${MSG}"
fi

# 首次推會自動建立 upstream；之後直接推 main
git push -u origin main
echo "✅ 已推送到 origin/main（${DATE}）"
