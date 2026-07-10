# CURRENT_STATE（自動生成，禁止手改）

> 本檔由 `python .project/snapshot.py` 生成。任何手寫進度、WBS、交付紀錄都可能過期；
> 以本檔與 `python .project/checks.py` 的即時輸出為準。

- 目前 HEAD: `76d0153`

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

## 2026-07-10 V1.26 紅黑榜排行預設只顯示前 5 名＋展開全部 ✅ 完成
- 需求(使用者)：紅黑榜負責人排行在「全部部門」時很長(範例50人)，預設只顯示前5名(逾期最多)＋「展開全部」按鈕。並確認「模組化=功能開關」已於 V1.22 做好(此為紅黑榜模組內部顯示行為，不另開開關)。
- 補充：驗證負責人/部門排行本就跟著左側「部門」選擇器縮(偽造第二部門測試：全部部門50人→選資訊架構部45人、被移走的玄慈/喬峰從榜上消失)，非 bug；使用者原以為列全部人是因無部門，實為範例66筆全在單一部門。
- 成果：summary.js makeSortableTable 加 limit 參數：capped=list>limit 時，預設 slice(0,limit) 只顯示前 N(依目前排序)，附「展開全部（N）／收合」按鈕，回傳 wrapper(含 table-scroll+按鈕)；rankBlock 傳 limit=5。展開/排序連動:排序改變後前5名跟著換。css .rank-expand。
- 驗(預覽範例)：部門排行1列無按鈕；負責人排行顯示前5(玄慈2逾期首)+「展開全部（50）」；點展開→50列/「收合」、再點→回5；點高風險未結欄首→前5隨新排序換;console 無錯;V1.26;?v全1.26。

## 2026-07-10 V1.25 趨勢「跟上次比」＋歷史快照（第三個新模組，三個新功能收官）✅ 完成
- 需求(使用者)：每次匯入=一份快照，比對本次vs上次。確認採 A(自動記+去重)。
- 架構：js/history.js 新模組。record(sheets,fileName,dateStr) 存輕量快照(不存整份Excel，只存 open/overdue/closed/high/total/rate + 未結弱點指紋 openKeys=host||pluginId)；去重=同檔名同日覆蓋；localStorage『vulnDashboard.history』留最近 12 期。只在 handleFile(真實匯入)記；tryRestore(自動還原)/loadSample(範例)不記，免污染。main.js 加 todayKey(YYYY-MM-DD)、handleFile 成功後 record、selectSheet/resetToUpload 加 History.destroyChart。
- 趨勢畫面(總覽首頁最上，可開關 panel-trend)：本次vs上次三張卡「新增未結(紅,可點看實際筆數)／結案消失(綠,可點看指紋清單)／未結淨變化」＋對照期別；≥2期畫未結/逾期趨勢線(Chart.js line)。新增用目前檔案 open 且 key 在新增集→openDetail；消失只有指紋→openModal 列 host/pluginId。註冊 config/features.js panel-trend(群組總覽首頁,置頂)。css .trend-*。
- 驗(預覽,直接呼叫 History.record 模擬兩次匯入)：首份 open55/overdue16/46指紋；同檔同日再記→仍1期(去重OK)；塞前後兩期(前期多2假key少3key)→新增3(紅可點=3筆實際)、消失2(綠可點=指紋清單FAKEHOST 2列)、淨變化+10、對照『本期2026-06-15 vs 上期2026-06-01』、趨勢線 Chart 實例存在；關趨勢開關→趨勢消失且SLA仍在；console 無錯；V1.25;?v全1.25。
- 註：新增/消失以(host+pluginID)指紋計(同弱點同主機算一件)、淨變化以未結筆數計，單位略不同屬合理。趨勢為全部部門(歷史不分部門)。真實 record 只在使用者選檔匯入時觸發(範例/自動還原不記)。三個新功能(紅黑榜/SLA/趨勢)全數完成，皆掛功能開關。

