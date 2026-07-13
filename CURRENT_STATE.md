# CURRENT_STATE（自動生成，禁止手改）

> 本檔由 `python .project/snapshot.py` 生成。任何手寫進度、WBS、交付紀錄都可能過期；
> 以本檔與 `python .project/checks.py` 的即時輸出為準。

- 目前 HEAD: `8104c7e`

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

- 完成 15｜待做 3｜卡住 0
- **下一件：`vuln-aggregate` — 第一批A4｜同一 Plugin ID 跨主機收合成一件(影響N台)，降低窗口逐筆負擔**
  - 怎樣算對：提供聚合檢視:同弱點合併顯示影響台數、可展開看各主機；不破壞逐筆明細

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
| done | audit-overdue-global | 主管稽核：總覽頁把『全部項目逾期未結（沒修補）』的弱點一鍵攤開 |
| done | my-dept-landing | 第一批A1｜窗口視角：記住『我的部門』，開檔/進項目自動套用該部門篩選 |
| done | feature-toggle-framework | 功能開關框架＋設定面板（模組化 feature toggle，A＋B 兩層） |
| done | dept-owner-ranking | 主管：部門／負責人紅黑榜（逾期多者在前，紅/綠榜，前5名+展開） |
| done | sla-compliance | 主管：SLA 達成率（各嚴重度政策天數，未結案未逾期比率） |
| done | trend-history | 主管：趨勢(跟上次比)＋歷史快照 |
| todo | vuln-aggregate | 第一批A4｜同一 Plugin ID 跨主機收合成一件(影響N台)，降低窗口逐筆負擔 |
| todo | one-page-print | 第一批A5｜一頁列印/PDF:本部門(或全域)摘要可直接貼週報/對上交代 |
| todo | email-send-script | Email 實際寄送：本機 send_mail.ps1 讀 mail-task.json 走公司 relay 寄(E2 手動)＋工作排程器自動(E3) |

## 工作筆記 worklog（最新在最上；斷在半路就看這段接手）

