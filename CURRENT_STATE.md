# CURRENT_STATE（自動生成，禁止手改）

> 本檔由 `python .project/snapshot.py` 生成。任何手寫進度、WBS、交付紀錄都可能過期；
> 以本檔與 `python .project/checks.py` 的即時輸出為準。

- 目前 HEAD: `7c2abe8`

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

- 完成 11｜待做 3｜卡住 0
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
| todo | vuln-aggregate | 第一批A4｜同一 Plugin ID 跨主機收合成一件(影響N台)，降低窗口逐筆負擔 |
| todo | one-page-print | 第一批A5｜一頁列印/PDF:本部門(或全域)摘要可直接貼週報/對上交代 |
| todo | email-send-script | Email 實際寄送：本機 send_mail.ps1 讀 mail-task.json 走公司 relay 寄(E2 手動)＋工作排程器自動(E3) |

## 工作筆記 worklog（最新在最上；斷在半路就看這段接手）

```

## 2026-07-10 V1.13 內建「載入範例資料（天龍八部）」按鈕 ✅ 完成
- 背景：使用者要看假資料但一直載到舊真實檔(其他功能→檔案顯示 弱點彙總報告(New)_V20260702 的TEST.xlsx)。用 computer-use 讀取層看到其畫面：版本已是 V1.12(對)，純粹載錯檔。Claude Chrome 擴充未連(list_connected_browsers 空)→無法替他點 Chrome(唯讀層)。故改用「內建範例資料一鍵載入」根治。
- 成果：assets/sample-data.js(把 docs/測試假資料_天龍八部.xlsx 轉 base64 內嵌，約21KB)；index.html 掛該檔＋「載入範例資料（天龍八部）」按鈕兩處(其他功能選單 #sample-btn＋上傳頁 #sample-btn-2)；main.js loadSample() 讀內建 b64→走既有 loadWorkbook/saveWorkbook。免選檔、離線可用(file:// 也行，不需 fetch)。
- 驗(預覽)：清空 localStorage→上傳頁→點按鈕→測試假資料_天龍八部.xlsx 載入、10表66筆、KPI 55/16/17/27/16.7%、負責人段正淳等天龍八部名、console 無錯、V1.13。

### 接手狀態（給新 session）
- App 版本 **V1.13**。使用者實機：Windows 11 + Chrome，用 **file://** 開 `C:\Users\leea6\OneDrive\2025 Data\AI LAB\CL_patch\index.html`。**Claude Chrome 擴充未連**→Claude 無法直接操作其瀏覽器；要嘛請他連擴充，要嘛靠「載入範例資料」按鈕/口頭指引。
- **測試資料**：`docs/測試假資料_天龍八部.xlsx`(66筆全『資訊架構部』、天龍八部人名、逾期/例外/展延齊、每項6-7筆) 與舊真實檔 `docs/弱點彙總報告(New)_V20260702 的TEST.xlsx` 皆**未進版控**(測試檔)。是否加 .gitignore 使用者尚未定(上次 dismiss)。
- **Email(E2 手動寄 ps1 / E3 排程自動)**：暫停中(backlog email-send-script)，等使用者要開發再做；開發前先問環境(能否跑.ps1 / relay 主機:埠 / Excel / 排程時間)。Email 設定介面 V1.11 已完成。
- **第一批剩餘**：A4 弱點聚合(同 Plugin ID 跨主機收合)、A5 一頁列印/PDF。
- 使用者長期偏好(已存 memory no-ui-annotation-text)：畫面不放說明/備註/自創解釋字。
- 環境雷：本機 `python` 是 Windows Store stub(壞，exit 49/9009)，一律用 **`py`** 跑 .project/checks.py、snapshot.py。

## 2026-07-10 V1.12 我的部門(全站記憶) ＋ 版面收窄放大 ✅ 完成
- 需求(使用者)：①左側白邊太多→放大/往左移，中間字放大；②沒有部門想看全部，要能選自己部門且「下次進來預設就是我的部門」，不用每次重選。
- 我的部門：部門控制從「每張表 filter-dept」升級為左側全站選擇器 #my-dept-select(在導覽頂端)；選擇存 localStorage『vulnDashboard.dept』跨檔沿用；總覽標題/KPI/狀態表/未結數/逾期橫幅/複製摘要/Email 內容全部吃 state.myDept；此檔無該部門→自動退回全部部門。移除表內 filter-dept 與 populateDeptOptions；filter-bar 只留結案狀態。summary.js agg/overall/collectOverdue/render 加 dept 參數；email.js scopedRecords 依 myDept。
- 版面：.container 版心 1280→1600(左白邊約 210→75px)、header-inner 同步 1600；.sheet-nav 288→340px、sheet-name 12.5→14、count 11→12.5、item padding 放大；指標 metric-value 23→26 首格 30→34、label 12→13；tracking/summary 表 th/td 字 14→15。總覽項名由「總覽（全部）」改「總覽」(選部門後不再是全部)。
- 驗(10 項測試檔、桌面 1710 寬)：V1.12；部門選擇器 11 部門；選『資訊架構部』→標題『資訊架構部 總覽』、KPI 1/1/0/0/91.7%、橫幅 1 筆、未結數只第10項 1；reload 後預設仍『資訊架構部』(持久化 OK)；進項目 scope-info 自動『部門：資訊架構部』；切回全部→19/18/…/87.3%；container 1600、nav 340px 量測相符；console 無錯。

## 2026-07-10 V1.11 Email 設定管理介面（其他功能）✅ 完成
- 決策(使用者)：Email 首要；架構=網頁做設定＋產生內容→本機 PowerShell 走公司 SMTP 寄→工作排程器自動(跑在使用者個人電腦)；公司 SMTP=免認證內部 relay(不收密碼)。
- 鐵牆說明：瀏覽器無法直接走 SMTP(無 TCP socket)，故網頁只負責設定＋產生 mail-task.json，實際寄送與自動由本機腳本＋排程做。
- 成果：js/email.js 新增「其他功能→Email 設定」視窗：SMTP 主機/埠/寄件人/收件人/副本/主旨前綴/寄送範圍(逾期未結、近期到期)，存 localStorage(個人套個人)；「預覽通知內容」；「匯出寄送任務」下載 mail-task.json(含 smtp/from/to/cc/subject/body/count，auth:false)。index.html 加選單項＋email.js；summary.js 公開 collectOverdue；css 加表單樣式。
- 驗(localStorage 還原真實 App state 測)：V1.11；EmailCfg.buildContent 主旨「【弱點修補提醒】弱點待處理 5 筆」、逐筆含項目/部門/負責人/弱點/嚴重度/到期/逾期天數；開視窗 6 欄＋範圍勾選、設定回填、預覽正確；console 無錯。
- 待續：E2 本機 send_mail.ps1(讀 mail-task.json→relay 寄，手動)；E3 排程自動＋腳本自解析最新 xlsx(需 Excel COM/檔案路徑/排程時間)。寫腳本前先問環境。

## 2026-07-10 V1.10 畫面去說明字 ✅ 完成
```

