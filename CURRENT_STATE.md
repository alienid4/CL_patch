# CURRENT_STATE（自動生成，禁止手改）

> 本檔由 `python .project/snapshot.py` 生成。任何手寫進度、WBS、交付紀錄都可能過期；
> 以本檔與 `python .project/checks.py` 的即時輸出為準。

- 目前 HEAD: `e916b73`

## 強制層檢查即時結果

```
========================================================
強制層檢查結果
========================================================
[PASS] GIT 版控
[PASS] 無寫死密鑰
[PASS] 驗收測試（警告放行） -- 此專案尚無 pytest 測試；建議補上。設 REQUIRE_TESTS=1 可改為強制
[PASS] 決策與文件一致
========================================================
結論: 全部 PASS，可以 commit / 宣稱完成
```

## 已登錄決策（decisions.json）

| id | choice | status | note |
|---|---|---|---|
| multi-sheet-scope | 10 張數字表各一左側項；範本+每表profile+面板自適應（Q1=A） | confirmed |  |
| filter-parameterized | 母體不鎖單位；單位與結案狀態改為可篩選（含全部）（Q2） | confirmed |  |
| severity-unify | 中/英/BitSight 一律映射 Critical/High/Medium/Low，保留原值（Q4） | confirmed |  |
| sheet3-severity | 表3嚴重度取『發現嚴重性 Finding Severity』（E1） | confirmed |  |
| sheet9-counts | 表9風險計數『中*4 低*2』解析彙總成嚴重度統計（E2） | confirmed |  |
| sheet8-split | 表8單位欄拆成 單位+負責人（E3） | confirmed |  |
| close-rule | 未結/進行中=未結案；結案/已結案/已修補且無『未』=已結案；表8用結案日期（E4） | confirmed |  |
| search-window-sheet | 先各表各查；『資安弱點追蹤窗口』表當參考不做分頁（Q6） | confirmed |  |

## 待辦進度（backlog.json）

- 完成 9｜待做 0｜卡住 0

| 狀態 | id | 要做什麼 |
|---|---|---|
| done | filter-department-all | 部門查詢範圍：從寫死『資訊架構部』改為可選任一部門，並提供『全部部門』選項 |
| done | filter-close-status | 結案狀態篩選：從預設只看『未結案』改為可切換查詢『未結案』『已結案』（或全部） |
| done | ms-01-read-sheets | 多表讀取：能列出所有『數字-』開頭工作表並各自解析 rows/headers，不影響現有單表流程 |
| done | ms-02-profiles | 每表欄位 profile 對應與值正規化，輸出統一標準紀錄 |
| done | ms-03-left-nav | 左側導覽 10 項 + 切表：點選切換載入該表看板 |
| done | ms-04-filters | 母體改可篩選：整合 filter-department-all + filter-close-status，套用到多表 |
| done | ms-05-adaptive-panels | 面板自適應：依 profile 有無對應欄，自動顯示/隱藏面板 |
| done | ms-06-carryover | 記憶/匯出/催辦在多表下沿用 |
| done | ms-07-verify-deliver | 逐表驗證與交付：數字對帳、checks 全過、更新使用說明 |

## 工作筆記 worklog（最新在最上；斷在半路就看這段接手）