```

## 2026-07-13 V1.31 查詢快速篩選改「可複選」（多條件疊加）✅ 完成
- 使用者要求：查詢分頁的快速篩選 chips 原本單選(選一個列全部)，要能多選疊加，例：今日待追蹤＋High、今日待追蹤＋High＋例外管理中，一直收窄。
- 設計：分面篩選——「同類 OR、跨類 AND」。同類(互斥/同維度)：到期狀態(已逾期/近期/今日待追蹤/六個月)、嚴重度(Critical/High/Medium)、處置階段(例外管理中/首次展延中)各為一類，類內多選＝OR(聯集，避免 High+Medium 變空集)；其餘(例外核准未到期/反覆展延例外)各自獨立，跨類一律 AND。避免了純 AND 下同嚴重度互斥→空集的困擾。
- 成果：search.js 由 state.activeKey(單) 改 state.sel{}(集合)；chip 點擊 toggle，「全部」清空；buildPredicate() 依 OR_GROUP 分組(due/sev/stage)算「跨類 every、類內 some」；標題列出已選(A ＋ B ＋ C)；syncChips 反映多選、無選時「全部」亮。CSS 不動(.search-chip.active 支援多顆亮)。
- 驗(預覽 8790 起 py 伺服器；DataTransfer 灌 docs/測試假資料_天龍八部.xlsx；某表7筆)：同類 OR High(0)＋Medium(3)=3；跨類 AND 今日待追蹤(4)＋Medium(3)=2、已逾期(4)＋例外管理中=1(破口)；多 chip 同時 active；全部清空回7；console 無錯；V1.31；?v 全 1.31。
- 注意：預覽 launch.json 的 python 伺服器指到錯目錄(全 404)——用 py -m http.server 8790 --directory 正確路徑另起才可測。

## 2026-07-11 V1.30 下鑽稽核補漏 ＋ 清乾淨備註 ✅ 完成
- 使用者要求：全站下鑽都檢查過了嗎？備註都拿掉了嗎？
- 下鑽稽核(逐模組)：dashboard 指標卡/圖表✓、sev-repair 未結/已結/其他✓但**合計欄漏掉**→補上(cell(r.total,r.records,'X 全部'))含 tfoot 合計(concat 全狀態)；tracking 數字✓；stats 階段卡/chip/gov/圖✓；summary KPI(V1.29)/項目表(點列進項目)/紅黑榜/SLA/趨勢卡✓；matrix 格子✓；search 用明細表✓。今日行動/風險排序是預覽表(列不逐一下鑽,但有『查看全部』全量入口)——保留。
- 備註清除：dashboard 指標卡 title:'點擊看明細' tooltip 移除；優先清單教學句『僅顯示前20筆,可點查看全部…』整行刪(有查看全部按鈕)；matrix empty『已隱藏全部,改按上方清除全部復原』→『已隱藏全部。』；history empty『尚無歷史;之後每次匯入…』→『尚無歷史資料。』；趨勢『只有1期…下次匯入即可比較』→只留『目前只有1期(日期)』。保留:明細表 Name/Host 過長 title(=Excel顯示全文,使用者認可)、chart 標題、共N筆/共N項目等功能性計數。
- 驗(預覽 XLSX 造真檔 render dashboard)：metric 卡無 title；sev-repair 合計欄可點(Critical 1未結+1已結=2)→『Critical 全部(2筆)』2列；優先清單無教學句；console 無錯；V1.30;?v全1.30。

## 2026-07-11 V1.29 總覽 KPI 可鑽取 ＋ 明細寬表抓取拖曳捲動(拉把) ✅ 完成
- 使用者回報(總覽頁)：①上排 KPI(未結案/已逾期/近期到期/高風險未結)不能點；②展開的寬明細表拉到最右很難拉，要個「拉把」。
- 成果：
  · summary.js KPI 卡加 collect(pred) 跨全部項目彙整該類未結案紀錄→onclick UI.openDetail；未結案/已逾期/近期到期/高風險未結 可點，整體結案率不可點。css .summary-kpis .metric-card:not(.clickable) 取消 pointer/hover(不裝可點)。
  · ui-common.js enableDragScroll(el)：在捲動容器 mousedown 抓住拖曳→平移 scrollLeft/scrollTop(門檻3px、不攔表頭排序/按鈕/可點數字、move/up 綁 document 用完即移除)；buildDetailTable 的 .detail-viewport 套用並 export UI.enableDragScroll。css .drag-scroll{cursor:grab}/.dragging{grabbing+no-select}；.detail-viewport 捲軸加粗成明顯「拉把」(14px、有色 thumb、hover 變主色)。
- 驗(預覽 XLSX 造真檔 render 總覽；注意 severity 欄名要用 profiles 別名『風險等級』非『Severity』否則 Unknown)：KPI 未結案3/已逾期1(已結案排除)/近期0/高風險2/結案率25%不可點；點高風險→明細2筆；.detail-viewport 有 drag-scroll、直接設 scrollLeft 可捲(sw900)、合成 clientX 拖曳 x400→150 scrollLeft=250、dragging class 上/下正確；console 無錯；V1.29;?v 全1.29。
- 註：拉把目前套在 drill 明細表(.detail-viewport)——即使用者展開的寬表。若要人員追蹤/紅黑榜等常駐寬表也能拖，呼叫 UI.enableDragScroll 即可(未來延伸)。

## 2026-07-11 V1.28 修 bug：已結案不再判逾期 ✅ 完成
- 使用者回報：不少「已結案」卻顯示「已逾期」。原因：overdue 只看到期日(daysLeft<0)，沒管 closeBucket。
- 修法(已結案一律不再用到期日判斷)：
  · sheets.js(多表實際路徑)：overdue/overdueDays 加 closeBucket!=='closed' guard(源頭修正，summary/history 直接讀 sheet.records 也對)。
  · analysis.js：isOverdue/withinDays/withinSixMonths/isTodayTrack 全加 !isClosed(r) guard；bandOf 開頭 closeBucket==='closed'→'noDue'(已結案不進已逾期等帶)；finalizeRecord 統一覆寫 r.overdue/overdueDays(close-aware)，確保各路徑一致。
  · ui-common 明細表逾期天數欄/紅列不用改：它讀 r.overdue/overdueDays，源頭修好就自動正確。
```

## 最近 10 筆 commit

```
8104c7e chore：gitignore 真實資料/個人設定，新增 git-push.sh 一鍵推（日期戳）
91cd0e0 V1.30：下鑽稽核補漏 ＋ 清乾淨備註
772341e V1.29：總覽 KPI 可鑽取 ＋ 明細寬表抓取拖曳捲動（拉把）
62ee44d V1.28：修 bug — 已結案不再判逾期
a747a3d docs：接手指南補「打包正式版 SOP」章節（V1.27）
f4d4f98 build：新增 build_dist.sh 產生正式包（白名單複製＋防呆）
177c072 V1.27：打包正式版 — 移除「天龍八部」範例資料
6d33be3 docs：更新 .project 接手文件到 V1.26
4ef2455 V1.26：紅黑榜排行預設只顯示前 5 名＋展開全部
1707f04 V1.25：趨勢「跟上次比」＋歷史快照（三個新功能收官）
```
