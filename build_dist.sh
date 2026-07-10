#!/usr/bin/env bash
# ============================================================
# 產生「正式包」：只複製要對外發布的檔案到 dist/，
# 排除真實資料檔(*.xlsx)與所有開發檔(.project/docs/一次性開發包…)。
# 用法：bash build_dist.sh
#   之後在 PowerShell 打包 zip：
#     Compress-Archive -Path dist/* -DestinationPath 弱點彙總Dashboard_版本.zip -Force
# ============================================================
set -e
cd "$(dirname "$0")"

VER=$(grep "APP_VERSION" config/version.js | grep -oE "V[0-9]+\.[0-9]+" | head -1)
DIST="dist"

echo "== 版本 $VER：清空並重建 $DIST/ =="
rm -rf "$DIST"
mkdir -p "$DIST/config" "$DIST/js" "$DIST/css" "$DIST/assets/vendor"

echo "== 複製白名單（只帶這些）=="
cp index.html "$DIST/"
cp config/version.js config/config.js config/features.js config/profiles.js "$DIST/config/"
cp js/*.js "$DIST/js/"
cp css/style.css "$DIST/css/"
cp assets/vendor/xlsx.full.min.js assets/vendor/chart.umd.min.js "$DIST/assets/vendor/"

echo "== 防呆：dist 內不該出現資料檔/開發檔 =="
LEAK=$(find "$DIST" \( -name "*.xlsx" -o -name "*.xls" -o -name "*.csv" -o -name "*.md" -o -name "sample-data.js" \) 2>/dev/null || true)
if [ -n "$LEAK" ]; then echo "!! 發現不該打包的檔案，已中止："; echo "$LEAK"; exit 1; fi

echo "== dist 內容 =="
find "$DIST" -type f | sort
echo "----"
echo "檔數：$(find "$DIST" -type f | wc -l)　總大小：$(du -sh "$DIST" | cut -f1)"
echo "完成 → $DIST/（版本 $VER）"
echo
echo "打包 zip（PowerShell）：Compress-Archive -Path dist/* -DestinationPath 弱點彙總Dashboard_${VER}.zip -Force"