## 2026-07-10 V1.24 SLA 達成率（第二個新模組，掛功能開關）✅ 完成
- 需求(使用者)：各嚴重度 SLA 政策 Critical7/High30/Medium90/Low180。查資料無「發現日/掃描日」欄(profiles 只有 name 別名含『發現』是弱點名非日期)→無法算真正時效。決定：達成率＝各嚴重度「未結案中未逾期」比率；政策天數當目標對照，放 config.sla(可改)。日後 Excel 有發現日再升級真時效。
- 成果：config.js 加 sla:{Critical:7,High:30,Medium:90,Low:180}。summary.js slaStats(sheets,dept)：各嚴重度統計 open/overdue(存 records)，rate=(open-overdue)/open(open=0→null顯示—)。renderSLA 出表：嚴重度｜政策(天)｜未結案｜逾期｜達成率(長條+百分比，≥90綠/70-90黃/<70紅)；未結/逾期數可點 drill。加 module 級 drillTd 共用。config/features.js 註冊 panel-sla(群組『總覽（首頁）』)。css .sla-*。
- 驗(預覽範例)：Critical 7天/未結16/逾期6/62.5%(=(16-6)/16)、High 30/11/0/100%、Medium 90/15/10/33.3%、Low 180/9/0/100%，數字對帳；點 Critical 逾期→彈窗6筆；關 SLA 開關→SLA表消失且紅黑榜仍在(獨立)；console 無錯；V1.24;?v 全1.24。
- 剩最後一個：#1 跟上次比的趨勢(每次匯入=一份輕量快照，存 localStorage，比對本次vs上次；設計待使用者確認 auto+dedupe 後再做)。

## 2026-07-10 V1.23 部門／負責人紅黑榜（第一個掛進功能開關的新模組）✅ 完成
- 需求(使用者)：主管要一眼知道「哪個部門/誰逾期最多、結案率最差」→ 找誰談。做成模組、掛在功能開關。
- 成果：summary.js 加 rankBy(sheets,dept,keyFn) 跨全部項目彙整(部門=r.unit、負責人=r.owner)，算 未結/已逾期/高風險未結/已結/結案率，並存各子集 records 供 drill；預設按已逾期多者在前。renderRankings 在總覽首頁(圖表下方)出兩張表(部門排行/負責人排行)；makeSortableTable 通用可排序表(欄首可排序、數字欄首點=大到小)。每個數字可點→UI.openDetail 看實際筆數。紅黑視覺：有逾期列 row-overdue(紅)、全數結案列 row-clean(綠, css #f0f9f1)。config/features.js 註冊 panel-red-list(群組『總覽（首頁）』, 預設開)；summary.render 用 Features.isOn 包起來。css .rank-wrap/.rank-block/.rank-table。
- 驗(預覽範例)：總覽出現紅黑榜；部門排行資訊架構部 55未結/16逾期/27高風險/11已結/16.7%(對帳 55+11=66、11/66=16.7%)；負責人排行逾期者紅列在上(玄慈2逾期居首)、全結案綠列在下(包不同等100%)；點玄慈已逾期→彈窗2筆；點已結案欄首→排序;功能開關關掉紅黑榜→整塊消失(reload 持久化沿用框架)；console 無錯；V1.23;?v 全1.23。
- 下一步(剩兩個新功能)：#2 SLA 達成率(要先定各嚴重度天數政策)、#1 跟上次比的趨勢(要存歷史快照)。都照同模式掛進功能開關。

## 2026-07-10 V1.22 功能開關框架＋設定面板（模組化 feature toggle，A＋B 兩層）✅ 完成
- 決策(使用者)：功能模組化、有開關；主管不喜歡就到「後台」關掉。確認採 A＋B 兩層(config 出廠預設＋個人 localStorage 覆寫)。先做框架＋設定面板，把現有分頁/面板納管，再逐一加新功能(紅黑榜/SLA/趨勢)。
```

## 最近 10 筆 commit

```
76d0153 V1.26：紅黑榜排行預設只顯示前 5 名＋展開全部
ddc625c V1.25：趨勢「跟上次比」＋歷史快照（三個新功能收官）
1056942 V1.24：SLA 達成率（第二個新模組，掛功能開關）
ac48a01 V1.23：部門／負責人紅黑榜（第一個掛進功能開關的新模組）
871eb7c V1.22：功能開關框架＋設定面板（模組化 feature toggle，A＋B 兩層）
26b0023 V1.21：面板改名＋署名改＋總覽項目表可排序（去括號備註）
22a1c69 V1.20：結案狀態改全域（移到左側「部門」下面，持久化）
b559c57 V1.19：交叉分析改「排除式」— 點嚴重度＝把它藏起來（其餘全留）
0fc2fc4 V1.18：全站圖表／百分比可鑽取（是數字就能點看實際筆數）
5043563 V1.17：交叉分析篩掉的列/欄整個消失（不淡化）＋去說明備註
```