```

## 2026-07-10 V1.08 主管總覽首頁 ✅ 完成
- 成果：js/summary.js；左側置頂「總覽（全部）」預設落點；一頁 KPI 合計(未結19/逾期18/近期0/高風險1/結案率87.3%)+各項目狀態表(狀態燈:有逾期/追蹤中/已全數結案，可點列進細項)+堆疊圖；複製摘要在總覽出全部彙總文字；查詢在總覽時先進入目前項目。
- 驗：預設總覽、KPI/狀態表/圖正確、點列進表9(未結16)、無 console 錯、V1.08。

## 2026-07-10 V1.07 頁首重整 ✅ 完成
- 成果：查詢框移到藍底頁首中央；版本號與 複製指標/重新選擇/清除 收進右上「其他功能 ▾」下拉(含檔名/版本)；外部點擊關閉。
- 驗：頁首查詢框顯示、下拉開合、項目齊、版本/檔名在選單、搜尋作用、無 console 錯、V1.07。

## 2026-07-10 V1.06 查詢常駐首頁 ✅ 完成
- 成果：查詢框搬到分頁上方常駐(每頁可見)，輸入自動切到「查詢」分頁並執行；快速篩選 chips 與結果仍在查詢分頁。search.js 改用全域 #global-search-input，main 綁 input/clear。
- 驗：常駐框顯示、搜負責人5筆/已逾期16筆、自動切分頁、清除有效、無 console 錯、V1.06。

## 2026-07-08 V1.05 正式化(對外用) ✅ 完成
- 成果：全站正式用語。分頁去 emoji；自創名詞改正式(安全名單→例外核准未到期、例外治理雷達→例外與展延概況、例外破口→例外核准已逾期、慢性風險→反覆展延／例外、今日行動清單→優先處理清單、風險加權排行→風險排序、已/未修復→已/未結案、修復率→結案率、快到期→近期到期、尚安全→尚未到期)；移除說明提示；明細表/CSV/催辦/搜尋 皆去「備註」。
- 驗：分頁/面板/例外統計/明細欄 全部正式化、無備註欄、無 console 錯、checks PASS。
- 待辦：docs/使用說明.html 仍是單表舊版(emoji+舊詞)，需另做正式重寫。

## 2026-07-08 V1.03 側欄單行化 ✅ 完成
- 改：左側工作表項目 雙行→單行(flex，名稱省略號+未結數同列)，item 33px、10項共 360px 一眼看完；長名 hover 顯全名。
- 驗：V1.03、單行、同列、截斷、無錯。

## 2026-07-08 V1.02 離線函式庫（修 XLSX is not defined）✅ 完成
- 問題：CDN 抓 SheetJS，硬重新整理+Wi-Fi 斷 → XLSX 未載入 → 解析失敗。教訓：改版後沒測「離線/硬重整」路徑。
- 修：把 xlsx/chart 下載進 assets/vendor/、index.html 改本機載入(不依賴 CDN)；handleFile 加 XLSX 未載入的友善提示；checks.py 白名單 vendor 檔(minified 誤判 token)。
- 驗：XLSX/Chart 皆從本機載入、圖表可畫、V1.02、匯入正常、無 console 錯、checks PASS。

## 2026-07-08 版本號顯示 ✅ 完成（V1.0）
```

## 最近 10 筆 commit

```
e916b73 V1.08：新增主管總覽首頁（全部項目一頁彙總：KPI 合計＋各項目狀態表＋堆疊圖，可點列進細項）
8350a11 V1.07：查詢框移到頁首中央；版本與操作按鈕收進「其他功能」下拉，頁首更清爽
f3ebc15 V1.06：查詢框常駐分頁上方(首頁明顯處)，輸入即自動切至查詢並顯示結果
d27e8f5 V1.05：全站正式化（對外版）— 自創名詞改正式用語、移除說明提示與裝飾圖示、明細/CSV/催辦/搜尋去除備註
aaa7085 V1.04：左側工作表清單加寬(288px)，最長表名完整顯示不再被截斷
2090be2 V1.03：左側工作表清單改單行(名稱省略號+未結數同列)，一眼看完全部表
f870dd9 V1.02：函式庫改本機載入(assets/vendor)，離線可用，修正 XLSX is not defined；checks 白名單 vendor lib
cb5861f V1.01：加不快取 meta + script 版本查詢字串，根治更新後看到舊版的問題
a985c98 接手指南補：4.0 別過度確認、版本標籤慣例
12db3ce 右上角加版本號 V1.0：可核對看到的版本與開發是否一致；日後每次變更 bump version.js
```
