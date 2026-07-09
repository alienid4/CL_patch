# CURRENT_STATE（自動生成，禁止手改）

> 本檔由 `python .project/snapshot.py` 生成。任何手寫進度、WBS、交付紀錄都可能過期；
> 以本檔與 `python .project/checks.py` 的即時輸出為準。

- 目前 HEAD: `d80ac43`

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

- 完成 3｜待做 6｜卡住 0
- **下一件：`filter-department-all` — 部門查詢範圍：從寫死『資訊架構部』改為可選任一部門，並提供『全部部門』選項**
  - 怎樣算對：畫面有部門篩選（下拉/分頁），可選任一部門或『全部部門』；選定後所有統計/清單/催辦/圖表只反映該範圍；切換即時更新且數字可對帳一致；預設值可設定

| 狀態 | id | 要做什麼 |
|---|---|---|
| todo | filter-department-all | 部門查詢範圍：從寫死『資訊架構部』改為可選任一部門，並提供『全部部門』選項 |
| todo | filter-close-status | 結案狀態篩選：從預設只看『未結案』改為可切換查詢『未結案』『已結案』（或全部） |
| done | ms-01-read-sheets | 多表讀取：能列出所有『數字-』開頭工作表並各自解析 rows/headers，不影響現有單表流程 |
| done | ms-02-profiles | 每表欄位 profile 對應與值正規化，輸出統一標準紀錄 |
| done | ms-03-left-nav | 左側導覽 10 項 + 切表：點選切換載入該表看板 |
| todo | ms-04-filters | 母體改可篩選：整合 filter-department-all + filter-close-status，套用到多表 |
| todo | ms-05-adaptive-panels | 面板自適應：依 profile 有無對應欄，自動顯示/隱藏面板 |
| todo | ms-06-carryover | 記憶/匯出/催辦在多表下沿用 |
| todo | ms-07-verify-deliver | 逐表驗證與交付：數字對帳、checks 全過、更新使用說明 |

## 最近 10 筆 commit

```
d80ac43 左側 10 表導覽 + 切表（ms-03）：多表載入、點選切換整個看板、記住檔案與所選表
981c78c 檢查頁改為完全自帶邏輯：不再依賴外部 .js（避開 OneDrive 未下載/file:// 擋載入），雙擊即可用
d9b19b3 加多表對映檢查頁：丟入 Excel 即可看各表讀取/欄位對映/嚴重度與結案分布，供人工核對
44fc074 多表讀取與欄位正規化（ms-01/ms-02）：讀所有數字表，各表對應+值正規化，通過真檔抽樣驗證
cd0749b 規劃：多工作表擴充定案（欄位對照表、8 項決策、7 個開發切片）
a3f4808 backlog：記錄 2 項待辦（部門查詢範圍可選/全部、結案狀態可切換未結案與已結案）
599f5ee 在頁首加「複製指標摘要」按鈕，一鍵把關鍵指標整理成文字複製給主管
3c086b3 init：導入 4.0 開發包（pipeline→.project，git 就緒）
```
