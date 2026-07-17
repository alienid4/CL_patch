# CURRENT_STATE（自動生成，禁止手改）

> 本檔由 `python .project/snapshot.py` 生成。任何手寫進度、WBS、交付紀錄都可能過期；
> 以本檔與 `python .project/checks.py` 的即時輸出為準。

- 目前 HEAD: `4d18fbe`

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

## 2026-07-13 V1.41 agent 可用功能開關關閉 ✅ 完成
- 使用者：不喜歡 agent 能不能關模組。→ 能。
- 成果：config/features.js 加 email-agent(group 'Email', default true)；email.js footer 依 Features.isOn('email-agent') 決定——開:寄出/測試小幫手/匯出(備用)；關:只留「匯出寄送檔」(回 send.bat 模式)。要連背景服務也移除則跑 uninstall_agent.bat。
- 驗(預覽8790)：V1.41；開→footer 有寄出/測試小幫手；關(features{email-agent:false})→只剩匯出寄送檔；功能開關面板已登錄；console 無錯。

## 2026-07-13 V1.40 全在網頁寄信：本機小幫手(agent) ＋ 網頁「寄出」按鈕 ✅ 完成
- 使用者：不想點 bat，全部在網頁完成。→ 純網頁不能寄(鐵牆)，唯一解=本機常駐 agent，網頁 fetch localhost 呼叫它查 AD+寄。使用者同意「設定一次、背景常駐」。
- 成果：
  · mail_agent.ps1：.NET HttpListener 只聽 http://localhost:8899；GET /health、POST /plan(查AD不寄回計畫)、POST /send(實寄)；ADSI 查 email(override 優先，唯一命中才用)；Send-MailMessage 免認證 relay；CORS *＋Access-Control-Allow-Private-Network:true(供 file:// / 跨埠 fetch)。不寫死公司資訊(全來自 web 送來的批次/AD)。
  · install_agent.bat(schtasks ONLOGON 背景隱藏、設定一次開機自動)、start_agent.bat(測試可見)、uninstall_agent.bat。
  · email.js：Email 設定加「寄出」(→/plan 顯示計畫→確認寄出→/send)、「測試小幫手」(/health)；buildPayload 共用；「匯出（備用）」保留給 send.bat。css .plan-actions/.plan-*。
- 驗(在本機實起 agent 測 web↔agent)：/health ok；/plan 200 回計畫(本機查不到天龍八部名→正確 fallback 轉主管)；UI：列出→勾記憶(玄慈/阿朱)→寄出→計畫顯示「→轉主管」＋「確認寄出(2)」；console 無錯；V1.40。未按確認(避免真寄)。
- 未測(需公司機器)：真 AD 解析＋真 relay 寄。流程本身已驗通。
- 用法：跑一次 install_agent.bat(開機自動背景)→之後網頁「Email 設定→列出→勾選→寄出→確認」全在網頁完成。

## 2026-07-13 V1.39 催辦人選記憶（選一次下次自動帶入）✅ 完成
- 使用者：第一次做選擇後就當預設帶入，以後不用再選。
- 成果：email.js 加 SEL_KEY(vulnDashboard.emailSel)；doExportSelected 匯出時 saveSel(勾選的負責人名)；doList 用 loadSel 套用——有記憶就只勾記住的、沒記憶(從未選過)預設全勾。全選/全不選仍可臨時調整。
- 驗(預覽8790)：V1.39；清記憶→全31勾；設記憶[玄慈,阿朱]→只勾這兩位；console 無錯。

## 2026-07-13 V1.38 催辦可勾選人選＋寄前 Y/N 確認 ✅ 完成
- 使用者：5 人是否都發？→是，每人一封不同信。但測試想只發一人；前期要手動確認人選，後期才自動。理想流程：檢查→問要不要發→按 Yes 才寄。
- 網頁(email.js)：Email 設定加「列出催辦名單」——各負責人一列 checkbox(預設全勾)＋全選/全不選；「匯出勾選的人」只匯出勾選者到 mail-batch.json(測試就全不選→勾一個)。css .batch-list/.batch-row/.batch-tools。
- 腳本(send_mail.ps1)：改兩段——Pass1 先查 AD 建「寄送計畫」並印出(誰→哪個email／轉主管／跳過)；Read-Host Y/N 確認；Pass2 按 Y 才實際寄。取消不寄任何信。
- 驗(預覽8790)：V1.38；列表 31 人、預設全勾、全不選=0、勾一個=1；footer 三鈕正確；ps1 parse OK；console 無錯。
- 未測(需公司機器)：AD 查詢＋實際 relay 寄送(同 V1.37，請跑 send.bat 貼回結果)。

```

## 最近 10 筆 commit

```
4d18fbe V1.57：全站字級等比放大 ×1.18（顧慮老花眼可讀性）
9226404 V1.56：.gitignore 加擋公司內部規範文件（Cathay規範/、合規落差對照表.md），防止外流至公開 repo
e511881 V1.55：CC 可驗證 — 小幫手回報版本 + 發信紀錄加「副本」欄
3c715f8 V1.54：logo 加白色圓角底 chip，避免綠 logo 貼綠頁首看不清
ca1aabf V1.53：內建國泰綠佔位 logo（assets/logo.svg），官方 logo.png 可覆蓋
fe2f878 V1.52：左上角改讀本機 logo（assets/logo.png，讀不到退回盾牌）
f851c08 V1.51：使用說明移除「更新到最新版」節（upload/GitHub/update 部署資訊不外露）
3161518 V1.50：發信失敗告警 + 發信紀錄
a9839b2 V1.49：Email 加「副本給自己（寄件人）」選項（預設開）
fa99fbc 放回一次性開發包_4.0_分享版(開發方法論分享包)
```