## 最近 10 筆 commit

```
7c2abe8 V1.09–V1.12：主管稽核全域逾期／去說明字／Email 設定介面／我的部門＋版面
caae77b 接手包：snapshot 改抓 worklog 最新段(修 head 變數撞名)，供開新 session 無縫接手
e916b73 V1.08：新增主管總覽首頁（全部項目一頁彙總：KPI 合計＋各項目狀態表＋堆疊圖，可點列進細項）
8350a11 V1.07：查詢框移到頁首中央；版本與操作按鈕收進「其他功能」下拉，頁首更清爽
f3ebc15 V1.06：查詢框常駐分頁上方(首頁明顯處)，輸入即自動切至查詢並顯示結果
d27e8f5 V1.05：全站正式化（對外版）— 自創名詞改正式用語、移除說明提示與裝飾圖示、明細/CSV/催辦/搜尋去除備註
aaa7085 V1.04：左側工作表清單加寬(288px)，最長表名完整顯示不再被截斷
2090be2 V1.03：左側工作表清單改單行(名稱省略號+未結數同列)，一眼看完全部表
f870dd9 V1.02：函式庫改本機載入(assets/vendor)，離線可用，修正 XLSX is not defined；checks 白名單 vendor lib
cb5861f V1.01：加不快取 meta + script 版本查詢字串，根治更新後看到舊版的問題
```
