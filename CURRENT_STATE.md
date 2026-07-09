# CURRENT_STATE（自動生成，禁止手改）

> 本檔由 `python .project/snapshot.py` 生成。任何手寫進度、WBS、交付紀錄都可能過期；
> 以本檔與 `python .project/checks.py` 的即時輸出為準。

- 目前 HEAD: `3aa8ac0`

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

- 完成 7｜待做 2｜卡住 0
- **下一件：`ms-06-carryover` — 記憶/匯出/催辦在多表下沿用**
  - 怎樣算對：localStorage 記住上次選的表與資料、重開還原；各表可匯出 CSV、可催辦（表8無負責人時合理降級）

| 狀態 | id | 要做什麼 |
|---|---|---|
| done | filter-department-all | 部門查詢範圍：從寫死『資訊架構部』改為可選任一部門，並提供『全部部門』選項 |
| done | filter-close-status | 結案狀態篩選：從預設只看『未結案』改為可切換查詢『未結案』『已結案』（或全部） |
| done | ms-01-read-sheets | 多表讀取：能列出所有『數字-』開頭工作表並各自解析 rows/headers，不影響現有單表流程 |
| done | ms-02-profiles | 每表欄位 profile 對應與值正規化，輸出統一標準紀錄 |
| done | ms-03-left-nav | 左側導覽 10 項 + 切表：點選切換載入該表看板 |
| done | ms-04-filters | 母體改可篩選：整合 filter-department-all + filter-close-status，套用到多表 |
| done | ms-05-adaptive-panels | 面板自適應：依 profile 有無對應欄，自動顯示/隱藏面板 |
| todo | ms-06-carryover | 記憶/匯出/催辦在多表下沿用 |
| todo | ms-07-verify-deliver | 逐表驗證與交付：數字對帳、checks 全過、更新使用說明 |

## 工作筆記 worklog（最近；斷在半路就看這段接手）

```
---

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

```

## 最近 10 筆 commit

```
3aa8ac0 ms-04 部門＋結案狀態篩選：每表可選部門(含全部)與 未結案/已結案/全部，即時重算、數字對帳
20bfd38 強化隨時斷線的接手：加 worklog(邊做邊寫)＋多表結構快取(免重撈)＋snapshot 帶出 worklog 尾巴＋SOP 勤commit規範
791b0b3 加接手/續作機制：新增 接手指南.md（含續作提示詞、SOP、踩雷筆記）＋ snapshot 自動帶出待辦進度與下一件
d80ac43 左側 10 表導覽 + 切表（ms-03）：多表載入、點選切換整個看板、記住檔案與所選表
981c78c 檢查頁改為完全自帶邏輯：不再依賴外部 .js（避開 OneDrive 未下載/file:// 擋載入），雙擊即可用
d9b19b3 加多表對映檢查頁：丟入 Excel 即可看各表讀取/欄位對映/嚴重度與結案分布，供人工核對
44fc074 多表讀取與欄位正規化（ms-01/ms-02）：讀所有數字表，各表對應+值正規化，通過真檔抽樣驗證
cd0749b 規劃：多工作表擴充定案（欄位對照表、8 項決策、7 個開發切片）
a3f4808 backlog：記錄 2 項待辦（部門查詢範圍可選/全部、結案狀態可切換未結案與已結案）
599f5ee 在頁首加「複製指標摘要」按鈕，一鍵把關鍵指標整理成文字複製給主管
```
