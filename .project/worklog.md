# 工作筆記 worklog — 邊做邊寫，斷線先讀這個

> 用途：防「Wi-Fi 隨時斷」。切片做到一半斷了，下個 AI 讀這裡就知道**接哪一步**，不用重讀程式猜、不用重撈重想。
> 規矩：
> ① 開一個切片**前**，先寫「要做什麼 / 怎樣算對 / 計畫步驟」——**先寫意圖再動手**。
> ② 過程中每完成一小塊就更新「已驗到哪 / 剛發現的事實」並**存檔**（硬斷線只有磁碟上的活得下來）。
> ③ 切片 commit 完，把該段收斂成一行結論。
> ④ 最新的寫在**最上面**。（`snapshot.py` 會把本檔最後幾行帶進 `CURRENT_STATE.md`）

---

## 2026-07-08 V1.02 離線函式庫（修 XLSX is not defined）✅ 完成
- 問題：CDN 抓 SheetJS，硬重新整理+Wi-Fi 斷 → XLSX 未載入 → 解析失敗。教訓：改版後沒測「離線/硬重整」路徑。
- 修：把 xlsx/chart 下載進 assets/vendor/、index.html 改本機載入(不依賴 CDN)；handleFile 加 XLSX 未載入的友善提示；checks.py 白名單 vendor 檔(minified 誤判 token)。
- 驗：XLSX/Chart 皆從本機載入、圖表可畫、V1.02、匯入正常、無 console 錯、checks PASS。

## 2026-07-08 版本號顯示 ✅ 完成（V1.0）
- 成果：config/version.js(window.APP_VERSION='V1.0')；右上角顯示、hover 顯日期；驗過。
- **紀律：之後每次 App 變更都要 bump config/version.js（小版 +0.01），回報時講版號。** 目前基準 V1.0＝多表擴充完工。

## 2026-07-08 ms-06 記憶/匯出/催辦 + ms-07 逐表驗證交付 ✅ 完成（多表擴充全數完工）
- ms-06：記憶(base64)還原OK；r.risk=severityRaw 讓 Risk 欄/CSV 有值；CSV(6.5KB)/單人+批次催辦 都驗過；無 console 錯。
- ms-07：10 表逐一切換無錯、抽樣數字對帳一致；README 補多表說明；checks 全 PASS。
- **多表擴充 ms-01～ms-07 全部完成**。下一步：合併 work/multi-sheet → main（等 USER 點頭）。

## 2026-07-08 ms-05 面板自適應 ✅ 完成
- 成果：multi.js computeCaps→s.caps；main 依 caps.stagePanel 切「例外/展延統計」分頁鈕；dashboard 依 caps.severity 隱藏 嚴重度group/圓餅/修復表；stats 依 stagePanel early-return。
- 驗過：表1/9 完整；表6 有嚴重度但無 TAB3；表8 全精簡(無嚴重度無TAB3)；表10 無嚴重度但有 TAB3。無 console 錯。
- 下一件：ms-06 記憶/匯出/催辦在多表下沿用（記憶已於 ms-03 用 base64 完成；主要驗匯出CSV、催辦，表8無負責人降級）。

## 2026-07-08 ms-04 部門＋結案狀態篩選 ✅ 完成
- 成果：filter-bar 兩個下拉（部門=該表distinct單位+全部；結案=未結案/已結案/全部），預設 全部部門+未結案；change→applyFilters 重算重繪。
- 實作：main.js applyFilters()（deptFiltered→scoped→Analysis.assembleResult）、populateDeptOptions()、renderResult()；index.html filter-bar；css。
- 驗過(表9)：部門選項加總136、未結16/已結120/全部136、選單一部門數字縮到該部門、scope 反映、無 console 錯。
- 下一件：ms-05 面板自適應（缺欄就隱藏該面板，如表6/7無例外面板、表8最精簡）。

## 2026-07-08 目前狀態（乾淨落點）

- 分支：`work/multi-sheet`
- 落點：**乾淨**（ms-03 已 commit；接手/續作機制已 commit）——目前在切片之間，無半成品
- 進行中步驟：無
- **下一件：ms-04**（部門＋結案狀態篩選；整合 backlog 的 filter-department-all / filter-close-status）— 尚未開始
- 已驗事實：多表讀取/對映/左側切表 都驗過；TEST 檔是稀疏樣本（表1–4 未結案顯示 0 屬正常）
- 提醒：`python` 是空殼→用 `py`；TEST 檔被 Excel 鎖→先 `cp` 再讀；驗證用 `docs/多表檢查.html` 或 `py -m http.server`

---

## 範本（開一個新切片時，複製到最上面填）

```
## [日期] [切片 id] 進行中
- 要做：…
- 怎樣算對：…
- 計畫步驟：1)…  2)…  3)…
### 進度
- [x] 步驟1 —（驗法/結果）
- [ ] 步驟2 ← 現在卡在這
- 剛發現：…（路徑、筆數、雷、要注意的欄位…）
- 未驗 / 待辦：…
```
